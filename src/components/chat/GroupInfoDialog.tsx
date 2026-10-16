'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Loader2, LogOut, Search, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { UserAvatar } from './UserAvatar'
import { useUserSearch } from '@/hooks/useUserSearch'
import { exportRawKey, wrapGroupKey } from '@/lib/crypto'
import { getGroupKey } from '@/lib/groupKeys'
import { getPrivateKey } from '@/lib/keyStore'
import { createClient } from '@/utils/supabase/client'
import { useChatStore, type Profile } from '@/store/useChatStore'

export interface GroupMember {
  user_id: string
  role: 'admin' | 'member'
  profile: Profile
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  groupName: string
  members: GroupMember[]
  onChanged: () => void
}

export function GroupInfoDialog({ open, onOpenChange, groupId, groupName, members, onChanged }: Props) {
  const me = useChatStore((s) => s.me)
  const onlineUsers = useChatStore((s) => s.onlineUsers)
  const bump = useChatStore((s) => s.bumpConversations)
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const myRole = members.find((m) => m.user_id === me?.id)?.role
  const isAdmin = myRole === 'admin'
  const adminCount = members.filter((m) => m.role === 'admin').length

  const { results, loading } = useUserSearch(query, members.map((m) => m.user_id), open && isAdmin)

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setBusy(null)
    }
  }

  const addMember = (u: Profile) =>
    run(`add:${u.id}`, async () => {
      if (!me) return
      const supabase = createClient()
      const groupKey = getGroupKey(groupId)
      const myPriv = await getPrivateKey(me.id)
      if (!groupKey || !myPriv) throw new Error('Kunci grup belum siap.')

      const { data } = await supabase.from('users').select('public_key').eq('id', u.id).single()
      if (!data?.public_key) throw new Error(`${u.display_name} belum mengaktifkan enkripsi.`)

      const wrapped = await wrapGroupKey(await exportRawKey(groupKey), myPriv, data.public_key)
      const { error: e } = await supabase.from('group_members').insert({
        group_id: groupId,
        user_id: u.id,
        role: 'member',
        encrypted_group_key: wrapped,
        wrapped_by: me.id,
      })
      if (e) throw new Error(e.message)
      setQuery('')
      onChanged()
    })

  const promote = (m: GroupMember) =>
    run(`promote:${m.user_id}`, async () => {
      const { error: e } = await createClient().from('group_members').update({ role: 'admin' }).eq('group_id', groupId).eq('user_id', m.user_id)
      if (e) throw new Error(e.message)
      onChanged()
    })

  const leave = () =>
    run('leave', async () => {
      if (!me) return
      if (isAdmin && adminCount === 1 && members.length > 1) {
        throw new Error('Kamu admin terakhir. Jadikan anggota lain admin sebelum keluar.')
      }
      const { error: e } = await createClient().from('group_members').delete().eq('group_id', groupId).eq('user_id', me.id)
      if (e) throw new Error(e.message)
      bump()
      onOpenChange(false)
      router.replace('/chat')
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{groupName}</DialogTitle>
          <DialogDescription>{members.length} anggota</DialogDescription>
        </DialogHeader>

        {isAdmin && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tambah anggota..." className="pl-9" />
              {loading && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
            {results.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <UserAvatar name={u.display_name} src={u.avatar_url} className="size-8" />
                  <span className="truncate text-sm">{u.display_name}</span>
                </span>
                <Button size="sm" onClick={() => addMember(u)} disabled={busy === `add:${u.id}`}>
                  {busy === `add:${u.id}` ? <Loader2 className="animate-spin" /> : <UserPlus />} Tambah
                </Button>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Anggota baru dapat membaca pesan baru dan lama yang tersimpan di grup ini.
            </p>
          </div>
        )}

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-muted">
              <span className="flex min-w-0 items-center gap-2.5">
                <UserAvatar name={m.profile.display_name} src={m.profile.avatar_url} online={!!onlineUsers[m.user_id]} className="size-8" />
                <span className="truncate text-sm font-medium">
                  {m.profile.display_name}
                  {m.user_id === me?.id && <span className="text-muted-foreground"> (kamu)</span>}
                </span>
              </span>
              {m.role === 'admin' ? (
                <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <Crown className="size-3.5" /> Admin
                </span>
              ) : (
                isAdmin && (
                  <Button size="xs" variant="outline" onClick={() => promote(m)} disabled={busy === `promote:${m.user_id}`}>
                    Jadikan admin
                  </Button>
                )
              )}
            </div>
          ))}
        </div>

        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

        <Button variant="destructive" onClick={leave} disabled={busy === 'leave'}>
          {busy === 'leave' ? <Loader2 className="animate-spin" /> : <LogOut />} Keluar dari grup
        </Button>
      </DialogContent>
    </Dialog>
  )
}
