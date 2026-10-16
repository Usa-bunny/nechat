import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CallStatus } from '@/hooks/useVoiceCall'

interface CallBarProps {
  status: CallStatus
  friendName: string
  muted: boolean
  error: string | null
  onAccept: () => void
  onReject: () => void
  onEnd: () => void
  onToggleMute: () => void
}

export function CallBar({ status, friendName, muted, error, onAccept, onReject, onEnd, onToggleMute }: CallBarProps) {
  if (status === 'idle') {
    return error ? <div className="bg-destructive/10 px-4 py-1.5 text-center text-xs text-destructive">{error}</div> : null
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-emerald-600 px-4 py-2 text-sm text-white">
      <div className="flex items-center gap-2">
        <Phone className={status === 'connected' ? 'size-4' : 'size-4 animate-pulse'} />
        <span>
          {status === 'calling' && `Memanggil ${friendName}...`}
          {status === 'ringing' && `${friendName} menelepon`}
          {status === 'connected' && `Terhubung dengan ${friendName}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {status === 'ringing' ? (
          <>
            <Button size="sm" variant="secondary" onClick={onAccept}>
              Terima
            </Button>
            <Button size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={onReject}>
              Tolak
            </Button>
          </>
        ) : (
          <>
            {status === 'connected' && (
              <Button size="icon-sm" variant="secondary" onClick={onToggleMute} aria-label={muted ? 'Aktifkan mikrofon' : 'Bisukan mikrofon'}>
                {muted ? <MicOff /> : <Mic />}
              </Button>
            )}
            <Button size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={onEnd}>
              <PhoneOff /> {status === 'calling' ? 'Batal' : 'Tutup'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
