import React from 'react'
import GroupClientRoom from './group-client-room'

// Konfigurasi server Next.js 16 untuk menonaktifkan pengecekan static shell secara paksa
export const instant = false;

interface GroupChatPageProps {
  params: Promise<{ groupId: string }>
}

export default async function GroupChatPage({ params }: GroupChatPageProps) {
  const { groupId } = await params;

  return <GroupClientRoom groupId={groupId} />
}
