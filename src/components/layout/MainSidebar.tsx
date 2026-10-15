import Link from 'next/link'
import { MessageSquare, Globe, Plus, LogOut } from 'lucide-react'

interface MainSidebarProps {
  pathname: string;
  onLogout: () => void;
  onAddFriend: () => void;
}

export function MainSidebar({ pathname, onLogout, onAddFriend }: MainSidebarProps) {
  return (
    <nav className="w-[72px] h-full bg-zinc-950 flex flex-col items-center py-4 gap-4 flex-shrink-0 z-20">
      <Link href="/chat">
        <div className={`w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all duration-200 flex items-center justify-center group relative ${pathname === '/chat' ? 'bg-blue-600 rounded-[16px]' : 'bg-zinc-800 hover:bg-blue-600 text-zinc-100'}`}>
          <MessageSquare size={24} strokeWidth={1.5} />
          <div className="absolute left-16 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none">
            Direct Messages
          </div>
        </div>
      </Link>

      <div className="w-8 h-[2px] bg-zinc-800 rounded-full my-1"></div>

      <Link href="/chat/public">
        <div className={`w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all duration-200 flex items-center justify-center group relative ${pathname.includes('/public') ? 'bg-green-600 rounded-[16px]' : 'bg-zinc-800 hover:bg-green-600 text-green-500 hover:text-white'}`}>
          <Globe size={24} strokeWidth={1.5} />
          <div className="absolute left-16 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none">
            Public Chat
          </div>
        </div>
      </Link>

      <button onClick={onAddFriend} className="w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all duration-200 bg-zinc-800 hover:bg-green-500 text-green-500 hover:text-white flex items-center justify-center group relative">
        <Plus size={24} strokeWidth={2} />
        <div className="absolute left-16 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none">
          Tambah Teman
        </div>
      </button>

      <div className="flex-1"></div>

      <button onClick={onLogout} className="w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all duration-200 bg-zinc-800 hover:bg-red-500 text-zinc-400 hover:text-white flex items-center justify-center group relative">
        <LogOut size={22} strokeWidth={1.5} />
        <div className="absolute left-16 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none">
          Keluar
        </div>
      </button>
    </nav>
  )
}