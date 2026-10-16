import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Refresh sesi Supabase di setiap request + proteksi route /chat di sisi server. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  // getUser() memvalidasi token ke server Auth (getSession() hanya membaca cookie -> tidak aman untuk proteksi).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''
    const redirect = NextResponse.redirect(url)
    // bawa cookie sesi yang baru di-refresh
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  if (!user && pathname.startsWith('/chat')) return redirectTo('/')
  if (user && pathname === '/') return redirectTo('/chat')

  return response
}
