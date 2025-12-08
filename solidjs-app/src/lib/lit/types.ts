/**
 * Lit WebAuthn Type Definitions
 */

import type { Address } from 'viem'

/**
 * PKP (Programmable Key Pair) Information
 */
export interface PKPInfo {
  publicKey: string
  ethAddress: Address
  tokenId: string
}

/**
 * WebAuthn Authentication Data
 */
export interface AuthData {
  authMethodType: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 9 | 10 | 11 | 12 | 13
  authMethodId: string
  accessToken: string
  /** EOA address for users who signed up with external wallet (authMethodType: 1) */
  eoaAddress?: Address
}

/**
 * Persisted Session Data
 */
export interface SessionData {
  pkpInfo: PKPInfo
  authData: AuthData
  expiresAt: number
}

/**
 * WebAuthn Registration Result
 */
export interface RegisterResult {
  pkpInfo: PKPInfo
  authData: AuthData
  webAuthnPublicKey: string
}

/**
 * Authentication Status
 */
export interface AuthStatus {
  isAuthenticated: boolean
  pkpInfo: PKPInfo | null
  authData: AuthData | null
  expiresAt: number | null
}

/**
 * PKP Auth Context (from Lit SDK)
 * Note: Cannot persist to localStorage due to callback functions
 */
export type PKPAuthContext = any // Opaque type from @lit-protocol/auth
