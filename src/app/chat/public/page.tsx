'use client'

import { useEffect, useState } from 'react'
import { useChatStore } from '@/store/useChatStore'
import { createClient } from '@/utils/supabase/client'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Users, Hash } from 'lucide-react'

export default function PublicChatPage() {
  const [text, setText] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  const messages = useChatStore((state) => state.messages)
  const initializeRealtime = useChatStore((state) => state.initializeRealtime)
  const cleanup = useChatStore((state) => state.cleanup)
  const updateTypingStatus = useChatStore((state) => state.updateTypingStatus)
  const onlineUsers = useChatStore((state) => state.onlineUsers)
  const typingUsers = useChatStore((state) => state.typingUsers)

  useEffect(() => {
    const setup = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setUserId(user.id)
        // Public chat tidak butuh sharedKey (E2EE)
        initializeRealtime('public_chat', user.id, undefined) 
        
        const { data } = await supabase
          .from('public_messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)
          
        if (data) {
           useChatStore.getState().setMessages(data.reverse())
        }
      }
    }
    setup()
    return () => cleanup()
  }, [initializeRealtime, cleanup])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || !userId) return

    const supabase = createClient()
    await supabase.from('public_messages').insert({
      sender_id: userId,
      content: text
    })
    
    setText('')
    updateTypingStatus(false)
  }

  let typingTimeout: NodeJS.Timeout
  const handleTyping = (val: string) => {
    setText(val)
    updateTypingStatus(true)
    clearTimeout(typingTimeout)
    typingTimeout = setTimeout(() => updateTypingStatus(false), 2000)
  }

  const handleSendMedia = async (fileToSend: File) => {
    if (!userId) return alert("Kamu belum login!");
    const mediaUrl = await uploadToCloudinary(fileToSend);
    if (!mediaUrl) return alert("Gagal mengunggah file.");

    const supabase = createClient();
    await supabase.from('public_messages').insert({
      sender_id: userId,
      content: "📷 [Gambar]", 
      media_url: mediaUrl,          
    });
  }

  return (
    // DI SINI PERUBAHANNYA: Memenuhi seluruh ruang konten utama
    <div className="flex flex-col h-full w-full bg-white">
      {/* Header Info */}
      <div className="h-14 border-b border-slate-200 flex justify-between items-center px-6 shadow-sm bg-white z-10">
        <div className="flex items-center gap-2">
          <Hash className="text-slate-400" size={20} />
          <h1 className="font-bold text-slate-800">global-chat</h1>
        </div>
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <Users size={16} />
          {Object.keys(onlineUsers).length} Online
        </div>
      </div>

      {/* Area Chat */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`mb-4 flex flex-col ${msg.sender_id === userId ? 'items-end' : 'items-start'}`}>
            <span className="text-[10px] text-slate-400 mb-1 px-1">
               {msg.sender_id === userId ? 'Kamu' : 'Anonim'}
            </span>
            <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${msg.sender_id === userId ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
              <p className="text-sm">{msg.content}</p>
              {msg.media_url && (
                <div className="mt-2">
                  <img src={msg.media_url} alt="Attachment" className="max-w-xs rounded-md shadow-sm" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Indikator Typing */}
      <div className="h-6 text-xs text-slate-400 px-6 bg-slate-50">
         {Object.keys(typingUsers).filter(id => typingUsers[id] && id !== userId).length > 0 && 
           "Seseorang sedang mengetik..."}
      </div>

      {/* Input Form */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={sendMessage} className="flex gap-2 items-center bg-slate-100 p-2 rounded-full border border-slate-200 shadow-inner">
          <input 
            type="file" 
            accept="image/*"
            className="hidden"
            id="file-upload-public"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleSendMedia(e.target.files[0]);
              }
            }} 
          />
          <label htmlFor="file-upload-public" className="cursor-pointer text-slate-500 hover:text-blue-600 p-2 ml-2 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          </label>

          <Input 
            value={text} 
            onChange={(e) => handleTyping(e.target.value)} 
            placeholder="Ketik pesan ke publik..." 
            className="flex-1 border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent shadow-none"
          />
          <Button type="submit" className="rounded-full px-6 mr-1 bg-blue-600 hover:bg-blue-700">Kirim</Button>
        </form>
      </div>
    </div>
  )
}