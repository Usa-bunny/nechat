'use client'

import Link from 'next/link'
import { Globe, LogOut, MessageSquare, UserPlus, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { UserAvatar } from '@/components/chat/UserAvatar'
import { ThemeToggle } from './ThemeToggle'
import { useChatStore } from '@/store/useChatStore'
import { cn } from '@/lib/utils'

interface MainSidebarProps {
  pathname: string
  onLogout: () => void
}

function RailItem({ label, active, href, onClick, children, danger }: {
  label: string
  active?: boolean
  href?: string
  onClick?: () => void
  children: ReactNode
  danger?: boolean
}) {
  const cls = cn(
    'flex size-11 items-center justify-center rounded-3xl text-muted-foreground transition-all duration-200 hover:rounded-2xl',
    active ? 'rounded-2xl bg-primary text-primary-foreground' : danger ? 'bg-muted hover:bg-destructive hover:text-white' : 'bg-muted hover:bg-primary hover:text-primary-foreground',
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Link href={href} className={cls} aria-label={label}>
            {children}
          </Link>
        ) : (
          <button onClick={onClick} className={cls} aria-label={label}>
            {children}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export function MainSidebar({ pathname, onLogout }: MainSidebarProps) {
  const me = useChatStore((s) => s.me)
  const setAddFriendOpen = useChatStore((s) => s.setAddFriendModalOpen)
  const setCreateGroupOpen = useChatStore((s) => s.setCreateGroupModalOpen)
  const isPublic = pathname.startsWith('/chat/public')

  return (
    <nav className="z-20 flex h-full w-16 shrink-0 flex-col items-center gap-3 border-r bg-sidebar py-4 text-sidebar-foreground">
      <RailItem label="Obrolan" href="/chat" active={!isPublic}>
        <MessageSquare className="size-5" />
      </RailItem>
      <RailItem label="Chat Publik" href="/chat/public" active={isPublic}>
        <Globe className="size-5" />
      </RailItem>

      <div className="my-1 h-px w-8 bg-border" />

      <RailItem label="Cari teman" onClick={() => setAddFriendOpen(true)}>
        <UserPlus className="size-5" />
      </RailItem>
      <RailItem label="Buat grup" onClick={() => setCreateGroupOpen(true)}>
        <Users className="size-5" />
      </RailItem>

      <div className="flex-1" />

      <ThemeToggle className="rounded-full text-muted-foreground" />
      {me && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <UserAvatar name={me.display_name} src={me.avatar_url} className="size-9" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">{me.display_name}</TooltipContent>
        </Tooltip>
      )}
      <RailItem label="Keluar" onClick={onLogout} danger>
        <LogOut className="size-5" />
      </RailItem>
    </nav>
  )
}
