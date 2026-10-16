import { get, set } from 'idb-keyval'
import {
  derivePublicKeyFromPrivate,
  exportPublicKey,
  generateKeyPair,
  toNonExtractablePrivateKey,
} from './crypto'

// Key disimpan PER USER. Sebelumnya satu nama untuk semua akun, sehingga login akun lain
// di browser yang sama menimpa private key akun pertama.
const LEGACY_PRIVATE = 'usagi_chat_private_key'
const privName = (uid: string) => `usagi_chat_private_key:${uid}`
const pubName = (uid: string) => `usagi_chat_public_key:${uid}`

export async function getPrivateKey(userId: string): Promise<CryptoKey | undefined> {
  return get<CryptoKey>(privName(userId))
}

export async function getPublicKey(userId: string): Promise<string | undefined> {
  return get<string>(pubName(userId))
}

export type EnsureKeysResult = {
  publicKey: string
  /** true bila public key harus (di)publikasikan ke server */
  publish: boolean
  status: 'existing' | 'migrated' | 'created'
}

/**
 * Pastikan browser ini punya key pair untuk `userId`.
 * - sudah ada lokal           -> pakai (publish jika beda dengan server)
 * - ada key lama & cocok server -> migrasi ke key non-extractable
 * - selain itu                -> buat baru
 */
export async function ensureKeys(userId: string, serverPublicKey: string | null): Promise<EnsureKeysResult> {
  const [priv, pub] = await Promise.all([get<CryptoKey>(privName(userId)), get<string>(pubName(userId))])
  if (priv && pub) {
    return { publicKey: pub, publish: pub !== serverPublicKey, status: 'existing' }
  }

  const legacy = await get<CryptoKey>(LEGACY_PRIVATE)
  if (legacy && serverPublicKey) {
    const derived = await derivePublicKeyFromPrivate(legacy)
    if (derived && derived === serverPublicKey) {
      await set(privName(userId), await toNonExtractablePrivateKey(legacy))
      await set(pubName(userId), derived)
      return { publicKey: derived, publish: false, status: 'migrated' }
    }
  }

  const pair = await generateKeyPair()
  const publicKey = await exportPublicKey(pair.publicKey)
  await set(privName(userId), pair.privateKey)
  await set(pubName(userId), publicKey)
  return { publicKey, publish: true, status: 'created' }
}
