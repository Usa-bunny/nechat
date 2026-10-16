import { Globe, Lock, MessageSquare, PhoneCall, Users } from 'lucide-react'
import { LoginButton } from '@/components/LoginButton'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

// Pengguna yang sudah login dialihkan ke /chat oleh middleware, jadi halaman ini tidak perlu cek sesi di klien.
const features = [
  { icon: Lock, title: 'End-to-End Encryption', color: 'text-emerald-600 bg-emerald-500/10', text: 'Kunci privat tidak pernah meninggalkan browsermu. Pesan dan file di DM maupun grup dienkripsi sebelum dikirim.' },
  { icon: Users, title: 'Grup Terenkripsi', color: 'text-blue-600 bg-blue-500/10', text: 'Buat grup, undang teman, dan ngobrol bersama. Kunci grup hanya dibagikan ke anggota.' },
  { icon: PhoneCall, title: 'Telepon Suara P2P', color: 'text-orange-600 bg-orange-500/10', text: 'Telepon langsung antar-peserta dengan WebRTC, tanpa audio melewati server kami.' },
  { icon: Globe, title: 'Chat Publik', color: 'text-purple-600 bg-purple-500/10', text: 'Ruang global untuk bertemu orang baru. Pesan di ruang ini bersifat publik dan tidak dienkripsi.' },
]

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams

  return (
    <div className="min-h-dvh bg-background text-foreground selection:bg-primary/20">
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b bg-background/80 px-5 py-3 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageSquare className="size-4" />
          </div>
          <span className="text-xl font-bold tracking-tight">Nechat</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LoginButton label="Masuk" className="rounded-full px-5" />
        </div>
      </nav>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-20 pb-14 text-center sm:pt-28">
        {error && (
          <p className="mb-6 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
            Login gagal. Silakan coba lagi.
          </p>
        )}
        <h1 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
          Ngobrol cepat, aman, dan <span className="text-primary">privat.</span>
        </h1>
        <p className="mb-10 max-w-xl leading-relaxed text-muted-foreground">
          Nechat memadukan antarmuka modern dengan enkripsi end-to-end: pesan, file, dan grup hanya bisa dibaca oleh peserta percakapan. Gratis.
        </p>
        <LoginButton size="lg" withIcon label="Lanjutkan dengan Google" className="h-12 rounded-full bg-foreground px-8 text-base text-background shadow-xl hover:bg-foreground/90" />
      </main>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-5 pb-16 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, title, color, text }) => (
          <div key={title} className="rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className={`mb-4 flex size-12 items-center justify-center rounded-xl ${color}`}>
              <Icon className="size-6" strokeWidth={1.5} />
            </div>
            <h3 className="mb-2 font-bold">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">Dirancang & dibangun oleh Usagi. © 2026 Nechat.</footer>
    </div>
  )
}
