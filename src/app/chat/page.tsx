'use client'

import { MessageCircleHeart, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/store/useChatStore'

// Sidebar sekarang dirender oleh layout, jadi tetap tampil di semua halaman /chat/*.
export default function ChatDashboardPage() {
  const setAddFriendOpen = useChatStore((s) => s.setAddFriendModalOpen)
  const setCreateGroupOpen = useChatStore((s) => s.setCreateGroupModalOpen)

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-8 text-center">
      <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MessageCircleHeart className="size-12" strokeWidth={1.5} />
      </div>
      <h2 className="mb-2 text-2xl font-bold">Mulai obrolan rahasia</h2>
      <p className="mb-8 max-w-md text-sm text-muted-foreground">
        Cari teman untuk chat pribadi, atau buat grup. Semua pesan dan file dilindungi enkripsi end-to-end.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" className="rounded-full" onClick={() => setAddFriendOpen(true)}>
          <UserPlus /> Cari teman
        </Button>
        <Button size="lg" variant="outline" className="rounded-full" onClick={() => setCreateGroupOpen(true)}>
          <Users /> Buat grup
        </Button>
      </div>
    </div>
  )
}
