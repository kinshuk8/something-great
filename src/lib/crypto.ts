// Convert an ArrayBuffer to a Base64 string
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Convert a Base64 string to an ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// ----------------------------------------------------------------------------
// KEY GENERATION & IMPORT/EXPORT
// ----------------------------------------------------------------------------

// Generate an ECDH P-256 key pair
export async function generateIdentityKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // extractable
    ['deriveKey'],
  )
}

// Export a key to a JWK string representation
export async function exportKey(key: CryptoKey): Promise<string> {
  const jwk = await window.crypto.subtle.exportKey('jwk', key)
  return JSON.stringify(jwk)
}

// Import a public ECDH P-256 key from a JWK string
export async function importPublicKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString)
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  )
}

// Import a private ECDH P-256 key from a JWK string
export async function importPrivateKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString)
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey'],
  )
}

// Import a symmetric room/shared AES key from raw key bytes
export async function importRawRoomKey(
  rawKey: ArrayBuffer,
): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

// Export a symmetric room key to raw bytes
export async function exportRawRoomKey(key: CryptoKey): Promise<ArrayBuffer> {
  return await window.crypto.subtle.exportKey('raw', key)
}

// Generate a random 256-bit symmetric key for a room
export async function generateRoomKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt'],
  )
}

// ----------------------------------------------------------------------------
// KEY AGREEMENT (ECDH)
// ----------------------------------------------------------------------------

// Derive a shared secret key (AES-256-GCM) from my private key and their public key
export async function deriveSharedSecret(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey,
): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt'],
  )
}

// ----------------------------------------------------------------------------
// ENCRYPTION & DECRYPTION (TEXT)
// ----------------------------------------------------------------------------

export async function encryptText(
  plainText: string,
  aesKey: CryptoKey,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const encodedText = new TextEncoder().encode(plainText)

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encodedText,
  )

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer),
  }
}

export async function decryptText(
  base64Ciphertext: string,
  base64Iv: string,
  aesKey: CryptoKey,
): Promise<string> {
  const ciphertext = base64ToArrayBuffer(base64Ciphertext)
  const iv = new Uint8Array(base64ToArrayBuffer(base64Iv))

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext,
  )

  return new TextDecoder().decode(decryptedBuffer)
}

// ----------------------------------------------------------------------------
// ENCRYPTION & DECRYPTION (BINARY FILES / IMAGES)
// ----------------------------------------------------------------------------

export async function encryptFile(
  file: File,
  aesKey: CryptoKey,
): Promise<{ encryptedFile: File; iv: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const arrayBuffer = await file.arrayBuffer()

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    arrayBuffer,
  )

  const encryptedFile = new File([encryptedBuffer], file.name, {
    type: 'application/octet-stream',
  })

  return {
    encryptedFile,
    iv: arrayBufferToBase64(iv.buffer),
  }
}

export async function decryptFile(
  encryptedBuffer: ArrayBuffer,
  base64Iv: string,
  aesKey: CryptoKey,
): Promise<ArrayBuffer> {
  const iv = new Uint8Array(base64ToArrayBuffer(base64Iv))
  return await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encryptedBuffer,
  )
}

// ----------------------------------------------------------------------------
// PASSPHRASE BACKUP SCHEME (PBKDF2 + AES-GCM)
// ----------------------------------------------------------------------------

async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const passphraseBytes = new TextEncoder().encode(passphrase)
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable
    ['encrypt', 'decrypt'],
  )
}

// Encrypt the private key JWK string with the user's passphrase
export async function encryptPrivateKeyBackup(
  privateKeyJwk: string,
  passphrase: string,
): Promise<{ encryptedPrivateKey: string; iv: string; salt: string }> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const derivedKey = await deriveKeyFromPassphrase(passphrase, salt)

  const encodedJwk = new TextEncoder().encode(privateKeyJwk)
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    encodedJwk,
  )

  return {
    encryptedPrivateKey: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv.buffer),
    salt: arrayBufferToBase64(salt.buffer),
  }
}

// Decrypt the private key JWK string using the user's passphrase
export async function decryptPrivateKeyBackup(
  encryptedPrivateKeyBase64: string,
  passphrase: string,
  ivBase64: string,
  saltBase64: string,
): Promise<string> {
  const encryptedBuffer = base64ToArrayBuffer(encryptedPrivateKeyBase64)
  const salt = new Uint8Array(base64ToArrayBuffer(saltBase64))
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64))

  const derivedKey = await deriveKeyFromPassphrase(passphrase, salt)

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    encryptedBuffer,
  )

  return new TextDecoder().decode(decryptedBuffer)
}
