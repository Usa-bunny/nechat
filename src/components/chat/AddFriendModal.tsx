'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquare, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { UserAvatar } from './UserAvatar'
import { useUserSearch } from '@/hooks/useUserSearch'
import { useChatStore } from '@/store/useChatStore'

export function AddFriendModal() {
  const open = useChatStore((s) => s.isAddFriendModalOpen)
  const setOpen = useChatStore((s) => s.setAddFriendModalOpen)
  const me = useChatStore((s) => s.me)
  const [query, setQuery] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const { results, loading } = useUserSearch(query, me ? [me.id] : [], open)

  const startChat = (id: string) => {
    setOpen(false)
    router.push(`/chat/dm/${id}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cari teman</DialogTitle>
          <DialogDescription>Ketik minimal 2 huruf nama pengguna untuk memulai obrolan pribadi.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nama pengguna..." className="pl-9" />
          {loading && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {query.trim().length >= 2 && !loading && results.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada pengguna dengan nama tersebut.</p>
          )}
          {results.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-muted">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar name={u.display_name} src={u.avatar_url} />
                <span className="truncate text-sm font-medium">{u.display_name}</span>
              </div>
              <Button size="sm" onClick={() => startChat(u.id)}>
                <MessageSquare /> Chat
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
