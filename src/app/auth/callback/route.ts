import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

// Cegah open-redirect: `next` hanya boleh path internal ("/chat"), bukan "//evil.com" atau "https://...".
function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/chat'
  return value
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = createClient(await cookies())
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Di balik reverse proxy / Vercel, origin asli ada di x-forwarded-host.
      const forwardedHost = request.headers.get('x-forwarded-host')
      if (process.env.NODE_ENV !== 'development' && forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_failed`)
}
