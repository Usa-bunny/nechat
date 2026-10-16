'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { safetyNumber } from '@/lib/crypto'

interface Props {
  myPublicKey: string
  theirPublicKey: string
  friendName: string
}

/** Kode verifikasi: kalau angkanya sama di kedua perangkat, tidak ada pihak ketiga (termasuk server) di tengah. */
export function SafetyNumberDialog({ myPublicKey, theirPublicKey, friendName }: Props) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')

  useEffect(() => {
    if (open) void safetyNumber(myPublicKey, theirPublicKey).then(setCode)
  }, [open, myPublicKey, theirPublicKey])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 text-[11px] font-medium tracking-wide text-emerald-600 uppercase hover:underline dark:text-emerald-400">
          <ShieldCheck className="size-3" /> E2EE aktif · verifikasi
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verifikasi enkripsi</DialogTitle>
          <DialogDescription>
            Bandingkan kode ini dengan milik {friendName} lewat jalur lain (tatap muka atau telepon). Jika sama, percakapan kalian
            terlindungi dari penyadapan.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/50 p-4 text-center font-mono text-lg leading-relaxed tracking-wider break-words">
          {code || '...'}
        </div>
      </DialogContent>
    </Dialog>
  )
}
