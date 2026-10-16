import { AlertTriangle } from 'lucide-react'
import { AttachmentView } from './AttachmentView'
import { UserAvatar } from './UserAvatar'
import type { ChatMessage } from '@/lib/messages'
import type { Profile } from '@/store/useChatStore'
import { cn, formatTime } from '@/lib/utils'

interface MessageBubbleProps {
  msg: ChatMessage
  mine: boolean
  /** tampilkan nama + avatar pengirim (grup / chat publik) */
  showSender: boolean
  /** pesan pertama dari satu rangkaian pengirim yang sama */
  isFirstInRun: boolean
  sender?: Profile
}

export function MessageBubble({ msg, mine, showSender, isFirstInRun, sender }: MessageBubbleProps) {
  const name = sender?.display_name ?? 'Pengguna'
  const sideAvatar = showSender && !mine

  return (
    <div className={cn('flex items-end gap-2', mine ? 'justify-end' : 'justify-start', isFirstInRun ? 'mt-3' : 'mt-0.5')}>
      {sideAvatar && (
        <div className="w-7 shrink-0">
          {isFirstInRun && <UserAvatar name={name} src={sender?.avatar_url} className="size-7" />}
        </div>
      )}

      <div className={cn('flex max-w-[82%] flex-col sm:max-w-[70%]', mine ? 'items-end' : 'items-start')}>
        {sideAvatar && isFirstInRun && <span className="mb-0.5 px-1 text-xs font-medium text-muted-foreground">{name}</span>}

        <div
          className={cn(
            'min-w-0 space-y-2 rounded-2xl px-3 py-2 shadow-sm',
            mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border bg-card text-card-foreground',
            msg.failed && 'border-destructive/40',
          )}
        >
          {msg.media && <AttachmentView media={msg.media} />}
          {msg.content && (
            <p className={cn('text-sm leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap', msg.failed && 'flex items-center gap-1.5 italic opacity-80')}>
              {msg.failed && <AlertTriangle className="size-3.5 shrink-0" />}
              {msg.content}
            </p>
          )}
          <p className={cn('text-right text-[10px] leading-none', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
            {formatTime(msg.created_at)}
          </p>
        </div>
      </div>
    </div>
  )
}
