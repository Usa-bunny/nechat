export async function compressData(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate'));
  const arrayBuffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function decompressData(data: Uint8Array): Promise<string> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  const arrayBuffer = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(arrayBuffer);
}

// 1. Generate Key Pair untuk User baru (Dijalankan saat register/login pertama kali)
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // Extractable (agar Public Key bisa dikirim ke Supabase)
    ['deriveKey', 'deriveBits']
  );
}

// 2. Export Public Key ke Base64 (Untuk disimpan di tabel 'users' Supabase)
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  const exportedAsString = String.fromCharCode(...new Uint8Array(exported));
  return btoa(exportedAsString);
}

// 3. Import Public Key dari Base64 (Membaca Public Key milik teman chat)
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const binaryDerString = atob(base64Key);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    'raw',
    binaryDer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

// 4. Membuat Kunci Bersama (Shared Key) dari Private Key KITA dan Public Key TEMAN
export async function deriveSharedKey(myPrivateKey: CryptoKey, theirPublicKey: CryptoKey): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false, // Shared key tidak boleh di-extract demi keamanan
    ['encrypt', 'decrypt']
  );
}

// 5. ENCRYPT: Kompres -> Enkripsi -> Base64
export async function encryptMessage(text: string, sharedKey: CryptoKey): Promise<string> {
  // Step A: Compress
  const compressedData = await compressData(text);
  
  // Step B: Generate Initialization Vector (IV)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  // Step C: Encrypt
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    sharedKey,
    compressedData as BufferSource
  );
  
  // Step D: Combine IV + Ciphertext & Encode to Base64
  const ciphertext = new Uint8Array(ciphertextBuffer);
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// 6. DECRYPT: Base64 -> Dekripsi -> Dekompresi
export async function decryptMessage(base64String: string, sharedKey: CryptoKey): Promise<string> {
  // Step A: Decode Base64 to Array
  const combinedStr = atob(base64String);
  const combined = new Uint8Array(combinedStr.length);
  for (let i = 0; i < combinedStr.length; i++) {
    combined[i] = combinedStr.charCodeAt(i);
  }
  
  // Step B: Extract IV and Ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  // Step C: Decrypt
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    sharedKey,
    ciphertext
  );
  
  // Step D: Decompress
  return await decompressData(new Uint8Array(decryptedBuffer));
}