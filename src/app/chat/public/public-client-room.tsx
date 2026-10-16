'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Hash, Users } from 'lucide-react'
import { ChatRoom } from '@/components/chat/ChatRoom'
import { useChatStore } from '@/store/useChatStore'

export default function PublicClientRoom() {
  const me = useChatStore((s) => s.me)
  const joinRoom = useChatStore((s) => s.joinRoom)
  const leaveRoom = useChatStore((s) => s.leaveRoom)
  const onlineCount = useChatStore((s) => Object.keys(s.onlineUsers).length)

  const meId = me?.id
  useEffect(() => {
    if (!meId) return
    void joinRoom({ type: 'public', userId: meId })
    return () => void leaveRoom()
  }, [meId, joinRoom, leaveRoom])

  return (
    <ChatRoom
      showSender
      encrypted={false}
      placeholder="Ketik pesan ke publik..."
      header={
        <header className="z-10 flex h-14 shrink-0 items-center justify-between border-b bg-background px-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Link href="/chat" className="rounded-full p-1.5 hover:bg-muted md:hidden" aria-label="Kembali">
              <ArrowLeft className="size-5" />
            </Link>
            <Hash className="size-5 text-muted-foreground" />
            <div>
              <h1 className="text-sm leading-tight font-semibold">global-chat</h1>
              <p className="text-[11px] leading-tight text-amber-600 dark:text-amber-400">Publik · tidak dienkripsi</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" /> {onlineCount} online
          </div>
        </header>
      }
    />
  )
}
