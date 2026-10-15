import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useChatStore } from '@/store/useChatStore'
import { Search, X, User as UserIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function AddFriendModal() {
  const isOpen = useChatStore((state) => state.isAddFriendModalOpen)
  const setOpen = useChatStore((state) => state.setAddFriendModalOpen)
  
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  // Reset pencarian tiap kali modal dibuka & ambil ID kita sendiri
  useEffect(() => {
    if (isOpen) {
      supabase.auth.getUser().then(({ data }) => {
        setCurrentUserId(data.user?.id || null)
      })
      setQuery('')
      setResults([])
    }
  }, [isOpen, supabase])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || !currentUserId) return

    setIsSearching(true)
    
    // Cari user berdasarkan display_name (case-insensitive = ilike)
    // dan pastikan kita tidak mencari diri kita sendiri (neq)
    const { data, error } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .ilike('display_name', `%${query}%`)
      .neq('id', currentUserId)
      .limit(10)

    if (!error && data) {
      setResults(data)
    }
    setIsSearching(false)
  }

  const handleStartChat = (friendId: string) => {
    setOpen(false) // Tutup modal
    router.push(`/chat/dm/${friendId}`) // Arahkan ke ruang DM teman tersebut
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100">
          <h2 className="font-bold text-lg text-slate-800">Cari Teman Baru</h2>
          <button 
            onClick={() => setOpen(false)} 
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ketik username teman..."
                className="pl-10 bg-slate-50 border-slate-200"
              />
            </div>
            <Button type="submit" disabled={isSearching} className="bg-blue-600 hover:bg-blue-700">
              {isSearching ? 'Mencari...' : 'Cari'}
            </Button>
          </form>

          {/* Hasil Pencarian */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {results.length === 0 && query && !isSearching && (
              <div className="text-center text-slate-500 py-6 text-sm">
                Tidak ditemukan pengguna dengan nama tersebut.
              </div>
            )}
            
            {results.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 overflow-hidden shadow-inner">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={20} />
                    )}
                  </div>
                  <span className="font-medium text-slate-700">{user.display_name}</span>
                </div>
                <Button 
                  onClick={() => handleStartChat(user.id)} 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700 rounded-full font-medium shadow-sm"
                >
                  Chat DM
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}