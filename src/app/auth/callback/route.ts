import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers' // 1. Import cookies

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    // 2. Ambil cookieStore dan masukkan sebagai argumen
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore) 
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }
  
  // Jika gagal, kembalikan ke home dengan parameter error
  return NextResponse.redirect(`${origin}/?error=auth_failed`)
}