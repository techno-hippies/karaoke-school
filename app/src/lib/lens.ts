import { PublicClient, testnet } from '@lens-protocol/client'

/**
 * Lens Public Client for querying posts, accounts, etc.
 */
export const lensClient = PublicClient.create({
  environment: testnet,
})
