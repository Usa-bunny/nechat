/**
 * Semua kriptografi berjalan di browser (Web Crypto).
 *
 * - DM    : ECDH P-256 -> AES-GCM 256 (shared key per pasangan user)
 * - Grup  : AES-GCM 256 acak per grup, dibungkus (wrap) per anggota memakai shared key ECDH
 * - File  : AES-GCM 256 acak per file, kunci file dikirim di dalam "envelope" terenkripsi
 *
 * Format ciphertext: base64(IV[12] || ciphertext) -- kompatibel dengan pesan lama.
 */

// ---------- Helper byte/base64 ----------

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000 // chunk agar tidak stack-overflow pada data besar
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function base64UrlToBytes(s: string): Uint8Array {
  return base64ToBytes(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='))
}

// ---------- Kompresi teks ----------

export async function compressData(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function decompressData(data: Uint8Array): Promise<string> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new TextDecoder().decode(await new Response(stream).arrayBuffer())
}

// ---------- Identitas user (ECDH) ----------

const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const

/** Re-import private key sebagai NON-extractable agar tidak bisa dicuri lewat exportKey(). */
export async function toNonExtractablePrivateKey(key: CryptoKey): Promise<CryptoKey> {
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', key)
  return crypto.subtle.importKey('pkcs8', pkcs8, ECDH, false, ['deriveKey', 'deriveBits'])
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  const pair = await crypto.subtle.generateKey(ECDH, true, ['deriveKey', 'deriveBits'])
  return { publicKey: pair.publicKey, privateKey: await toNonExtractablePrivateKey(pair.privateKey) }
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  return bytesToBase64(new Uint8Array(await crypto.subtle.exportKey('raw', key)))
}

export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', base64ToBytes(base64Key) as BufferSource, ECDH, true, [])
}

/** Hanya untuk migrasi key lama (extractable): turunkan public key dari private key. */
export async function derivePublicKeyFromPrivate(priv: CryptoKey): Promise<string | null> {
  try {
    const jwk = await crypto.subtle.exportKey('jwk', priv)
    if (!jwk.x || !jwk.y) return null
    const raw = new Uint8Array(65)
    raw[0] = 4
    raw.set(base64UrlToBytes(jwk.x), 1)
    raw.set(base64UrlToBytes(jwk.y), 33)
    return bytesToBase64(raw)
  } catch {
    return null // key non-extractable
  }
}

export async function deriveSharedKey(myPrivateKey: CryptoKey, theirPublicKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * "Safety number": sidik jari dari kedua public key. Kedua pihak harus melihat angka yang SAMA.
 * Bandingkan lewat jalur lain (tatap muka / telepon) untuk memastikan server tidak mengganti key (MITM).
 */
export async function safetyNumber(pubA: string, pubB: string): Promise<string> {
  const [x, y] = [pubA, pubB].sort()
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x + y)))
  const hex = Array.from(hash.slice(0, 15), (b) => b.toString(16).padStart(2, '0')).join('')
  return hex.match(/.{1,5}/g)!.join(' ')
}

// ---------- AES-GCM generik (grup & file) ----------

export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function exportRawKey(key: CryptoKey): Promise<string> {
  return bytesToBase64(new Uint8Array(await crypto.subtle.exportKey('raw', key)))
}

export async function importAesKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', base64ToBytes(b64) as BufferSource, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
}

export async function encryptBytes(data: ArrayBuffer | Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data as BufferSource))
  const out = new Uint8Array(12 + ct.length)
  out.set(iv, 0)
  out.set(ct, 12)
  return out
}

export async function decryptBytes(data: ArrayBuffer | Uint8Array, key: CryptoKey): Promise<ArrayBuffer> {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data)
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.slice(0, 12) }, key, u8.slice(12))
}

// ---------- Teks ----------

/** Kompres -> enkripsi -> base64 */
export async function encryptMessage(text: string, key: CryptoKey): Promise<string> {
  return bytesToBase64(await encryptBytes(await compressData(text), key))
}

/** base64 -> dekripsi -> dekompresi */
export async function decryptMessage(b64: string, key: CryptoKey): Promise<string> {
  return decompressData(new Uint8Array(await decryptBytes(base64ToBytes(b64), key)))
}

// ---------- Key grup ----------

/** Bungkus group key (base64 raw) untuk satu anggota memakai ECDH(kita, anggota). */
export async function wrapGroupKey(groupKeyB64: string, myPrivateKey: CryptoKey, recipientPublicKeyB64: string): Promise<string> {
  const shared = await deriveSharedKey(myPrivateKey, await importPublicKey(recipientPublicKeyB64))
  return encryptMessage(groupKeyB64, shared)
}

/** Buka group key yang dibungkus oleh `wrapperPublicKeyB64` untuk kita. */
export async function unwrapGroupKey(wrapped: string, myPrivateKey: CryptoKey, wrapperPublicKeyB64: string): Promise<CryptoKey> {
  const shared = await deriveSharedKey(myPrivateKey, await importPublicKey(wrapperPublicKeyB64))
  return importAesKey(await decryptMessage(wrapped, shared))
}
