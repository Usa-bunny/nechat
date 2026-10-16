import type { NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

// Catatan: pada Next.js 16 file ini diganti namanya menjadi `proxy.ts` (export `proxy`).
export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
