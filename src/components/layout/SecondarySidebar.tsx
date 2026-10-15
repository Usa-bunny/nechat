'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Search, User as UserIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { createClient } from '@/utils/supabase/client'

interface FriendProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface SecondarySidebarProps {
  onAddFriend: () => void;
}

export function SecondarySidebar({ onAddFriend }: SecondarySidebarProps) {
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    const fetchChatHistory = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      // 1. Ambil riwayat chat (Hanya ID pengirim & penerima) untuk memperingan beban
      const { data: dms, error } = await supabase
        .from('direct_messages')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (dms && dms.length > 0 && !error) {
        // 2. Kumpulkan ID teman (buang ID kita sendiri) dan hapus duplikat (Set)
        const uniqueFriendIds = Array.from(new Set(
          dms.map(dm => dm.sender_id === user.id ? dm.receiver_id : dm.sender_id)
        ))

        // 3. Ambil informasi nama & foto profil dari tabel users
        if (uniqueFriendIds.length > 0) {
          const { data: profiles } = await supabase
            .from('users')
            .select('id, display_name, avatar_url')
            .in('id', uniqueFriendIds)

          if (profiles) {
            // Urutkan profil teman berdasarkan urutan chat terbaru
            const sortedProfiles = uniqueFriendIds
              .map(id => profiles.find(p => p.id === id))
              .filter(Boolean) as FriendProfile[]
              
            setFriends(sortedProfiles)
          }
        }
      }
      setIsLoading(false)
    }

    fetchChatHistory()
  }, [])

  return (
    <aside className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col h-full hidden md:flex">
      {/* Tombol Header */}
      <div className="h-14 border-b border-slate-200 flex items-center px-4 shadow-sm bg-slate-50/80 backdrop-blur-sm z-10 sticky top-0">
        <button 
          onClick={onAddFriend}
          className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-100 text-sm font-medium py-1.5 rounded-md shadow-sm transition-colors text-slate-700"
        >
          <UserPlus size={16} />
          Cari Teman Baru
        </button>
      </div>
      
      <div className="p-3 flex-1 overflow-y-auto">
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <Input type="text" placeholder="Cari obrolan..." className="pl-8 h-8 text-xs bg-slate-100 border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-400 shadow-inner" />
        </div>

        <div className="text-xs font-bold text-slate-500 mb-3 px-2 uppercase tracking-wider">Direct Messages</div>
        
        {/* Render Daftar Teman */}
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-pulse w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : friends.length === 0 ? (
          <div className="text-xs text-slate-400 text-center mt-10 px-4">
            Belum ada riwayat obrolan. Mulai cari teman baru!
          </div>
        ) : (
          <div className="space-y-1">
            {friends.map((friend) => {
              const isActive = pathname === `/chat/dm/${friend.id}`
              return (
                <Link key={friend.id} href={`/chat/dm/${friend.id}`}>
                  <div className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    isActive ? 'bg-slate-200 text-slate-900 font-medium' : 'hover:bg-slate-200/50 text-slate-700'
                  }`}>
                    {/* Foto Profil */}
                    <div className="w-8 h-8 rounded-full bg-slate-300 overflow-hidden flex items-center justify-center text-slate-500 shadow-inner flex-shrink-0">
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt={friend.display_name} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon size={16} />
                      )}
                    </div>
                    {/* Nama Teman */}
                    <div className="truncate text-sm">
                      {friend.display_name}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}