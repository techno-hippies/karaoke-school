/**
 * PKP as viem WalletClient
 * Converts PKP to viem-compatible wallet for signing messages and transactions
 */

import {
  createWalletClient,
  custom,
  type WalletClient,
  type Address,
  type Hex,
  type LocalAccount,
  type Chain,
} from 'viem'
import { baseSepolia } from 'viem/chains'
import { getLitClient } from './client'
import type { PKPInfo, PKPAuthContext } from './types'

const IS_DEV = import.meta.env.DEV

/**
 * Create PKP-backed LocalAccount for viem
 * This allows PKP to sign messages and transactions
 */
function createPKPAccount(
  pkpInfo: PKPInfo,
  authContext: PKPAuthContext
): LocalAccount {
  const address = pkpInfo.ethAddress

  return {
    address,
    publicKey: pkpInfo.publicKey as Hex,
    type: 'local',
    source: 'custom',

    // Sign message using PKP via Lit Protocol
    async signMessage({ message }) {
      if (IS_DEV) console.log('[PKPSigner] Signing message:', message)

      const litClient = await getLitClient()

      // Lit Action to sign personal message
      const litActionCode = `(async () => {
        const sigShare = await Lit.Actions.ethPersonalSignMessageEcdsa({
          message: jsParams.message,
          publicKey: jsParams.publicKey,
          sigName: "sig",
        });
      })();`

      try {
        const result = await litClient.executeJs({
          code: litActionCode,
          authContext: authContext,
          jsParams: {
            message: typeof message === 'string' ? message : message.raw,
            publicKey: pkpInfo.publicKey,
          },
        })

        if (IS_DEV) console.log('[PKPSigner] Sign result:', result)

        // Extract signature
        if (result.signatures && result.signatures.sig) {
          const sig = result.signatures.sig

          // Combine r, s, and v into single signature
          if (sig.signature && sig.recoveryId !== undefined) {
            const v = (sig.recoveryId + 27).toString(16).padStart(2, '0')
            const signature = `${sig.signature}${v}` as Hex

            if (IS_DEV) console.log('[PKPSigner] Message signed successfully')

            return signature
          }
        }

        throw new Error('No signature returned from Lit Action')
      } catch (error) {
        console.error('[PKPSigner] Message signing failed:', error)
        throw error
      }
    },

    // Sign transaction using PKP via Lit Protocol
    async signTransaction(transaction) {
      if (IS_DEV) console.log('[PKPSigner] Signing transaction:', transaction)

      const litClient = await getLitClient()

      // Serialize transaction for signing
      const { serializeTransaction, keccak256 } = await import('viem')
      const serializedTx = serializeTransaction(transaction as any)

      // Hash the serialized transaction (Lit requires exactly 32 bytes)
      const txHash = keccak256(serializedTx)
      if (IS_DEV) console.log('[PKPSigner] Transaction hash (32 bytes):', txHash)

      // Lit Action to sign transaction
      const litActionCode = `(async () => {
        const sigShare = await Lit.Actions.signEcdsa({
          toSign: jsParams.toSign,
          publicKey: jsParams.publicKey,
          sigName: "sig",
        });
      })();`

      try {
        const result = await litClient.executeJs({
          code: litActionCode,
          authContext: authContext,
          jsParams: {
            toSign: Array.from(Buffer.from(txHash.slice(2), 'hex')),
            publicKey: pkpInfo.publicKey,
          },
        })

        if (result.signatures && result.signatures.sig) {
          const sig = result.signatures.sig

          if (sig.signature && sig.recoveryId !== undefined) {
            // Extract r and s from signature (signature is 64 bytes: 32 bytes r + 32 bytes s)
            // Remove 0x prefix if present before slicing
            const sigHex = sig.signature.startsWith('0x') ? sig.signature.slice(2) : sig.signature
            const r = `0x${sigHex.slice(0, 64)}` as Hex
            const s = `0x${sigHex.slice(64, 128)}` as Hex

            // For EIP-1559, use yParity (0 or 1)
            // For legacy, use v (27 or 28)
            const isEIP1559 = transaction.type === 'eip1559'
            const yParity = sig.recoveryId
            const v = isEIP1559 ? BigInt(yParity) : BigInt(yParity + 27)

            if (IS_DEV) console.log('[PKPSigner] Signature:', { r, s, v: v.toString(), yParity, isEIP1559 })

            // Serialize signed transaction with signature components
            const { serializeTransaction } = await import('viem')
            const signedTx = {
              ...transaction,
              r,
              s,
              ...(isEIP1559 ? { yParity } : { v }),
            }
            return serializeTransaction(signedTx as any)
          }
        }

        throw new Error('No signature returned from Lit Action')
      } catch (error) {
        console.error('[PKPSigner] Transaction signing failed:', error)
        throw error
      }
    },

    // Sign typed data (EIP-712) using PKP
    async signTypedData(typedData) {
      if (IS_DEV) console.log('[PKPSigner] Signing typed data:', typedData)

      const litClient = await getLitClient()

      // Hash typed data
      const { hashTypedData } = await import('viem')
      const hash = hashTypedData(typedData as any)

      // Lit Action to sign hash
      const litActionCode = `(async () => {
        const sigShare = await Lit.Actions.signEcdsa({
          toSign: jsParams.toSign,
          publicKey: jsParams.publicKey,
          sigName: "sig",
        });
      })();`

      try {
        const result = await litClient.executeJs({
          code: litActionCode,
          authContext: authContext,
          jsParams: {
            toSign: Array.from(Buffer.from(hash.slice(2), 'hex')),
            publicKey: pkpInfo.publicKey,
          },
        })

        if (result.signatures && result.signatures.sig) {
          const sig = result.signatures.sig

          if (sig.signature && sig.recoveryId !== undefined) {
            const v = (sig.recoveryId + 27).toString(16).padStart(2, '0')
            return `${sig.signature}${v}` as Hex
          }
        }

        throw new Error('No signature returned from Lit Action')
      } catch (error) {
        console.error('[PKPSigner] Typed data signing failed:', error)
        throw error
      }
    },
  }
}

/**
 * Create viem WalletClient backed by PKP
 * This allows PKP to be used as a drop-in replacement for regular wallets
 */
export async function createPKPWalletClient(
  pkpInfo: PKPInfo,
  authContext: PKPAuthContext,
  chain: Chain = baseSepolia
): Promise<WalletClient> {
  if (IS_DEV) {
    console.log('[PKPSigner] Creating PKP wallet client:', {
      address: pkpInfo.ethAddress,
      chain: chain.name,
    })
  }

  // Create PKP account
  const account = createPKPAccount(pkpInfo, authContext)

  // Create wallet client with PKP account
  const walletClient = createWalletClient({
    account,
    chain,
    transport: custom({
      async request({ method, params }) {
        // Handle eth_requestAccounts
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
          return [pkpInfo.ethAddress]
        }

        // Handle eth_chainId
        if (method === 'eth_chainId') {
          return `0x${chain.id.toString(16)}`
        }

        // For other methods, use default RPC
        const { createPublicClient, http } = await import('viem')
        const publicClient = createPublicClient({
          chain,
          transport: http(),
        })

        return await (publicClient as any).request({ method, params })
      },
    }),
  })

  if (IS_DEV) console.log('[PKPSigner] PKP wallet client created')

  return walletClient
}

/**
 * Get PKP address from wallet client
 * Helper function for compatibility
 */
export function getPKPAddress(walletClient: WalletClient): Address {
  if (!walletClient.account?.address) {
    throw new Error('No account address in wallet client')
  }
  return walletClient.account.address
}
