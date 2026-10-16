'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Lock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatRoom } from '@/components/chat/ChatRoom'
import { GroupInfoDialog, type GroupMember } from '@/components/chat/GroupInfoDialog'
import { UserAvatar } from '@/components/chat/UserAvatar'
import { unwrapGroupKey } from '@/lib/crypto'
import { getGroupKey, setGroupKey } from '@/lib/groupKeys'
import { getPrivateKey } from '@/lib/keyStore'
import { isUuid } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useChatStore, type Profile } from '@/store/useChatStore'

type GroupState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; name: string }

interface MemberRow {
  user_id: string
  role: 'admin' | 'member'
  encrypted_group_key: string | null
  wrapped_by: string | null
  users: Profile | Profile[] | null
}

interface GroupClientRoomProps {
  groupId: string
}

export default function GroupClientRoom({ groupId }: GroupClientRoomProps) {
  const router = useRouter()
  const me = useChatStore((s) => s.me)
  const joinRoom = useChatStore((s) => s.joinRoom)
  const leaveRoom = useChatStore((s) => s.leaveRoom)
  const onlineCount = useChatStore((s) => Object.keys(s.onlineUsers).length)

  const [state, setState] = useState<GroupState>({ status: 'loading' })
  const [members, setMembers] = useState<GroupMember[]>([])
  const [infoOpen, setInfoOpen] = useState(false)
  const meId = me?.id

  const loadMembers = useCallback(async () => {
    const { data, error } = await createClient()
      .from('group_members')
      .select('user_id, role, encrypted_group_key, wrapped_by, users(id, display_name, avatar_url)')
      .eq('group_id', groupId)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as unknown as MemberRow[]
    const list: GroupMember[] = rows.flatMap((r) => {
      const p = Array.isArray(r.users) ? r.users[0] : r.users
      return p ? [{ user_id: r.user_id, role: r.role, profile: p }] : []
    })
    setMembers(list)
    return rows
  }, [groupId])

  useEffect(() => {
    if (!meId) return
    if (!isUuid(groupId)) {
      router.replace('/chat')
      return
    }

    let cancelled = false
    setState({ status: 'loading' })

    const setup = async () => {
      try {
        const supabase = createClient()
        const [{ data: group }, rows] = await Promise.all([
          supabase.from('groups').select('id, name').eq('id', groupId).maybeSingle(),
          loadMembers(),
        ])
        const mine = rows.find((r) => r.user_id === meId)
        if (!group || !mine) throw new Error('Grup tidak ditemukan atau kamu bukan anggotanya.')

        let key = getGroupKey(groupId)
        if (!key) {
          if (!mine.encrypted_group_key || !mine.wrapped_by) throw new Error('Kunci grup belum dibagikan kepadamu.')
          const myPriv = await getPrivateKey(meId)
          if (!myPriv) throw new Error('Kunci enkripsi tidak ditemukan di browser ini. Muat ulang halaman.')
          const { data: wrapper } = await supabase.from('users').select('public_key').eq('id', mine.wrapped_by).maybeSingle()
          if (!wrapper?.public_key) throw new Error('Public key pembagi kunci tidak ditemukan.')
          key = await unwrapGroupKey(mine.encrypted_group_key, myPriv, wrapper.public_key).catch(() => {
            throw new Error('Gagal membuka kunci grup (kunci enkripsi browser ini berbeda dari saat kamu ditambahkan).')
          })
          setGroupKey(groupId, key)
        }
        if (cancelled) return

        setState({ status: 'ready', name: group.name })
        await joinRoom({ type: 'group', userId: meId, groupId, key })
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : 'Gagal membuka grup.' })
      }
    }

    void setup()
    return () => {
      cancelled = true
      void leaveRoom()
    }
  }, [groupId, meId, joinRoom, leaveRoom, loadMembers, router])

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
        <p className="text-sm">Membuka kunci grup...</p>
      </div>
    )
  }

  return (
    <>
      <ChatRoom
        encrypted
        showSender
        placeholder={`Pesan ke ${state.name}...`}
        header={
          <header className="z-10 flex h-14 shrink-0 items-center justify-between border-b bg-background px-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/chat" className="rounded-full p-1.5 hover:bg-muted md:hidden" aria-label="Kembali">
                <ArrowLeft className="size-5" />
              </Link>
              <UserAvatar group name={state.name} />
              <div className="min-w-0">
                <h1 className="truncate text-sm leading-tight font-semibold">{state.name}</h1>
                <p className="flex items-center gap-1 text-[11px] leading-tight text-muted-foreground">
                  <Lock className="size-3 text-emerald-600" /> {members.length} anggota · {onlineCount} online
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setInfoOpen(true)}>
              <Users /> <span className="hidden sm:inline">Anggota</span>
            </Button>
          </header>
        }
      />
      <GroupInfoDialog
        open={infoOpen}
        onOpenChange={setInfoOpen}
        groupId={groupId}
        groupName={state.name}
        members={members}
        onChanged={() => void loadMembers()}
      />
    </>
  )
}
