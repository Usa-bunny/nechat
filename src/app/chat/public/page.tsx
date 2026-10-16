import React from 'react'
import PublicClientRoom from './public-client-room'

// Memberitahu Next.js agar melewatkan validasi instant navigation shell pada segmen publik ini
export const instant = false;

export default function PublicChatPage() {
  return <PublicClientRoom />
}
