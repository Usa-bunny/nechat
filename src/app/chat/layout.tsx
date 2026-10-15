'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { generateKeyPair, exportPublicKey } from '@/lib/crypto'
import { savePrivateKey, getPrivateKey } from '@/lib/keyStore'
import { MainSidebar } from '@/components/layout/MainSidebar'
import { AddFriendModal } from '@/components/chat/AddFriendModal'
import { useChatStore } from '@/store/useChatStore'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true)
  const [initStatus, setInitStatus] = useState('Memeriksa sesi...')
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  
  // Mengambil fungsi dari Zustand untuk membuka modal tambah teman
  const setAddFriendModalOpen = useChatStore((state) => state.setAddFriendModalOpen)

  useEffect(() => {
    const initializeApp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }

      setInitStatus('Memeriksa Kunci Keamanan E2EE...')
      
      const privKey = await getPrivateKey()
      const { data: dbUser } = await supabase
        .from('users')
        .select('public_key')
        .eq('id', user.id)
        .single()

      if (!dbUser?.public_key || !privKey) {
        setInitStatus('Membuat Kunci Keamanan Baru (ECDH)...')
        const keyPair = await generateKeyPair()
        await savePrivateKey(keyPair.privateKey)
        const exportedPublic = await exportPublicKey(keyPair.publicKey)
        
        await supabase
          .from('users')
          .update({ public_key: exportedPublic })
          .eq('id', user.id)
      }
      
      setIsInitializing(false)
    }

    initializeApp()
  }, [router, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleOpenAddFriend = () => {
    setAddFriendModalOpen(true)
  }

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden font-sans">
      {/* Sidebar Navigasi Utama (Kiri) */}
      <MainSidebar 
        pathname={pathname} 
        onLogout={handleLogout} 
        onAddFriend={handleOpenAddFriend} 
      />

      {/* Area Konten Utama */}
      <main className="flex-1 flex overflow-hidden bg-white relative">
        {/* Loading Overlay */}
        {isInitializing && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-900 text-zinc-100">
            <div className="animate-spin mb-4 w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            <div className="text-sm font-medium text-zinc-400">{initStatus}</div>
          </div>
        )}
        
        {children}
      </main>

      {/* Komponen Modal (Hanya muncul jika state isOpen = true) */}
      <AddFriendModal />
    </div>
  )
}