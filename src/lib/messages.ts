import { decryptMessage } from './crypto'
import { isTrustedMediaUrl, parseEnvelope, type AttachmentEnvelope } from './attachments'

export type MediaRef =
  | { type: 'plain'; url: string }
  | { type: 'encrypted'; envelope: AttachmentEnvelope }

export interface ChatMessage {
  id: string
  sender_id: string
  content: string
  media: MediaRef | null
  created_at: string
  /** true bila teks tidak berhasil didekripsi */
  failed?: boolean
}

/** Bentuk baris dari tabel public_messages / direct_messages / group_messages. */
export interface MessageRow {
  id: string
  sender_id: string
  receiver_id?: string | null
  group_id?: string | null
  content?: string | null
  encrypted_content?: string | null
  media_url?: string | null
  created_at: string
}

const LEGACY_PLACEHOLDERS = new Set(['📷 [Gambar]', '📷 [Gambar/File]'])

/** Ubah baris DB menjadi ChatMessage yang siap dirender (dekripsi dilakukan di sini, sekali saja). */
export async function decodeRow(row: MessageRow, key?: CryptoKey): Promise<ChatMessage> {
  let content = ''
  let failed = false

  if (row.encrypted_content) {
    if (key) {
      try {
        content = await decryptMessage(row.encrypted_content, key)
      } catch {
        content = '🔒 Pesan tidak dapat didekripsi'
        failed = true
      }
    } else {
      content = '🔒 Pesan terenkripsi'
      failed = true
    }
  } else {
    content = row.content ?? ''
  }

  let media: MediaRef | null = null
  if (row.media_url) {
    if (key) {
      try {
        const dec = await decryptMessage(row.media_url, key)
        const env = parseEnvelope(dec)
        if (env) media = { type: 'encrypted', envelope: env }
        else if (isTrustedMediaUrl(dec)) media = { type: 'plain', url: dec } // format lama: URL terenkripsi
      } catch {
        if (isTrustedMediaUrl(row.media_url)) media = { type: 'plain', url: row.media_url }
      }
    } else if (isTrustedMediaUrl(row.media_url)) {
      media = { type: 'plain', url: row.media_url }
    }
  }

  if (media && LEGACY_PLACEHOLDERS.has(content)) content = ''

  return { id: row.id, sender_id: row.sender_id, content, media, created_at: row.created_at, failed }
}
