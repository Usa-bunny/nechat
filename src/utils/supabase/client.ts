import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

let client: SupabaseClient | undefined

// Satu instance per tab (stabil sebagai dependency React & tidak membuat koneksi realtime ganda).
export const createClient = (): SupabaseClient => (client ??= createBrowserClient(supabaseUrl!, supabaseKey!))
