import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, initials } from '@/lib/utils'
import { Users } from 'lucide-react'

interface UserAvatarProps {
  name: string
  src?: string | null
  online?: boolean
  group?: boolean
  className?: string
}

export function UserAvatar({ name, src, online, group, className }: UserAvatarProps) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar className={className}>
        {src && <AvatarImage src={src} alt={name} referrerPolicy="no-referrer" />}
        <AvatarFallback className={cn(group && 'bg-primary/10 text-primary')}>
          {group ? <Users className="size-1/2" /> : initials(name)}
        </AvatarFallback>
      </Avatar>
      {online !== undefined && (
        <span
          className={cn(
            'absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-background',
            online ? 'bg-emerald-500' : 'bg-muted-foreground/40',
          )}
        />
      )}
    </span>
  )
}
