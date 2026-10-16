import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import { encryptMessage } from '@/lib/crypto'
import { decodeRow, type ChatMessage, type MessageRow } from '@/lib/messages'
import { encryptAndUpload, rememberLocalFile, type UploadProgress } from '@/lib/attachments'
import { uploadToCloudinary } from '@/lib/cloudinary'

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
}

export type RoomConfig =
  | { type: 'public'; userId: string }
  | { type: 'dm'; userId: string; friendId: string; key: CryptoKey }
  | { type: 'group'; userId: string; groupId: string; key: CryptoKey }

export interface SendInput {
  text: string
  file?: File | null
  onProgress?: (p: UploadProgress) => void
}

const PAGE_SIZE = 40

const roomName = (cfg: RoomConfig) =>
  cfg.type === 'public'
    ? 'public'
    : cfg.type === 'dm'
      ? `dm:${[cfg.userId, cfg.friendId].sort().join(':')}`
      : `group:${cfg.groupId}`

const keyOf = (cfg: RoomConfig) => (cfg.type === 'public' ? undefined : cfg.key)

// ---- State modul (di luar store agar tidak memicu render) ----
let joinCounter = 0 // membatalkan join yang sudah usang (mis. React StrictMode / pindah room cepat)
let removal: Promise<unknown> = Promise.resolve() // channel lama harus benar-benar lepas sebelum yang baru dibuat
const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {}

async function fetchPage(cfg: RoomConfig, before?: string): Promise<MessageRow[]> {
  const supabase = createClient()

  if (cfg.type === 'public') {
    let q = supabase.from('public_messages').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE)
    if (before) q = q.lt('created_at', before)
    const { data } = await q
    return (data ?? []) as MessageRow[]
  }

  if (cfg.type === 'dm') {
    const { userId: u, friendId: f } = cfg
    let q = supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${u},receiver_id.eq.${f}),and(sender_id.eq.${f},receiver_id.eq.${u})`)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (before) q = q.lt('created_at', before)
    const { data } = await q
    return (data ?? []) as MessageRow[]
  }

  let q = supabase
    .from('group_messages')
    .select('*')
    .eq('group_id', cfg.groupId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)
  if (before) q = q.lt('created_at', before)
  const { data } = await q
  return (data ?? []) as MessageRow[]
}

function mergeMessages(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>()
  for (const m of [...a, ...b]) map.set(m.id, m)
  return [...map.values()].sort((x, y) => x.created_at.localeCompare(y.created_at))
}

interface ChatState {
  me: Profile | null
  setMe: (me: Profile | null) => void

  activeRoom: string | null
  activeConfig: RoomConfig | null
  activeChannel: RealtimeChannel | null
  channelReady: boolean

  messages: ChatMessage[]
  hasMore: boolean
  isLoadingHistory: boolean
  onlineUsers: Record<string, boolean>
  typingUsers: Record<string, boolean>
  profiles: Record<string, Profile>

  isAddFriendModalOpen: boolean
  setAddFriendModalOpen: (open: boolean) => void
  isCreateGroupModalOpen: boolean
  setCreateGroupModalOpen: (open: boolean) => void
  conversationsVersion: number
  bumpConversations: () => void

  addMessage: (msg: ChatMessage) => void
  ensureProfiles: (ids: string[]) => Promise<void>
  joinRoom: (cfg: RoomConfig) => Promise<void>
  leaveRoom: () => Promise<void>
  loadOlder: () => Promise<void>
  sendMessage: (input: SendInput) => Promise<void>
  sendTyping: (isTyping: boolean) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  me: null,
  setMe: (me) => set((s) => ({ me, profiles: me ? { ...s.profiles, [me.id]: me } : s.profiles })),

  activeRoom: null,
  activeConfig: null,
  activeChannel: null,
  channelReady: false,

  messages: [],
  hasMore: false,
  isLoadingHistory: false,
  onlineUsers: {},
  typingUsers: {},
  profiles: {},

  isAddFriendModalOpen: false,
  setAddFriendModalOpen: (open) => set({ isAddFriendModalOpen: open }),
  isCreateGroupModalOpen: false,
  setCreateGroupModalOpen: (open) => set({ isCreateGroupModalOpen: open }),
  conversationsVersion: 0,
  bumpConversations: () => set((s) => ({ conversationsVersion: s.conversationsVersion + 1 })),

  addMessage: (msg) =>
    set((s) => (s.messages.some((m) => m.id === msg.id) ? s : { messages: [...s.messages, msg] })),

  ensureProfiles: async (ids) => {
    const known = get().profiles
    const missing = [...new Set(ids)].filter((id) => !known[id])
    if (missing.length === 0) return
    const { data } = await createClient().from('users').select('id, display_name, avatar_url').in('id', missing)
    if (!data?.length) return
    set((s) => ({
      profiles: { ...s.profiles, ...Object.fromEntries((data as Profile[]).map((p) => [p.id, p])) },
    }))
  },

  joinRoom: async (cfg) => {
    const supabase = createClient()
    const token = ++joinCounter

    // lepas channel sebelumnya (HANYA channel milik room, bukan removeAllChannels seperti sebelumnya)
    const prev = get().activeChannel
    if (prev) removal = removal.then(() => supabase.removeChannel(prev))
    await removal
    if (token !== joinCounter) return

    const room = roomName(cfg)
    const key = keyOf(cfg)
    set({
      activeRoom: room,
      activeConfig: cfg,
      activeChannel: null,
      channelReady: false,
      messages: [],
      hasMore: false,
      isLoadingHistory: true,
      onlineUsers: {},
      typingUsers: {},
    })

    const onInsert = async (row: MessageRow) => {
      if (get().activeRoom !== room) return
      if (cfg.type === 'dm') {
        const a = row.sender_id === cfg.userId && row.receiver_id === cfg.friendId
        const b = row.sender_id === cfg.friendId && row.receiver_id === cfg.userId
        if (!a && !b) return // pesan percakapan lain
      }
      const msg = await decodeRow(row, key)
      if (get().activeRoom !== room) return
      get().addMessage(msg)
      void get().ensureProfiles([msg.sender_id])
    }

    const channel = supabase.channel(`room:${room}`, { config: { presence: { key: cfg.userId } } })

    if (cfg.type === 'public') {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'public_messages' }, (p) =>
        void onInsert(p.new as MessageRow),
      )
    } else if (cfg.type === 'dm') {
      // Filter server-side: hanya pesan yang melibatkan kita (masuk / keluar), lalu disaring per pasangan.
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${cfg.userId}` },
        (p) => void onInsert(p.new as MessageRow),
      )
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${cfg.userId}` },
        (p) => void onInsert(p.new as MessageRow),
      )
    } else {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${cfg.groupId}` },
        (p) => void onInsert(p.new as MessageRow),
      )
    }

    channel.on('presence', { event: 'sync' }, () => {
      const online: Record<string, boolean> = {}
      for (const id of Object.keys(channel.presenceState())) online[id] = true
      set({ onlineUsers: online })
    })

    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      const { userId, isTyping } = payload as { userId: string; isTyping: boolean }
      if (!userId || userId === cfg.userId) return
      set((s) => ({ typingUsers: { ...s.typingUsers, [userId]: isTyping } }))
      clearTimeout(typingTimers[userId])
      if (isTyping) {
        // jaga-jaga bila event "berhenti mengetik" tidak pernah sampai
        typingTimers[userId] = setTimeout(
          () => set((s) => ({ typingUsers: { ...s.typingUsers, [userId]: false } })),
          4000,
        )
      }
    })

    channel.subscribe(async (status) => {
      if (token !== joinCounter) return
      if (status === 'SUBSCRIBED') {
        set({ channelReady: true })
        await channel.track({ online_at: new Date().toISOString() })
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        set({ channelReady: false })
      }
    })
    set({ activeChannel: channel })

    // riwayat pesan
    const rows = await fetchPage(cfg)
    if (get().activeRoom !== room) return
    const decoded = await Promise.all([...rows].reverse().map((r) => decodeRow(r, key)))
    if (get().activeRoom !== room) return
    set((s) => ({
      messages: mergeMessages(decoded, s.messages), // gabung dengan pesan realtime yang masuk saat loading
      hasMore: rows.length === PAGE_SIZE,
      isLoadingHistory: false,
    }))
    await get().ensureProfiles(decoded.map((m) => m.sender_id))
  },

  leaveRoom: async () => {
    joinCounter++ // batalkan join yang sedang berjalan
    const ch = get().activeChannel
    set({
      activeRoom: null,
      activeConfig: null,
      activeChannel: null,
      channelReady: false,
      messages: [],
      hasMore: false,
      isLoadingHistory: false,
      onlineUsers: {},
      typingUsers: {},
    })
    if (ch) {
      const supabase = createClient()
      removal = removal.then(() => supabase.removeChannel(ch))
      await removal
    }
  },

  loadOlder: async () => {
    const { activeConfig, activeRoom, messages, hasMore, isLoadingHistory } = get()
    if (!activeConfig || !hasMore || isLoadingHistory || messages.length === 0) return
    set({ isLoadingHistory: true })
    const rows = await fetchPage(activeConfig, messages[0].created_at)
    if (get().activeRoom !== activeRoom) return
    const key = keyOf(activeConfig)
    const decoded = await Promise.all([...rows].reverse().map((r) => decodeRow(r, key)))
    if (get().activeRoom !== activeRoom) return
    set((s) => ({
      messages: mergeMessages(decoded, s.messages),
      hasMore: rows.length === PAGE_SIZE,
      isLoadingHistory: false,
    }))
    await get().ensureProfiles(decoded.map((m) => m.sender_id))
  },

  sendMessage: async ({ text, file, onProgress }) => {
    const cfg = get().activeConfig
    if (!cfg) throw new Error('Belum terhubung ke ruang obrolan.')
    const caption = text.trim()
    if (!caption && !file) return

    const supabase = createClient()
    let row: MessageRow | null = null

    if (cfg.type === 'public') {
      // Chat publik memang tidak dienkripsi: file diunggah apa adanya.
      let media_url: string | null = null
      if (file) {
        media_url = await uploadToCloudinary(file, {
          onProgress: (percent) => onProgress?.({ phase: 'upload', percent }),
        })
      }
      const { data, error } = await supabase
        .from('public_messages')
        .insert({ sender_id: cfg.userId, content: caption, media_url })
        .select()
        .single()
      if (error) throw new Error(error.message)
      row = data as MessageRow
    } else {
      let media_url: string | null = null
      if (file) {
        const envelope = await encryptAndUpload(file, onProgress)
        rememberLocalFile(envelope.url, file)
        media_url = await encryptMessage(JSON.stringify(envelope), cfg.key)
      }
      const encrypted_content = await encryptMessage(caption, cfg.key)

      const query =
        cfg.type === 'dm'
          ? supabase
              .from('direct_messages')
              .insert({ sender_id: cfg.userId, receiver_id: cfg.friendId, encrypted_content, media_url })
          : supabase
              .from('group_messages')
              .insert({ sender_id: cfg.userId, group_id: cfg.groupId, encrypted_content, media_url })
      const { data, error } = await query.select().single()
      if (error) throw new Error(error.message)
      row = data as MessageRow
    }

    // Tampilkan langsung; event realtime yang menyusul akan di-dedupe berdasarkan id.
    if (row && get().activeRoom === roomName(cfg)) {
      get().addMessage(await decodeRow(row, keyOf(cfg)))
    }
    get().bumpConversations()
  },

  sendTyping: (isTyping) => {
    const { activeChannel, channelReady, activeConfig } = get()
    if (!activeChannel || !channelReady || !activeConfig) return
    void activeChannel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: activeConfig.userId, isTyping },
    })
  },
}))
