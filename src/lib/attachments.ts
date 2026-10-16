import { decryptBytes, encryptBytes, exportRawKey, generateAesKey, importAesKey } from './crypto'
import { uploadToCloudinary } from './cloudinary'

/** Batas ukuran per file (plan gratis Cloudinary membatasi ~10 MB untuk raw; sesuaikan dengan plan kamu). */
export const MAX_FILE_SIZE = 20 * 1024 * 1024

export type AttachmentKind = 'image' | 'video' | 'audio' | 'file'

// Hanya MIME "aman" yang boleh dirender inline. Selain itu (html, svg, js, dll) selalu
// diperlakukan sebagai file unduhan dengan tipe octet-stream, supaya tidak bisa
// dieksekusi di origin aplikasi lewat blob: URL.
const SAFE_IMAGE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'])
const SAFE_VIDEO = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'])
const SAFE_AUDIO = new Set(['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/x-m4a'])

export function kindFromMime(mime: string): AttachmentKind {
  const m = mime.toLowerCase().split(';')[0].trim()
  if (SAFE_IMAGE.has(m)) return 'image'
  if (SAFE_VIDEO.has(m)) return 'video'
  if (SAFE_AUDIO.has(m)) return 'audio'
  return 'file'
}

export function validateFile(file: File): string | null {
  if (file.size === 0) return 'File kosong.'
  if (file.size > MAX_FILE_SIZE) return `Ukuran file maksimal ${MAX_FILE_SIZE / 1024 / 1024} MB.`
  return null
}

/** Hanya izinkan https + host Cloudinary agar pengirim jahat tidak bisa membuat klien kita memanggil server lain. */
export function isTrustedMediaUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && u.hostname === 'res.cloudinary.com'
  } catch {
    return false
  }
}

/** Untuk URL publik (chat global, tanpa E2EE): tebak jenis dari ekstensi / resource type Cloudinary. */
export function kindFromUrl(url: string): AttachmentKind {
  const path = url.split('?')[0].toLowerCase()
  if (/\.(png|jpe?g|gif|webp|avif)$/.test(path)) return 'image'
  if (/\.(mp4|webm|mov|ogv)$/.test(path)) return 'video'
  if (/\.(mp3|m4a|wav|aac|oga)$/.test(path)) return 'audio'
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|zip|rar|csv)$/.test(path)) return 'file'
  if (path.includes('/video/upload/')) return 'video'
  if (path.includes('/image/upload/')) return 'image'
  return 'file'
}

/** Metadata file terenkripsi. Dikirim di kolom media_url SETELAH dienkripsi dengan kunci percakapan. */
export interface AttachmentEnvelope {
  v: 1
  url: string // lokasi ciphertext di Cloudinary
  key: string // kunci AES file (base64) -- hanya terbaca oleh peserta percakapan
  name: string
  mime: string
  size: number
  kind: AttachmentKind
}

export function parseEnvelope(json: string): AttachmentEnvelope | null {
  try {
    const o = JSON.parse(json)
    if (o?.v !== 1 || typeof o.url !== 'string' || typeof o.key !== 'string') return null
    if (!isTrustedMediaUrl(o.url)) return null
    const mime = typeof o.mime === 'string' ? o.mime : 'application/octet-stream'
    return {
      v: 1,
      url: o.url,
      key: o.key,
      name: sanitizeName(typeof o.name === 'string' ? o.name : 'file'),
      mime,
      size: Number.isFinite(o.size) ? Number(o.size) : 0,
      kind: kindFromMime(mime), // dihitung ulang, jangan percaya klaim pengirim
    }
  } catch {
    return null
  }
}

function sanitizeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120) || 'file'
}

export type UploadProgress = { phase: 'encrypt' | 'upload'; percent: number }

/** Enkripsi file di browser (AES-GCM, kunci acak) lalu upload ciphertext-nya. */
export async function encryptAndUpload(file: File, onProgress?: (p: UploadProgress) => void): Promise<AttachmentEnvelope> {
  onProgress?.({ phase: 'encrypt', percent: 0 })
  const fileKey = await generateAesKey()
  const cipher = await encryptBytes(await file.arrayBuffer(), fileKey)
  onProgress?.({ phase: 'encrypt', percent: 100 })

  const url = await uploadToCloudinary(new Blob([cipher as BlobPart]), {
    resourceType: 'raw',
    onProgress: (percent) => onProgress?.({ phase: 'upload', percent }),
  })

  const mime = file.type || 'application/octet-stream'
  return {
    v: 1,
    url,
    key: await exportRawKey(fileKey),
    name: sanitizeName(file.name),
    mime,
    size: file.size,
    kind: kindFromMime(mime),
  }
}

// Cache object URL: file yang baru kita kirim / sudah kita buka tidak perlu diunduh & didekripsi ulang.
const blobCache = new Map<string, string>()

export function rememberLocalFile(envelopeUrl: string, file: File) {
  const type = kindFromMime(file.type) === 'file' ? 'application/octet-stream' : file.type
  blobCache.set(envelopeUrl, URL.createObjectURL(new Blob([file], { type })))
}

/** Unduh ciphertext, dekripsi, kembalikan object URL (blob:) yang aman dirender. */
export async function loadAttachment(env: AttachmentEnvelope): Promise<string> {
  const cached = blobCache.get(env.url)
  if (cached) return cached

  const res = await fetch(env.url)
  if (!res.ok) throw new Error('Gagal mengunduh file.')
  const key = await importAesKey(env.key)
  const plain = await decryptBytes(await res.arrayBuffer(), key)

  const type = env.kind === 'file' ? 'application/octet-stream' : env.mime
  const objectUrl = URL.createObjectURL(new Blob([plain], { type }))
  blobCache.set(env.url, objectUrl)
  return objectUrl
}
