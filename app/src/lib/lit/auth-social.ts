// Legacy social auth placeholder - not used in current PKP flow, but kept for dynamic import compatibility.
import i18n from '@/lib/i18n'

export async function loginWithGoogle() {
  throw new Error('Social auth not implemented. Use PKP/WebAuthn flow.')
}

export async function loginWithDiscord() {
  throw new Error('Social auth not implemented. Use PKP/WebAuthn flow.')
}

/**
 * Social login placeholders matching AuthContext expectations.
 * They intentionally throw so the UI can prompt users to use passkeys.
 */
export async function authGoogle(
  onStatusUpdate: (status: string) => void,
  _options?: { requireExisting?: boolean }
): Promise<{ pkpInfo: any; authContext: any; authData: any }> {
  onStatusUpdate(i18n.t('auth.googleNotAvailable'))
  throw new Error('Google auth not implemented. Use PKP/WebAuthn flow.')
}

export async function authDiscord(
  onStatusUpdate: (status: string) => void,
  _options?: { requireExisting?: boolean }
): Promise<{ pkpInfo: any; authContext: any; authData: any }> {
  onStatusUpdate(i18n.t('auth.discordNotAvailable'))
  throw new Error('Discord auth not implemented. Use PKP/WebAuthn flow.')
}
