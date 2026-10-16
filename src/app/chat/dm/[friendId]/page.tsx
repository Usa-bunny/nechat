import React from 'react'
import DmClientRoom from './dm-client-room'

// Berhasil dibaca karena file ini adalah modul Server Component murni tanpa 'use client'
export const instant = false;

interface DirectMessagePageProps {
  params: Promise<{ friendId: string }>
}

export default async function DirectMessagePage({ params }: DirectMessagePageProps) {
  const { friendId } = await params;

  return <DmClientRoom friendId={friendId} />
}
