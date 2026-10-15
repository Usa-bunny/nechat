'use client'

import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SecondarySidebar } from '@/components/layout/SecondarySidebar'
import { useChatStore } from '@/store/useChatStore'

export default function ChatDashboardPage() {
  const setAddFriendModalOpen = useChatStore((state) => state.setAddFriendModalOpen)

  const handleOpenAddFriend = () => {
    setAddFriendModalOpen(true)
  }

  return (
    <div className="flex flex-1 h-full">
      {/* Sidebar Daftar Teman */}
      <SecondarySidebar onAddFriend={handleOpenAddFriend} />

      {/* Area Tengah / Layar Sambutan */}
      <div className="flex-1 flex flex-col bg-white items-center justify-center text-center p-8">
        <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <UserPlus size={48} strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Mulai Obrolan Rahasia</h2>
        <p className="text-slate-500 max-w-md mb-8">
          Tambahkan teman dengan mencari username mereka untuk memulai percakapan yang dilindungi End-to-End Encryption.
        </p>
        
        <Button onClick={handleOpenAddFriend} className="bg-blue-600 hover:bg-blue-700 px-8 rounded-full shadow-md">
          Cari Teman Baru
        </Button>
      </div>
    </div>
  )
}
