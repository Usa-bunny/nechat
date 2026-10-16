import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected'

type Signal =
  | { type: 'offer'; data: RTCSessionDescriptionInit; senderId: string }
  | { type: 'answer'; data: RTCSessionDescriptionInit; senderId: string }
  | { type: 'ice-candidate'; data: RTCIceCandidateInit; senderId: string }
  | { type: 'reject' | 'end-call'; senderId: string }

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

const RING_TIMEOUT_MS = 30_000

function buildRtcConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]
  // TURN opsional: tanpa TURN, panggilan bisa gagal di balik NAT simetris / jaringan seluler tertentu.
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL
  if (turnUrl) {
    iceServers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    })
  }
  return { iceServers }
}

export function useVoiceCall(roomId: string, currentUserId: string) {
  const [status, setStatus] = useState<CallStatus>('idle')
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pc = useRef<RTCPeerConnection | null>(null)
  const localStream = useRef<MediaStream | null>(null)
  const channel = useRef<RealtimeChannel | null>(null)
  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(null)
  const pendingIce = useRef<RTCIceCandidateInit[]>([])
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const send = useCallback(
    (signal: DistributiveOmit<Signal, 'senderId'>) => {
      void channel.current?.send({
        type: 'broadcast',
        event: 'webrtc-signaling',
        payload: { ...signal, senderId: currentUserId },
      })
    },
    [currentUserId],
  )

  /** Bersihkan semua resource. `notify` = beri tahu lawan bicara (hanya bila inisiatif dari kita). */
  const teardown = useCallback(
    (notify: boolean, signal: 'end-call' | 'reject' = 'end-call') => {
      if (notify) send({ type: signal })
      if (ringTimer.current) clearTimeout(ringTimer.current)
      ringTimer.current = null
      pc.current?.close()
      pc.current = null
      localStream.current?.getTracks().forEach((t) => t.stop())
      localStream.current = null
      pendingOffer.current = null
      pendingIce.current = []
      setRemoteStream(null)
      setMuted(false)
      setStatus('idle')
    },
    [send],
  )

  const createPeer = useCallback(async () => {
    const peer = new RTCPeerConnection(buildRtcConfig())
    pc.current = peer

    // getUserMedia dulu: bila izin mikrofon ditolak, tidak ada koneksi setengah jadi.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    localStream.current = stream
    stream.getTracks().forEach((t) => peer.addTrack(t, stream))

    peer.onicecandidate = (e) => {
      if (e.candidate) send({ type: 'ice-candidate', data: e.candidate.toJSON() })
    }
    peer.ontrack = (e) => setRemoteStream(e.streams[0])
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        if (ringTimer.current) clearTimeout(ringTimer.current)
        setStatus('connected')
      } else if (peer.connectionState === 'failed') {
        setError('Koneksi panggilan gagal (jaringan memblokir P2P).')
        teardown(true)
      }
    }
    return peer
  }, [send, teardown])

  const flushIce = useCallback(async () => {
    const peer = pc.current
    if (!peer) return
    for (const c of pendingIce.current) await peer.addIceCandidate(c).catch(() => {})
    pendingIce.current = []
  }, [])

  // Handler dibungkus ref agar subscription tidak perlu dibuat ulang tiap render (menghindari stale closure).
  const handlerRef = useRef<(s: Signal) => Promise<void>>(async () => {})
  handlerRef.current = async (s) => {
    if (s.senderId === currentUserId) return

    switch (s.type) {
      case 'offer':
        if (pc.current || pendingOffer.current) {
          send({ type: 'reject' }) // sedang sibuk
          return
        }
        pendingOffer.current = s.data
        setStatus('ringing') // JANGAN menyalakan mikrofon sebelum user menerima
        ringTimer.current = setTimeout(() => teardown(true, 'reject'), RING_TIMEOUT_MS)
        break
      case 'answer':
        if (!pc.current) return
        await pc.current.setRemoteDescription(s.data)
        await flushIce()
        break
      case 'ice-candidate':
        if (pc.current?.remoteDescription) await pc.current.addIceCandidate(s.data).catch(() => {})
        else pendingIce.current.push(s.data) // kandidat datang lebih dulu dari offer/answer
        break
      case 'reject':
        setError('Panggilan ditolak atau sedang sibuk.')
        teardown(false)
        break
      case 'end-call':
        teardown(false) // lawan yang menutup: jangan kirim balik (sebelumnya menyebabkan loop tak berujung)
        break
    }
  }

  useEffect(() => {
    if (!roomId || !currentUserId) return
    const supabase = createClient()
    const ch = supabase.channel(`call:${roomId}`)
    channel.current = ch
    ch.on('broadcast', { event: 'webrtc-signaling' }, ({ payload }) => void handlerRef.current(payload as Signal))
    ch.subscribe()

    return () => {
      teardown(true)
      channel.current = null
      void supabase.removeChannel(ch)
    }
  }, [roomId, currentUserId, teardown])

  const startCall = useCallback(async () => {
    if (pc.current || status !== 'idle') return
    setError(null)
    try {
      const peer = await createPeer()
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      setStatus('calling')
      send({ type: 'offer', data: offer })
      ringTimer.current = setTimeout(() => {
        setError('Tidak dijawab.')
        teardown(true)
      }, RING_TIMEOUT_MS)
    } catch (e) {
      teardown(false)
      setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Izin mikrofon ditolak.' : 'Tidak dapat memulai panggilan.')
    }
  }, [createPeer, send, status, teardown])

  const acceptCall = useCallback(async () => {
    const offer = pendingOffer.current
    if (!offer) return
    setError(null)
    try {
      if (ringTimer.current) clearTimeout(ringTimer.current)
      const peer = await createPeer()
      await peer.setRemoteDescription(offer)
      pendingOffer.current = null
      await flushIce()
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      send({ type: 'answer', data: answer })
    } catch (e) {
      teardown(true, 'reject')
      setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Izin mikrofon ditolak.' : 'Gagal menerima panggilan.')
    }
  }, [createPeer, flushIce, send, teardown])

  const rejectCall = useCallback(() => teardown(true, 'reject'), [teardown])
  const endCall = useCallback(() => teardown(true), [teardown])

  const toggleMute = useCallback(() => {
    const next = !muted
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = !next))
    setMuted(next)
  }, [muted])

  return { status, remoteStream, muted, error, startCall, acceptCall, rejectCall, endCall, toggleMute }
}
