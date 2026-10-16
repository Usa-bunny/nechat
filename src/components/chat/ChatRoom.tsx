'use client'

import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Composer } from './Composer'
import { MessageList } from './MessageList'
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog'
import { validateFile } from '@/lib/attachments'
import { useChatStore } from '@/store/useChatStore'

interface ChatRoomProps {
  header: ReactNode
  placeholder: string
  encrypted: boolean
  /** tampilkan nama & avatar pengirim (grup / publik) */
  showSender?: boolean
}

/** Kerangka satu ruang obrolan: header, daftar pesan, indikator mengetik, composer, preview lampiran. */
export function ChatRoom({ header, placeholder, encrypted, showSender = false }: ChatRoomProps) {
  const me = useChatStore((s) => s.me)
  const messages = useChatStore((s) => s.messages)
  const hasMore = useChatStore((s) => s.hasMore)
  const loading = useChatStore((s) => s.isLoadingHistory)
  const loadOlder = useChatStore((s) => s.loadOlder)
  const profiles = useChatStore((s) => s.profiles)
  const typingUsers = useChatStore((s) => s.typingUsers)

  const [attachment, setAttachment] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const pickFile = (file: File) => {
    const problem = validateFile(file)
    setFileError(problem)
    if (!problem) setAttachment(file)
  }

  const typingNames = Object.entries(typingUsers)
    .filter(([id, on]) => on && id !== me?.id)
    .map(([id]) => profiles[id]?.display_name ?? 'Seseorang')

  if (!me) return null

  return (
    <div
      className="relative flex h-full w-full flex-col bg-background"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) pickFile(f)
      }}
    >
      {header}

      <MessageList
        messages={messages}
        meId={me.id}
        showSender={showSender}
        profiles={profiles}
        hasMore={hasMore}
        loading={loading}
        encrypted={encrypted}
        onLoadOlder={loadOlder}
      />

      <div className="h-6 shrink-0 bg-muted/30 px-6 text-xs text-muted-foreground">
        {typingNames.length > 0 &&
          (typingNames.length === 1 ? `${typingNames[0]} sedang mengetik...` : `${typingNames.length} orang sedang mengetik...`)}
      </div>

      {fileError && (
        <div className="flex items-center justify-between gap-2 border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {fileError}
          <button onClick={() => setFileError(null)} aria-label="Tutup">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <Composer placeholder={placeholder} onPickFile={pickFile} />

      <AttachmentPreviewDialog file={attachment} onClose={() => setAttachment(null)} encrypted={encrypted} />

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-primary backdrop-blur-[1px]">
          Lepaskan file untuk melampirkan
        </div>
      )}
    </div>
  )
}
