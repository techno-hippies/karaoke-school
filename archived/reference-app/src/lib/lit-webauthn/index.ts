/**
 * Lit WebAuthn Public API
 * Centralized exports for all WebAuthn + PKP functionality
 */

// Configuration
export { LIT_WEBAUTHN_CONFIG } from './config'
export type { LitWebAuthnConfig } from './config'

// Types
export type {
  PKPInfo,
  AuthData,
  SessionData,
  RegisterResult,
  AuthStatus,
  PKPAuthContext,
} from './types'

// Client
export {
  getLitClient,
  getAuthManager,
  resetClients,
} from './client'

// Storage
export {
  saveSession,
  loadSession,
  clearSession,
  getAuthStatus,
} from './storage'

// WebAuthn Authentication
export {
  registerWithWebAuthn,
  authenticateWithWebAuthn,
  hasExistingCredential,
} from './auth-webauthn'

// PKP Auth Context
export {
  createPKPAuthContext,
  getCachedAuthContext,
  clearAuthContext,
} from './auth-pkp'

// PKP Signer
export {
  createPKPWalletClient,
  getPKPAddress,
} from './signer-pkp'
