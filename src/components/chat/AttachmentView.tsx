'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, File as FileIcon, FileArchive, FileText, Loader2, Lock, Play, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { kindFromUrl, loadAttachment, type AttachmentEnvelope } from '@/lib/attachments'
import type { MediaRef } from '@/lib/messages'
import { cn, formatBytes } from '@/lib/utils'

export function FileTypeIcon({ mime, className }: { mime: string; className?: string }) {
  if (/zip|rar|7z|tar|gzip/.test(mime)) return <FileArchive className={className} />
  if (/pdf|word|text|sheet|excel|presentation|powerpoint|csv/.test(mime)) return <FileText className={className} />
  return <FileIcon className={className} />
}

function triggerDownload(url: string, name: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function ImageLightbox({ src, name, open, onOpenChange }: { src: string; name: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-3 bg-black/90 p-3 text-white">
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <DialogDescription className="sr-only">Pratinjau gambar</DialogDescription>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} className="mx-auto max-h-[75dvh] w-auto rounded-md object-contain" />
        <div className="flex items-center justify-between gap-3 pr-8 text-sm">
          <span className="truncate text-white/80">{name}</span>
          <Button size="sm" variant="secondary" onClick={() => triggerDownload(src, name)}>
            <Download /> Unduh
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Lampiran terenkripsi: diunduh + didekripsi di browser. Gambar otomatis, video/audio/file saat diminta. */
function EncryptedAttachment({ env }: { env: AttachmentEnvelope }) {
  const [url, setUrl] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>(env.kind === 'image' ? 'loading' : 'idle')
  const [lightbox, setLightbox] = useState(false)

  const load = useCallback(async () => {
    setState('loading')
    try {
      setUrl(await loadAttachment(env))
      setState('idle')
      return true
    } catch {
      setState('error')
      return false
    }
  }, [env])

  useEffect(() => {
    if (env.kind === 'image') void load()
  }, [env.kind, load])

  if (state === 'error') {
    return (
      <button
        onClick={() => void load()}
        className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
      >
        <RotateCw className="size-3.5" /> Gagal memuat lampiran. Coba lagi
      </button>
    )
  }

  if (env.kind === 'image') {
    if (!url) return <Skeleton className="h-44 w-60 max-w-full" />
    return (
      <>
        <button onClick={() => setLightbox(true)} className="block overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={env.name} className="max-h-72 max-w-full rounded-lg object-cover" />
        </button>
        <ImageLightbox src={url} name={env.name} open={lightbox} onOpenChange={setLightbox} />
      </>
    )
  }

  if (env.kind === 'video' && url) return <video src={url} controls className="max-h-80 max-w-full rounded-lg" />
  if (env.kind === 'audio' && url) return <audio src={url} controls className="max-w-full" />

  const isMedia = env.kind === 'video' || env.kind === 'audio'
  return (
    <div className="flex min-w-56 max-w-full items-center gap-3 rounded-lg border bg-background/60 p-2.5 text-foreground">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {isMedia ? <Play className="size-5" /> : <FileTypeIcon mime={env.mime} className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{env.name}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" /> {formatBytes(env.size)}
        </p>
      </div>
      <Button
        size="icon-sm"
        variant="outline"
        disabled={state === 'loading'}
        aria-label={isMedia ? 'Muat media' : 'Unduh file'}
        onClick={async () => {
          const objectUrl = url ?? (await loadAttachment(env).catch(() => null))
          if (!objectUrl) return setState('error')
          if (isMedia) setUrl(objectUrl)
          else triggerDownload(objectUrl, env.name)
        }}
      >
        {state === 'loading' ? <Loader2 className="animate-spin" /> : isMedia ? <Play /> : <Download />}
      </Button>
    </div>
  )
}

/** Lampiran chat publik (tidak terenkripsi): URL Cloudinary langsung. */
function PlainAttachment({ url }: { url: string }) {
  const [lightbox, setLightbox] = useState(false)
  const kind = kindFromUrl(url)
  const name = decodeURIComponent(url.split('?')[0].split('/').pop() ?? 'file')

  if (kind === 'image') {
    return (
      <>
        <button onClick={() => setLightbox(true)} className="block overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} loading="lazy" className="max-h-72 max-w-full rounded-lg object-cover" />
        </button>
        <ImageLightbox src={url} name={name} open={lightbox} onOpenChange={setLightbox} />
      </>
    )
  }
  if (kind === 'video') return <video src={url} controls preload="metadata" className="max-h-80 max-w-full rounded-lg" />
  if (kind === 'audio') return <audio src={url} controls className="max-w-full" />
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-56 items-center gap-3 rounded-lg border bg-background/60 p-2.5 text-foreground hover:bg-background"
    >
      <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <FileIcon className="size-5" />
      </div>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
      <Download className="size-4 text-muted-foreground" />
    </a>
  )
}

export function AttachmentView({ media, className }: { media: MediaRef; className?: string }) {
  return (
    <div className={cn('max-w-full', className)}>
      {media.type === 'encrypted' ? <EncryptedAttachment env={media.envelope} /> : <PlainAttachment url={media.url} />}
    </div>
  )
}
