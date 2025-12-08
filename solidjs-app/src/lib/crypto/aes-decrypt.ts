/**
 * AES-GCM decryption utilities for hybrid encryption
 */

/**
 * Convert base64 string to Uint8Array
 */
export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Decrypt audio with AES-GCM
 * @param encryptedAudio - The encrypted audio data
 * @param symmetricKey - The decrypted AES key from Lit Protocol
 * @param iv - Base64 encoded initialization vector
 * @param authTag - Base64 encoded authentication tag
 */
export async function decryptAudioWithAesGcm(
  encryptedAudio: ArrayBuffer,
  symmetricKey: Uint8Array,
  iv: string,
  authTag: string
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    symmetricKey as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  const ivBytes = fromBase64(iv)
  const authTagBytes = fromBase64(authTag)

  // Combine ciphertext with auth tag (WebCrypto expects them together)
  const ciphertextWithTag = new Uint8Array(
    encryptedAudio.byteLength + authTagBytes.byteLength
  )
  ciphertextWithTag.set(new Uint8Array(encryptedAudio), 0)
  ciphertextWithTag.set(authTagBytes, encryptedAudio.byteLength)

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes as Uint8Array<ArrayBuffer>,
    },
    cryptoKey,
    ciphertextWithTag as Uint8Array<ArrayBuffer>
  )

  return decryptedBuffer
}
