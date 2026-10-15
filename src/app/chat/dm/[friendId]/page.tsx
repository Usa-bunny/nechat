'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation' 
import { createClient } from '@/utils/supabase/client'
import { useChatStore } from '@/store/useChatStore'
import { getPrivateKey } from '@/lib/keyStore'
import { importPublicKey, deriveSharedKey, encryptMessage } from '@/lib/crypto'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { useVoiceCall } from '@/hooks/useVoiceCall'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Phone, PhoneOff, Lock } from 'lucide-react'

import { decryptMessage } from '@/lib/crypto' // Pastikan ini sudah di-import

// Komponen mandiri untuk mendekripsi pesan E2EE secara real-time
function MessageBubble({ msg, userId, sharedKey }: { msg: any, userId: string, sharedKey: CryptoKey }) {
  const [text, setText] = useState('🔒 Mendekripsi...');
  const [media, setMedia] = useState<string | null>(null);

  useEffect(() => {
    const decryptData = async () => {
      // 1. Dekripsi Teks
      if (msg.encrypted_content) {
        try {
          const decText = await decryptMessage(msg.encrypted_content, sharedKey);
          setText(decText);
        } catch (e) {
          setText('❌ Gagal mendekripsi');
        }
      } else if (msg.content) {
        setText(msg.content); // Fallback jika pesan lawas tidak dienkripsi
      }

      // 2. Dekripsi URL Media
      if (msg.media_url) {
        try {
          const decMedia = await decryptMessage(msg.media_url, sharedKey);
          setMedia(decMedia);
        } catch (e) {
          setMedia(msg.media_url); // Fallback jika bukan URL terenkripsi
        }
      }
    };
    
    decryptData();
  }, [msg, sharedKey]);

  return (
    <div className={`mb-4 flex flex-col ${msg.sender_id === userId ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${msg.sender_id === userId ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
        <p className="text-sm whitespace-pre-wrap">{text}</p>
        
        {/* Render media (Bisa dikembangkan jadi tag <video> atau <a> untuk PDF) */}
        {media && (
          <div className="mt-2">
            <img src={media} alt="Attachment" className="max-w-xs rounded-md shadow-sm" />
          </div>
        )}
      </div>
    </div>
  );
}

function ChatUI() { 
  const params = useParams();
  const friendId = params.friendId as string;

  const [text, setText] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null)
  const [roomId, setRoomId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const messages = useChatStore((state) => state.messages)
  const initializeRealtime = useChatStore((state) => state.initializeRealtime)
  const cleanup = useChatStore((state) => state.cleanup)

  const { startCall, endCall, isCalling, remoteAudioStream } = useVoiceCall(roomId, userId || '');
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && remoteAudioStream) {
      audioRef.current.srcObject = remoteAudioStream;
    }
  }, [remoteAudioStream]);

  useEffect(() => {
    const setupE2EE = async () => {
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setError("Silakan login terlebih dahulu.");
      setUserId(user.id);

      const myPrivateKey = await getPrivateKey();
      if (!myPrivateKey) return setError("Private Key tidak ditemukan di browser ini.");

      const { data: friendData, error: friendErr } = await supabase
        .from('users')
        .select('public_key')
        .eq('id', friendId)
        .single();

      if (friendErr || !friendData?.public_key) return setError("Gagal mendapatkan Public Key teman.");

      const theirPublicKey = await importPublicKey(friendData.public_key);
      const derivedKey = await deriveSharedKey(myPrivateKey, theirPublicKey);
      setSharedKey(derivedKey);

      const generatedRoomId = [user.id, friendId].sort().join('-');
      setRoomId(generatedRoomId);

      initializeRealtime(generatedRoomId, user.id, derivedKey);
      
      const { data: history } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (history) {
        useChatStore.getState().setMessages(history.reverse());
      }
    };

    setupE2EE();
    return () => cleanup();
  }, [friendId, initializeRealtime, cleanup]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !userId || !sharedKey) return;
    const encryptedText = await encryptMessage(text, sharedKey);
    const supabase = createClient();
    await supabase.from('direct_messages').insert({
      sender_id: userId, receiver_id: friendId, encrypted_content: encryptedText,
    });
    setText('');
  }

  const handleSendMedia = async (fileToSend: File) => {
    if (!userId || !sharedKey) return alert("Kunci E2EE belum siap!");
    const mediaUrl = await uploadToCloudinary(fileToSend);
    if (!mediaUrl) return alert("Gagal mengunggah file.");
    const encryptedUrl = await encryptMessage(mediaUrl, sharedKey);
    const encryptedPlaceholder = await encryptMessage("📷 [Gambar/File]", sharedKey);
    const supabase = createClient();
    await supabase.from('direct_messages').insert({
      sender_id: userId, receiver_id: friendId, encrypted_content: encryptedPlaceholder, media_url: encryptedUrl, 
    });
  }

  if (error) return <div className="p-4 text-red-500 font-bold">{error}</div>;
  if (!sharedKey) return <div className="w-full h-full flex flex-col items-center justify-center text-slate-500"><Lock className="mb-2 animate-pulse" /> Menyiapkan koneksi aman E2EE...</div>;

  return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* Header DM */}
      <div className="h-14 border-b border-slate-200 flex justify-between items-center px-6 shadow-sm bg-white z-10">
        <div>
          <h1 className="font-bold text-slate-800 flex items-center gap-2">
            <span>@teman_id</span> {/* Nanti kita ganti ini dengan nama asli teman saat fetch DB */}
          </h1>
          <div className="text-[10px] text-green-600 flex items-center gap-1 font-medium mt-0.5 uppercase tracking-wider">
            <Lock size={10} /> E2EE Aktif
          </div>
        </div>
        
        {/* Tombol Telepon WebRTC */}
        <div>
          {!isCalling ? (
            <Button onClick={startCall} variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 h-9 px-3">
              <Phone size={16} className="mr-2" /> Telepon
            </Button>
          ) : (
            <Button onClick={endCall} variant="destructive" className="h-9 px-3 animate-pulse shadow-md">
              <PhoneOff size={16} className="mr-2" /> Tutup
            </Button>
          )}
        </div>
      </div>

      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        {messages.map((msg) => (
          <MessageBubble 
            key={msg.id} 
            msg={msg} 
            userId={userId!} 
            sharedKey={sharedKey} 
          />
        ))}
      </div>
      
      {/* Form Input Chat DM */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={sendMessage} className="flex gap-2 items-center bg-slate-100 p-2 rounded-full border border-slate-200 shadow-inner">
          <input 
            type="file" 
            accept="image/*,video/*,.pdf" // Mengizinkan lebih banyak tipe file
            className="hidden"
            id="file-upload-dm"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleSendMedia(e.target.files[0]);
              }
            }} 
          />
          <label htmlFor="file-upload-dm" className="cursor-pointer text-slate-500 hover:text-blue-600 p-2 ml-2 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          </label>

          <Input 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder="Ketik pesan rahasia..." 
            className="flex-1 border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent shadow-none"
          />
          <Button type="submit" className="rounded-full px-6 mr-1 bg-blue-600 hover:bg-blue-700">Kirim</Button>
        </form>
      </div>
    </div>
  )
}

export default function DirectMessagePage() {
  return (
    <Suspense fallback={<div className="flex h-full w-full items-center justify-center bg-slate-50 text-slate-400">Memuat ruang obrolan... ⏳</div>}>
      <ChatUI />
    </Suspense>
  )
}