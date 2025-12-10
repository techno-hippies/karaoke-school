import type { Address, Hex } from 'viem'

/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  // Database
  DATABASE_URL: string

  // Lens Protocol
  LENS_APP_ADDRESS: string
  LENS_CUSTOM_NAMESPACE: string
  LENS_CHAIN_ID: string
  LENS_RPC_URL: string
  LENS_AUTH_BEARER_TOKEN: string

  // Admin wallet for transaction submission
  PRIVATE_KEY: string

  // Sponsorship configuration
  MAX_SPONSORED_TXS: string
  MIN_BALANCE_WEI: string
}

/**
 * Lens Authorization Endpoint Request
 * Sent by Lens API to check if user should be sponsored
 */
export interface LensAuthRequest {
  account: Address // Lens account address (smart account)
  signedBy: Address // PKP address that signed the request
  operation?: string // Optional: type of operation (e.g., 'createUsername')
}

/**
 * Lens Authorization Endpoint Response
 * Must respond within 500ms
 * Both fields are required by Lens Protocol
 */
export interface LensAuthResponse {
  allowed: boolean // Whether user can access Lens API
  sponsored: boolean // Whether transaction should be sponsored (required, not optional)
}

/**
 * Transaction Submission Request
 * Frontend sends signed transaction for backend to submit
 */
export interface SubmitTxRequest {
  account: Address // Lens account address
  operation: string // Operation type: 'username', 'post', etc.
  raw: {
    to: Address
    data: Hex
    value: string
    nonce: string
    gasLimit: string
    maxFeePerGas: string
    maxPriorityFeePerGas: string
  }
}

/**
 * Transaction Submission Response
 */
export interface SubmitTxResponse {
  success: boolean
  txHash?: Hex
  error?: string
}

/**
 * User Sponsorship Record (DB schema)
 */
export interface UserSponsorship {
  account: Address
  pkp_address: Address
  sponsored_count: number
  poh_score: number
  balance_wei: string
  created_at: Date
  last_tx_at?: Date
}

/**
 * Transaction Log Record (DB schema)
 */
export interface TransactionLog {
  id: number
  account: Address
  tx_hash?: Hex
  operation: string
  sponsored: boolean
  error?: string
  timestamp: Date
}

/**
 * Quota Check Result
 */
export interface QuotaCheck {
  canSponsor: boolean
  reason?: string
  remainingQuota: number
}
