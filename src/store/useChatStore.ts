import { create } from "zustand";
import { createClient } from "@/utils/supabase/client";
import { decryptMessage } from "@/lib/crypto";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  media_url?: string | null; // Tambahan baru
  created_at: string;
}

interface ChatState {
  messages: Message[];
  onlineUsers: Record<string, boolean>;
  typingUsers: Record<string, boolean>;
  activeChannel: RealtimeChannel | null;

  // Actions
  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  setOnlineUsers: (users: Record<string, boolean>) => void;
  setTypingUsers: (users: Record<string, boolean>) => void;
  initializeRealtime: (
    roomId: string,
    currentUserId: string,
    sharedKey?: CryptoKey,
  ) => void;
  updateTypingStatus: (isTyping: boolean) => void;
  cleanup: () => void;
  isAddFriendModalOpen: boolean;
  setAddFriendModalOpen: (isOpen: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  onlineUsers: {},
  typingUsers: {},
  activeChannel: null,

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),
  setOnlineUsers: (users) => set({ onlineUsers: users }),
  setTypingUsers: (users) => set({ typingUsers: users }),
  isAddFriendModalOpen: false,
  setAddFriendModalOpen: (isOpen) => set({ isAddFriendModalOpen: isOpen }),

  initializeRealtime: (roomId, currentUserId, sharedKey) => {
    const supabase = createClient();
    supabase.removeAllChannels();

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: { key: currentUserId },
      },
    });

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: roomId === "public_chat" ? "public_messages" : "direct_messages",
      },
      async (payload) => {
        let finalContent = payload.new.content || payload.new.encrypted_content;
        let finalMediaUrl = payload.new.media_url || null; // Set default media_url

        // PROSES DEKRIPSI (Teks & Media)
        if (sharedKey) {
          // Dekripsi Teks
          if (payload.new.encrypted_content) {
            try {
              finalContent = await decryptMessage(
                payload.new.encrypted_content,
                sharedKey,
              );
            } catch (e) {
              console.error("Gagal mendekripsi pesan:", e);
              finalContent = "🔒 Pesan terenkripsi (gagal didekripsi)";
            }
          }

          // LETAKKAN KODE DEKRIPSI URL MEDIA DI SINI
          if (payload.new.media_url) {
            try {
              finalMediaUrl = await decryptMessage(
                payload.new.media_url,
                sharedKey,
              );
            } catch (e) {
              console.error("Gagal mendekripsi URL gambar", e);
            }
          }
        }

        // MASUKKAN KE STATE ZUSTAND
        const newMessage: Message = {
          id: payload.new.id,
          sender_id: payload.new.sender_id,
          content: finalContent,
          media_url: finalMediaUrl, // Sekarang berupa URL asli ('https://res.cloudinary.com/...')
          created_at: payload.new.created_at,
        };

        get().addMessage(newMessage);
      },
    );

    // 3. Listen to Presence Sync (Siapa yang sedang online)
    channel.on("presence", { event: "sync" }, () => {
      const newState = channel.presenceState();
      const online: Record<string, boolean> = {};

      // Parse state presence Supabase ke format simpel
      for (const userId in newState) {
        online[userId] = true;
      }
      get().setOnlineUsers(online);
    });

    // 4. Listen to Typing Status (Menggunakan fitur Broadcast Supabase)
    // Broadcast sangat cepat dan ringan, tidak disimpan ke database
    channel.on("broadcast", { event: "typing" }, (payload) => {
      const { userId, isTyping } = payload.payload;
      const currentTyping = get().typingUsers;

      get().setTypingUsers({
        ...currentTyping,
        [userId]: isTyping,
      });
    });

    // Mulai koneksi dan beritahu server bahwa kita online
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

    set({ activeChannel: channel });
  },

  // Fungsi untuk memancarkan (broadcast) status typing kita ke orang lain
  updateTypingStatus: async (isTyping) => {
    const { activeChannel } = get();
    if (!activeChannel) return;

    // Supabase Broadcast dibatasi limit tertentu (gratis = ~10 message/detik per channel)
    // Jadi fungsi ini harus di-debounce di komponen UI nanti
    await activeChannel.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: "USER_ID_KITA", isTyping }, // Ganti dengan current user ID asli
    });
  },

  // Putus koneksi saat pindah halaman
  cleanup: async () => {
    const { activeChannel } = get();
    if (activeChannel) {
      const supabase = createClient();
      // Gunakan removeChannel untuk menghapus total dari cache
      await supabase.removeChannel(activeChannel);
    }
    set({
      activeChannel: null,
      messages: [],
      onlineUsers: {},
      typingUsers: {},
    });
  },
}));
