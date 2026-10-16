'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CallBar } from '@/components/chat/CallBar'
import { ChatRoom } from '@/components/chat/ChatRoom'
import { SafetyNumberDialog } from '@/components/chat/SafetyNumberDialog'
import { UserAvatar } from '@/components/chat/UserAvatar'
import { useVoiceCall } from '@/hooks/useVoiceCall'
import { deriveSharedKey, importPublicKey } from '@/lib/crypto'
import { getPrivateKey, getPublicKey } from '@/lib/keyStore'
import { isUuid } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useChatStore, type Profile } from '@/store/useChatStore'

type DmState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; friend: Profile; myPublicKey: string; theirPublicKey: string }

interface DmClientRoomProps {
  friendId: string
}

export default function DmClientRoom({ friendId }: DmClientRoomProps) {
  const router = useRouter()
  const me = useChatStore((s) => s.me)
  const joinRoom = useChatStore((s) => s.joinRoom)
  const leaveRoom = useChatStore((s) => s.leaveRoom)
  const friendOnline = useChatStore((s) => !!s.onlineUsers[friendId])

  const [state, setState] = useState<DmState>({ status: 'loading' })
  const meId = me?.id

  useEffect(() => {
    if (!meId) return
    if (!isUuid(friendId) || friendId === meId) {
      router.replace('/chat')
      return
    }

    let cancelled = false
    setState({ status: 'loading' })

    const setup = async () => {
      try {
        const supabase = createClient()
        const myPriv = await getPrivateKey(meId)
        if (!myPriv) throw new Error('Kunci enkripsi tidak ditemukan di browser ini. Muat ulang halaman.')

        const { data: friend, error } = await supabase
          .from('users')
          .select('id, display_name, avatar_url, public_key')
          .eq('id', friendId)
          .maybeSingle()
        if (error) throw new Error(error.message)
        if (!friend) throw new Error('Pengguna tidak ditemukan.')
        if (!friend.public_key) throw new Error(`${friend.display_name} belum mengaktifkan enkripsi. Minta mereka membuka Nechat terlebih dulu.`)

        const key = await deriveSharedKey(myPriv, await importPublicKey(friend.public_key))
        const myPublicKey = await getPublicKey(meId)
        if (!myPublicKey) throw new Error('Public key lokal tidak ditemukan. Muat ulang halaman.')
        if (cancelled) return

        setState({
          status: 'ready',
          friend: { id: friend.id, display_name: friend.display_name, avatar_url: friend.avatar_url },
          myPublicKey,
          theirPublicKey: friend.public_key,
        })
        await joinRoom({ type: 'dm', userId: meId, friendId, key })
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : 'Gagal membuka obrolan.' })
      }
    }

    void setup()
    return () => {
      cancelled = true
      void leaveRoom()
    }
  }, [friendId, meId, joinRoom, leaveRoom, router])

  const roomId = meId ? [meId, friendId].sort().join('-') : ''
  const call = useVoiceCall(state.status === 'ready' ? roomId : '', meId ?? '')

  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = call.remoteStream
  }, [call.remoteStream])

  if (state.status === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="max-w-sm text-sm text-destructive">{state.message}</p>
        <Button variant="outline" onClick={() => router.replace('/chat')}>
          Kembali
        </Button>
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm">Menyiapkan koneksi aman...</p>
      </div>
    )
  }

  const { friend } = state

  return (
    <ChatRoom
      encrypted
      placeholder="Ketik pesan rahasia..."
      header={
        <>
          <header className="z-10 flex h-14 shrink-0 items-center justify-between border-b bg-background px-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/chat" className="rounded-full p-1.5 hover:bg-muted md:hidden" aria-label="Kembali">
                <ArrowLeft className="size-5" />
              </Link>
              <UserAvatar name={friend.display_name} src={friend.avatar_url} online={friendOnline} />
              <div className="min-w-0">
                <h1 className="truncate text-sm leading-tight font-semibold">{friend.display_name}</h1>
                <SafetyNumberDialog myPublicKey={state.myPublicKey} theirPublicKey={state.theirPublicKey} friendName={friend.display_name} />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={call.startCall} disabled={call.status !== 'idle'} className="text-emerald-600">
              <Phone /> <span className="hidden sm:inline">Telepon</span>
            </Button>
          </header>
          <CallBar
            status={call.status}
            friendName={friend.display_name}
            muted={call.muted}
            error={call.error}
            onAccept={call.acceptCall}
            onReject={call.rejectCall}
            onEnd={call.endCall}
            onToggleMute={call.toggleMute}
          />
          <audio ref={audioRef} autoPlay playsInline className="hidden" />
        </>
      }
    />
  )
}
