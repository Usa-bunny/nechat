import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Konfigurasi server STUN publik gratis dari Google (untuk mencari Public IP kita)
const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useVoiceCall(roomId: string, currentUserId: string) {
  const [isCalling, setIsCalling] = useState(false);
  const [remoteAudioStream, setRemoteAudioStream] =
    useState<MediaStream | null>(null);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const channel = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!roomId || !currentUserId) return;

    const supabase = createClient();
    channel.current = supabase.channel(`call:${roomId}`);

    channel.current.on(
      "broadcast",
      { event: "webrtc-signaling" },
      async (payload) => {
        const { type, data, senderId } = payload.payload;
        if (senderId === currentUserId) return; // Abaikan pesan dari diri sendiri

        // Jika menerima OFFER dari penelepon
        if (type === "offer") {
          await initPeerConnection();
          await peerConnection.current?.setRemoteDescription(
            new RTCSessionDescription(data),
          );
          const answer = await peerConnection.current?.createAnswer();
          await peerConnection.current?.setLocalDescription(answer);

          // Kirim balik ANSWER
          channel.current?.send({
            type: "broadcast",
            event: "webrtc-signaling",
            payload: { type: "answer", data: answer, senderId: currentUserId },
          });
          setIsCalling(true);
        }

        // Jika menerima ANSWER dari penerima telepon
        if (type === "answer") {
          await peerConnection.current?.setRemoteDescription(
            new RTCSessionDescription(data),
          );
          setIsCalling(true);
        }

        // Jika menerima ICE CANDIDATE (Rute jaringan)
        if (type === "ice-candidate") {
          await peerConnection.current?.addIceCandidate(
            new RTCIceCandidate(data),
          );
        }

        // Jika lawan mematikan telepon
        if (type === "end-call") {
          endCall();
        }
      },
    );

    channel.current.subscribe();

    return () => {
      endCall();
      channel.current?.unsubscribe();
    };
  }, [roomId, currentUserId]);

  // Fungsi inisiasi koneksi WebRTC
  const initPeerConnection = async () => {
    peerConnection.current = new RTCPeerConnection(rtcConfig);

    // Minta izin mikrofon
    localStream.current = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    // Masukkan suara kita ke dalam koneksi
    localStream.current.getTracks().forEach((track) => {
      peerConnection.current?.addTrack(track, localStream.current!);
    });

    // Tangkap ICE Candidate (rute jaringan) yang dihasilkan browser, kirim ke lawan
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        channel.current?.send({
          type: "broadcast",
          event: "webrtc-signaling",
          payload: {
            type: "ice-candidate",
            data: event.candidate,
            senderId: currentUserId,
          },
        });
      }
    };

    // Tangkap suara dari lawan, masukkan ke state agar bisa diputar di <audio> tag
    peerConnection.current.ontrack = (event) => {
      setRemoteAudioStream(event.streams[0]);
    };
  };

  // Fungsi untuk MULAI MENELEPON
  const startCall = async () => {
    await initPeerConnection();

    const offer = await peerConnection.current?.createOffer();
    await peerConnection.current?.setLocalDescription(offer);

    // Kirim OFFER ke lawan lewat Supabase Broadcast
    channel.current?.send({
      type: "broadcast",
      event: "webrtc-signaling",
      payload: { type: "offer", data: offer, senderId: currentUserId },
    });
  };

  // Fungsi untuk MATIKAN TELEPON
  const endCall = () => {
    peerConnection.current?.close();
    localStream.current?.getTracks().forEach((track) => track.stop());
    setRemoteAudioStream(null);
    setIsCalling(false);

    channel.current?.send({
      type: "broadcast",
      event: "webrtc-signaling",
      payload: { type: "end-call", senderId: currentUserId },
    });
  };

  return { startCall, endCall, isCalling, remoteAudioStream };
}
