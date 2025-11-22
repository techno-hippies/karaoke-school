// Legacy social auth placeholder - not used in current PKP flow, but kept for dynamic import compatibility.
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
  onStatusUpdate('Google login is not available. Please use Passkey.')
  throw new Error('Google auth not implemented. Use PKP/WebAuthn flow.')
}

export async function authDiscord(
  onStatusUpdate: (status: string) => void,
  _options?: { requireExisting?: boolean }
): Promise<{ pkpInfo: any; authContext: any; authData: any }> {
  onStatusUpdate('Discord login is not available. Please use Passkey.')
  throw new Error('Discord auth not implemented. Use PKP/WebAuthn flow.')
}
