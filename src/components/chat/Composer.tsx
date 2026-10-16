'use client'

import { useEffect, useRef, useState } from 'react'
import { Paperclip, SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useChatStore } from '@/store/useChatStore'

const ACCEPT = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip'

interface ComposerProps {
  placeholder: string
  onPickFile: (file: File) => void
  disabled?: boolean
}

export function Composer({ placeholder, onPickFile, disabled }: ComposerProps) {
  const sendMessage = useChatStore((s) => s.sendMessage)
  const sendTyping = useChatStore((s) => s.sendTyping)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const typing = useRef(false)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopTyping = () => {
    if (typingTimer.current) clearTimeout(typingTimer.current)
    if (typing.current) {
      typing.current = false
      sendTyping(false)
    }
  }
  useEffect(() => stopTyping, []) // eslint-disable-line react-hooks/exhaustive-deps

  const resize = () => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  const handleChange = (value: string) => {
    setText(value)
    requestAnimationFrame(resize)
    // kirim "mengetik" sekali di awal, bukan tiap tombol (batas rate Supabase Broadcast)
    if (!typing.current) {
      typing.current = true
      sendTyping(true)
    }
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(stopTyping, 2000)
  }

  const submit = async () => {
    const value = text.trim()
    if (!value || disabled) return
    setText('')
    setError(null)
    requestAnimationFrame(resize)
    stopTyping()
    try {
      await sendMessage({ text: value })
    } catch (e) {
      setText(value) // kembalikan teks agar tidak hilang
      setError(e instanceof Error ? e.message : 'Pesan gagal terkirim.')
    }
  }

  return (
    <div className="border-t bg-background p-3 sm:p-4">
      {error && <p className="mb-2 rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">{error}</p>}
      <div className="flex items-end gap-2 rounded-2xl border bg-muted/50 p-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onPickFile(f)
            e.target.value = '' // izinkan memilih file yang sama lagi
          }}
        />
        <Button type="button" variant="ghost" size="icon" className="rounded-full text-muted-foreground" onClick={() => fileRef.current?.click()} disabled={disabled} aria-label="Lampirkan file">
          <Paperclip />
        </Button>

        <Textarea
          ref={areaRef}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void submit()
            }
          }}
          onPaste={(e) => {
            const f = [...e.clipboardData.files][0]
            if (f) {
              e.preventDefault()
              onPickFile(f)
            }
          }}
          className="max-h-40 min-h-9 flex-1 border-none bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />

        <Button type="button" size="icon" className="rounded-full" onClick={() => void submit()} disabled={!text.trim() || disabled} aria-label="Kirim">
          <SendHorizontal />
        </Button>
      </div>
      <p className="mt-1.5 hidden px-2 text-[11px] text-muted-foreground sm:block">Enter untuk kirim · Shift+Enter baris baru · tempel atau seret file untuk melampirkan</p>
    </div>
  )
}
