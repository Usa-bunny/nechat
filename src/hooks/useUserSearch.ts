import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { escapeLike } from '@/lib/utils'
import type { Profile } from '@/store/useChatStore'

/** Pencarian user (debounce 300 ms), mengecualikan id tertentu. */
export function useUserSearch(query: string, excludeIds: string[], enabled = true) {
  const [results, setResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const excludeKey = excludeIds.join(',')

  useEffect(() => {
    const q = query.trim()
    if (!enabled || q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      let req = createClient()
        .from('users')
        .select('id, display_name, avatar_url')
        .ilike('display_name', `%${escapeLike(q)}%`)
        .limit(10)
      for (const id of excludeKey.split(',').filter(Boolean)) req = req.neq('id', id)
      const { data } = await req
      if (!cancelled) {
        setResults((data ?? []) as Profile[])
        setLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, excludeKey, enabled])

  return { results, loading }
}
