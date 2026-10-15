// File: src/lib/keyStore.ts
import { get, set } from 'idb-keyval';

const PRIVATE_KEY_NAME = 'usagi_chat_private_key';

// Menyimpan Private Key ke IndexedDB browser
export async function savePrivateKey(key: CryptoKey): Promise<void> {
  await set(PRIVATE_KEY_NAME, key);
}

// Mengambil Private Key dari IndexedDB browser
export async function getPrivateKey(): Promise<CryptoKey | undefined> {
  return await get(PRIVATE_KEY_NAME);
}