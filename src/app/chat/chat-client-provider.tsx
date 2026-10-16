'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2, ShieldAlert, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { ensureKeys } from '@/lib/keyStore'
import { clearGroupKeys } from '@/lib/groupKeys'
import { MainSidebar } from '@/components/layout/MainSidebar'
import { SecondarySidebar } from '@/components/layout/SecondarySidebar'
import { AddFriendModal } from '@/components/chat/AddFriendModal'
import { CreateGroupModal } from '@/components/chat/CreateGroupModal'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/store/useChatStore'
import { cn } from '@/lib/utils'

export default function ChatClientProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const setMe = useChatStore((s) => s.setMe)
  const leaveRoom = useChatStore((s) => s.leaveRoom)

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [initStatus, setInitStatus] = useState('Memeriksa sesi...')
  const [initError, setInitError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    const init = async () => {
      setStatus('loading')
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()
        if (authError || !user) {
          router.replace('/')
          return
        }

        setInitStatus('Menyiapkan profil...')
        const { data: row, error: rowError } = await supabase
          .from('users')
          .select('id, display_name, avatar_url, public_key')
          .eq('id', user.id)
          .maybeSingle()
        if (rowError) throw new Error(rowError.message)

        setInitStatus('Memeriksa kunci enkripsi...')
        const keys = await ensureKeys(user.id, row?.public_key ?? null)

        const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>
        const displayName = row?.display_name ?? meta.full_name ?? meta.name ?? user.email?.split('@')[0] ?? 'Pengguna'
        const avatarUrl = row?.avatar_url ?? meta.avatar_url ?? meta.picture ?? null

        if (!row) {
          const { error } = await supabase
            .from('users')
            .upsert({ id: user.id, display_name: displayName, avatar_url: avatarUrl, public_key: keys.publicKey })
          if (error) throw new Error(error.message)
        } else if (keys.publish) {
          const { error } = await supabase.from('users').update({ public_key: keys.publicKey }).eq('id', user.id)
          if (error) throw new Error(error.message)
          if (keys.status === 'created' && row.public_key) {
            setNotice('Kunci enkripsi baru dibuat untuk browser ini. Pesan lama yang dienkripsi dengan kunci sebelumnya tidak dapat dibaca di sini.')
          }
        }

        void supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', user.id)

        if (cancelled) return
        setMe({ id: user.id, display_name: displayName, avatar_url: avatarUrl })
        setStatus('ready')
      } catch (e) {
        if (cancelled) return
        setInitError(e instanceof Error ? e.message : 'Gagal menyiapkan aplikasi.')
        setStatus('error')
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [router, setMe, attempt])

  const handleLogout = useCallback(async () => {
    await leaveRoom()
    clearGroupKeys()
    setMe(null)
    await createClient().auth.signOut()
    router.replace('/')
    router.refresh()
  }, [leaveRoom, router, setMe])

  const isHome = pathname === '/chat'

  if (status !== 'ready') {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        {status === 'loading' ? (
          <>
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-sm">{initStatus}</p>
          </>
        ) : (
          <>
            <ShieldAlert className="size-8 text-destructive" />
            <p className="max-w-sm text-center text-sm text-destructive">{initError}</p>
            <Button onClick={() => setAttempt((n) => n + 1)}>Coba lagi</Button>
          </>
        )}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex h-dvh w-full overflow-hidden bg-background">
        <MainSidebar pathname={pathname} onLogout={handleLogout} />

        <SecondarySidebar className={cn(isHome ? 'flex w-full md:w-72' : 'hidden md:flex md:w-72')} />

        <main className={cn('relative min-w-0 flex-1 flex-col', isHome ? 'hidden md:flex' : 'flex')}>
          {notice && (
            <div className="flex items-start justify-between gap-3 bg-amber-500/15 px-4 py-2 text-xs text-amber-800 dark:text-amber-300">
              <span>{notice}</span>
              <button onClick={() => setNotice(null)} aria-label="Tutup">
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="flex min-h-0 flex-1">{children}</div>
        </main>

        <AddFriendModal />
        <CreateGroupModal />
      </div>
    </TooltipProvider>
  )
}
