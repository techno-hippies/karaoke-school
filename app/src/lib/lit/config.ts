/**
 * Lit WebAuthn Configuration
 * Network and auth service settings
 */

import { nagaTest } from '@lit-protocol/networks'
import {
  LIT_SESSION_STORAGE_KEY,
  LIT_NETWORK_NAME,
  LIT_AUTH_SERVICE_URL,
  LIT_SESSION_EXPIRATION_MS,
} from './constants'

export const LIT_WEBAUTHN_CONFIG = {
  // Lit Protocol network
  network: nagaTest,
  networkName: LIT_NETWORK_NAME,

  // Lit Auth Service URL
  authServiceUrl: LIT_AUTH_SERVICE_URL,

  // Session expiration (7 days)
  sessionExpirationMs: LIT_SESSION_EXPIRATION_MS,

  // PKP scopes - EXACT MATCH to working demo
  pkpScopes: ['sign-anything'] as const,

  // Auth context resources
  authResources: [
    ['pkp-signing', '*'],
    ['lit-action-execution', '*'],
  ] as const,

  // LocalStorage keys
  storageKeys: {
    pkpInfo: 'karaoke-school:pkp-info',
    authData: 'karaoke-school:auth-data',
    session: LIT_SESSION_STORAGE_KEY,
  },
} as const

export type LitWebAuthnConfig = typeof LIT_WEBAUTHN_CONFIG
