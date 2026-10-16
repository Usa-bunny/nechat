'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { UserAvatar } from './UserAvatar'
import { useUserSearch } from '@/hooks/useUserSearch'
import { exportRawKey, generateAesKey, wrapGroupKey } from '@/lib/crypto'
import { setGroupKey } from '@/lib/groupKeys'
import { getPrivateKey } from '@/lib/keyStore'
import { createClient } from '@/utils/supabase/client'
import { useChatStore, type Profile } from '@/store/useChatStore'
import { cn } from '@/lib/utils'

export function CreateGroupModal() {
  const open = useChatStore((s) => s.isCreateGroupModalOpen)
  const setOpen = useChatStore((s) => s.setCreateGroupModalOpen)
  const bump = useChatStore((s) => s.bumpConversations)
  const me = useChatStore((s) => s.me)
  const router = useRouter()

  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Profile[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setQuery('')
      setSelected([])
      setError(null)
      setCreating(false)
    }
  }, [open])

  const { results, loading } = useUserSearch(query, me ? [me.id] : [], open)

  const toggle = (u: Profile) =>
    setSelected((cur) => (cur.some((x) => x.id === u.id) ? cur.filter((x) => x.id !== u.id) : [...cur, u]))

  const canCreate = name.trim().length >= 2 && selected.length >= 1 && !creating

  const handleCreate = async () => {
    if (!me || !canCreate) return
    setCreating(true)
    setError(null)
    const supabase = createClient()
    let groupId: string | null = null

    try {
      const myPriv = await getPrivateKey(me.id)
      if (!myPriv) throw new Error('Kunci enkripsi tidak ditemukan di browser ini.')

      // Public key semua calon anggota (termasuk kita sendiri).
      const { data: people, error: pErr } = await supabase
        .from('users')
        .select('id, public_key')
        .in('id', [me.id, ...selected.map((s) => s.id)])
      if (pErr) throw new Error(pErr.message)

      const members = (people ?? []).filter((p): p is { id: string; public_key: string } => !!p.public_key)
      if (!members.some((m) => m.id === me.id)) throw new Error('Public key kamu belum terdaftar. Muat ulang halaman.')
      if (members.length < 2) throw new Error('Anggota yang dipilih belum mengaktifkan enkripsi (belum pernah membuka Nechat).')

      // Group key acak; dibungkus terpisah untuk tiap anggota dengan ECDH(kita, anggota).
      const groupKey = await generateAesKey()
      const raw = await exportRawKey(groupKey)

      const { data: group, error: gErr } = await supabase
        .from('groups')
        .insert({ name: name.trim(), created_by: me.id })
        .select('id')
        .single()
      if (gErr || !group) throw new Error(gErr?.message ?? 'Gagal membuat grup.')
      groupId = group.id as string

      const rows = await Promise.all(
        members.map(async (m) => ({
          group_id: groupId,
          user_id: m.id,
          role: m.id === me.id ? 'admin' : 'member',
          encrypted_group_key: await wrapGroupKey(raw, myPriv, m.public_key),
          wrapped_by: me.id,
        })),
      )
      const { error: mErr } = await supabase.from('group_members').insert(rows)
      if (mErr) throw new Error(mErr.message)

      setGroupKey(groupId, groupKey)
      bump()
      setOpen(false)
      router.push(`/chat/group/${groupId}`)
    } catch (e) {
      if (groupId) await supabase.from('groups').delete().eq('id', groupId) // rollback
      setError(e instanceof Error ? e.message : 'Gagal membuat grup.')
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !creating && setOpen(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat grup baru</DialogTitle>
          <DialogDescription>Pesan grup dienkripsi end-to-end. Kunci grup hanya diberikan kepada anggota.</DialogDescription>
        </DialogHeader>

        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nama grup" autoFocus />

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((u) => (
              <span key={u.id} className="flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pr-1 pl-2.5 text-xs font-medium text-primary">
                {u.display_name}
                <button onClick={() => toggle(u)} className="rounded-full p-0.5 hover:bg-primary/20" aria-label={`Hapus ${u.display_name}`}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari anggota..." className="pl-9" />
          {loading && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>

        <div className="max-h-48 space-y-1 overflow-y-auto">
          {results.map((u) => {
            const on = selected.some((x) => x.id === u.id)
            return (
              <button
                key={u.id}
                onClick={() => toggle(u)}
                className={cn('flex w-full items-center justify-between gap-3 rounded-lg p-2 text-left hover:bg-muted', on && 'bg-primary/5')}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <UserAvatar name={u.display_name} src={u.avatar_url} className="size-8" />
                  <span className="truncate text-sm font-medium">{u.display_name}</span>
                </span>
                {on && <Check className="size-4 text-primary" />}
              </button>
            )
          })}
        </div>

        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>
            Batal
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {creating && <Loader2 className="animate-spin" />} Buat grup{selected.length > 0 && ` (${selected.length + 1})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
