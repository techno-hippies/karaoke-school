// Legacy EOA auth placeholder - not used in current PKP flow, but kept for dynamic import compatibility.
import i18n from '@/lib/i18n'

export async function createEoaAuthContext() {
  throw new Error('EOA auth not implemented. Use PKP/WebAuthn flow.')
}

/**
 * Placeholder for wallet-based login. Returns a structured error so the UI can surface a message.
 */
export async function connectEOA(
  _walletClient: any,
  _address: `0x${string}`,
  onStatusUpdate: (status: string) => void
): Promise<{
  pkpInfo: any
  authContext: any
  authData: any
  isNewUser: boolean
}> {
  onStatusUpdate(i18n.t('auth.eoaNotSupported'))
  throw new Error('EOA auth not implemented. Use PKP/WebAuthn flow.')
}
