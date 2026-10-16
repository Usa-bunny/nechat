'use client'

import { useLayoutEffect, useRef } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessageBubble } from './MessageBubble'
import type { ChatMessage } from '@/lib/messages'
import type { Profile } from '@/store/useChatStore'
import { formatDay, sameDay } from '@/lib/utils'

interface MessageListProps {
  messages: ChatMessage[]
  meId: string
  showSender: boolean
  profiles: Record<string, Profile>
  hasMore: boolean
  loading: boolean
  encrypted: boolean
  onLoadOlder: () => Promise<void>
}

const RUN_GAP_MS = 5 * 60 * 1000

export function MessageList({ messages, meId, showSender, profiles, hasMore, loading, encrypted, onLoadOlder }: MessageListProps) {
  const ref = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const prependFrom = useRef<number | null>(null)

  const onScroll = () => {
    const el = ref.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (prependFrom.current !== null) {
      // pesan lama dimuat di atas: pertahankan posisi baca
      el.scrollTop = el.scrollHeight - prependFrom.current
      prependFrom.current = null
      return
    }
    const last = messages[messages.length - 1]
    if (stickToBottom.current || last?.sender_id === meId) el.scrollTop = el.scrollHeight
  }, [messages, meId])

  const loadOlder = async () => {
    prependFrom.current = ref.current?.scrollHeight ?? null
    await onLoadOlder()
  }

  return (
    <div ref={ref} onScroll={onScroll} className="flex-1 overflow-y-auto bg-muted/30 px-3 py-4 sm:px-6">
      {encrypted && (
        <div className="mx-auto mb-4 flex max-w-sm items-center justify-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-center text-xs text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="size-3.5 shrink-0" />
          Pesan & file dienkripsi end-to-end
        </div>
      )}

      {hasMore && (
        <div className="mb-2 flex justify-center">
          <Button variant="ghost" size="sm" onClick={loadOlder} disabled={loading}>
            {loading && <Loader2 className="animate-spin" />} Muat pesan sebelumnya
          </Button>
        </div>
      )}

      {loading && messages.length === 0 && (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      )}

      {!loading && messages.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Belum ada pesan. Sapa duluan 👋</p>
      )}

      {messages.map((msg, i) => {
        const prev = messages[i - 1]
        const newDay = !prev || !sameDay(prev.created_at, msg.created_at)
        const isFirstInRun =
          newDay ||
          prev.sender_id !== msg.sender_id ||
          new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > RUN_GAP_MS

        return (
          <div key={msg.id}>
            {newDay && (
              <div className="my-4 flex justify-center">
                <span className="rounded-full bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                  {formatDay(msg.created_at)}
                </span>
              </div>
            )}
            <MessageBubble
              msg={msg}
              mine={msg.sender_id === meId}
              showSender={showSender}
              isFirstInRun={isFirstInRun}
              sender={profiles[msg.sender_id]}
            />
          </div>
        )
      })}
    </div>
  )
}
