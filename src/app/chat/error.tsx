'use client'

import { Button } from '@/components/ui/button'

export default function ChatError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="font-semibold">Terjadi kesalahan</p>
      <p className="max-w-sm text-sm text-muted-foreground">{error.message || 'Halaman ini gagal dimuat.'}</p>
      <Button onClick={reset}>Coba lagi</Button>
    </div>
  )
}
