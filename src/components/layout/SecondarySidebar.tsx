'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/chat/UserAvatar'
import { createClient } from '@/utils/supabase/client'
import { useChatStore, type Profile } from '@/store/useChatStore'
import { cn } from '@/lib/utils'

interface GroupItem {
  id: string
  name: string
}

function SectionTitle({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <div className="mb-1 flex items-center justify-between px-2 pt-3">
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{children}</span>
      {action}
    </div>
  )
}

export function SecondarySidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const me = useChatStore((s) => s.me)
  const version = useChatStore((s) => s.conversationsVersion)
  const bump = useChatStore((s) => s.bumpConversations)
  const setAddFriendOpen = useChatStore((s) => s.setAddFriendModalOpen)
  const setCreateGroupOpen = useChatStore((s) => s.setCreateGroupModalOpen)

  const [friends, setFriends] = useState<Profile[]>([])
  const [groups, setGroups] = useState<GroupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const meId = me?.id

  const refresh = useCallback(async () => {
    if (!meId) return
    const supabase = createClient()

    const [dmRes, grpRes] = await Promise.all([
      supabase
        .from('direct_messages')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${meId},receiver_id.eq.${meId}`)
        .order('created_at', { ascending: false })
        .limit(500), // cukup untuk membangun daftar lawan bicara terbaru
      supabase.from('group_members').select('group_id, groups(id, name)').eq('user_id', meId),
    ])

    const ids = [
      ...new Set((dmRes.data ?? []).map((dm) => (dm.sender_id === meId ? dm.receiver_id : dm.sender_id)).filter((x): x is string => !!x)),
    ]
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from('users').select('id, display_name, avatar_url').in('id', ids)
      const byId = new Map((profiles ?? []).map((p) => [p.id, p as Profile]))
      setFriends(ids.map((id) => byId.get(id)).filter((p): p is Profile => !!p)) // urut: obrolan terbaru dulu
    } else {
      setFriends([])
    }

    const list = (grpRes.data ?? [])
      .map((r) => (Array.isArray(r.groups) ? r.groups[0] : r.groups) as GroupItem | null)
      .filter((g): g is GroupItem => !!g)
      .sort((a, b) => a.name.localeCompare(b.name))
    setGroups(list)
    setLoading(false)
  }, [meId])

  // muat ulang saat pindah halaman / ada perubahan lokal
  useEffect(() => {
    void refresh()
  }, [refresh, pathname, version])

  // dan saat ada DM baru dari orang lain atau kita ditambahkan ke grup
  useEffect(() => {
    if (!meId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`sidebar:${meId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${meId}` }, bump)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_members', filter: `user_id=eq.${meId}` }, bump)
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [meId, bump])

  const q = filter.trim().toLowerCase()
  const shownFriends = friends.filter((f) => f.display_name.toLowerCase().includes(q))
  const shownGroups = groups.filter((g) => g.name.toLowerCase().includes(q))

  return (
    <aside className={cn('h-full shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground', className)}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-base font-semibold">Obrolan</h2>
        <Button size="icon-sm" variant="ghost" onClick={() => setAddFriendOpen(true)} aria-label="Obrolan baru">
          <Plus />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cari obrolan..." className="h-8 pl-8 text-xs" />
        </div>

        <SectionTitle
          action={
            <Button size="icon-xs" variant="ghost" onClick={() => setCreateGroupOpen(true)} aria-label="Buat grup">
              <Plus />
            </Button>
          }
        >
          Grup
        </SectionTitle>
        {loading ? (
          <Skeleton className="mx-2 h-9" />
        ) : shownGroups.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">{q ? 'Tidak ada grup cocok.' : 'Belum ada grup.'}</p>
        ) : (
          shownGroups.map((g) => (
            <Link
              key={g.id}
              href={`/chat/group/${g.id}`}
              className={cn('flex items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-accent', pathname === `/chat/group/${g.id}` && 'bg-accent font-medium')}
            >
              <UserAvatar group name={g.name} className="size-8" />
              <span className="truncate">{g.name}</span>
            </Link>
          ))
        )}

        <SectionTitle>Pesan langsung</SectionTitle>
        {loading ? (
          <div className="space-y-2 px-2">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : shownFriends.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">{q ? 'Tidak ada obrolan cocok.' : 'Belum ada obrolan. Cari teman untuk memulai.'}</p>
        ) : (
          shownFriends.map((f) => (
            <Link
              key={f.id}
              href={`/chat/dm/${f.id}`}
              className={cn('flex items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-accent', pathname === `/chat/dm/${f.id}` && 'bg-accent font-medium')}
            >
              <UserAvatar name={f.display_name} src={f.avatar_url} className="size-8" />
              <span className="truncate">{f.display_name}</span>
            </Link>
          ))
        )}
      </div>
    </aside>
  )
}
