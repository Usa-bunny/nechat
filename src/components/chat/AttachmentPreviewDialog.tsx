'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Lock, SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FileTypeIcon } from './AttachmentView'
import { kindFromMime, type UploadProgress } from '@/lib/attachments'
import { useChatStore } from '@/store/useChatStore'
import { formatBytes } from '@/lib/utils'

interface Props {
  file: File | null
  onClose: () => void
  encrypted: boolean
}

/** Pratinjau file / gambar / video sebelum dikirim, lengkap dengan caption dan progress upload. */
export function AttachmentPreviewDialog({ file, onClose, encrypted }: Props) {
  const sendMessage = useChatStore((s) => s.sendMessage)
  const [caption, setCaption] = useState('')
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const kind = file ? kindFromMime(file.type) : 'file'
  const previewUrl = useMemo(() => (file && kind !== 'file' ? URL.createObjectURL(file) : null), [file, kind])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (file) {
      setCaption('')
      setError(null)
      setProgress(null)
      setSending(false)
    }
  }, [file])

  const handleSend = async () => {
    if (!file || sending) return
    setSending(true)
    setError(null)
    try {
      await sendMessage({ text: caption, file, onProgress: setProgress })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim file.')
      setSending(false)
    }
  }

  const label =
    progress?.phase === 'encrypt' ? 'Mengenkripsi...' : progress ? `Mengunggah ${progress.percent}%` : 'Menyiapkan...'

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && !sending && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Kirim lampiran</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            {encrypted ? (
              <>
                <Lock className="size-3.5 text-emerald-600" /> File dienkripsi di perangkatmu sebelum diunggah
              </>
            ) : (
              'Chat publik: file dapat dilihat siapa saja yang punya tautannya'
            )}
          </DialogDescription>
        </DialogHeader>

        {file && (
          <div className="overflow-hidden rounded-lg border bg-muted/40">
            {kind === 'image' && previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={file.name} className="mx-auto max-h-72 w-auto object-contain" />
            )}
            {kind === 'video' && previewUrl && <video src={previewUrl} controls className="mx-auto max-h-72 w-full" />}
            {kind === 'audio' && previewUrl && (
              <div className="p-4">
                <audio src={previewUrl} controls className="w-full" />
              </div>
            )}
            {kind === 'file' && (
              <div className="flex items-center gap-3 p-4">
                <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileTypeIcon mime={file.type} className="size-6" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{file.type || 'File'}</p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between border-t bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 pl-3">{formatBytes(file.size)}</span>
            </div>
          </div>
        )}

        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) void handleSend()
          }}
          placeholder="Tambahkan keterangan (opsional)"
          disabled={sending}
          autoFocus
        />

        {sending && (
          <div className="space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${progress?.phase === 'upload' ? progress.percent : progress ? 5 : 2}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        )}
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Batal
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="animate-spin" /> : <SendHorizontal />} Kirim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
