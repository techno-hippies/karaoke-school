/**
 * Lit WebAuthn Configuration
 * Network and auth service settings
 */

import { nagaDev } from '@lit-protocol/networks'

export const LIT_WEBAUTHN_CONFIG = {
  // Lit Protocol network
  network: nagaDev,
  networkName: 'naga-dev',

  // Lit Auth Service URL
  authServiceUrl: 'https://naga-dev-auth-service.getlit.dev',

  // Session expiration (7 days)
  sessionExpirationMs: 7 * 24 * 60 * 60 * 1000,

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
    session: 'karaoke-school:session',
  },
} as const

export type LitWebAuthnConfig = typeof LIT_WEBAUTHN_CONFIG
