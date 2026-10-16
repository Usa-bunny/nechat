import React from 'react'
import ChatClientProvider from './chat-client-provider'

// Di sini Next.js bisa mengenali konfigurasi ini dengan aman karena filenya Server Component murni
export const instant = false;

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatClientProvider>
      {children}
    </ChatClientProvider>
  )
}
