/**
 * KaraokeCatalogV2 Contract Service
 * Write operations to Base Sepolia contract
 */

import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { config } from '../config.js'
import type { AddFullSongParams, ProcessSegmentsBatchParams } from '../types.js'

// KaraokeCatalogV2 ABI - only functions we need
const KARAOKE_CATALOG_ABI = [
  {
    name: 'addFullSong',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'id', type: 'string' },
          { name: 'geniusId', type: 'uint32' },
          { name: 'title', type: 'string' },
          { name: 'artist', type: 'string' },
          { name: 'duration', type: 'uint32' },
          { name: 'soundcloudPath', type: 'string' },
          { name: 'hasFullAudio', type: 'bool' },
          { name: 'requiresPayment', type: 'bool' },
          { name: 'audioUri', type: 'string' },
          { name: 'metadataUri', type: 'string' },
          { name: 'coverUri', type: 'string' },
          { name: 'thumbnailUri', type: 'string' },
          { name: 'musicVideoUri', type: 'string' },
          { name: 'sectionsUri', type: 'string' },
          { name: 'alignmentUri', type: 'string' },
        ],
      },
    ],
    outputs: [],
  },
  {
    name: 'processSegmentsBatch',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'geniusId', type: 'uint32' },
      { name: 'songId', type: 'string' },
      { name: 'segmentIds', type: 'string[]' },
      { name: 'sectionTypes', type: 'string[]' },
      { name: 'vocalsUris', type: 'string[]' },
      { name: 'drumsUris', type: 'string[]' },
      { name: 'audioSnippetUris', type: 'string[]' },
      { name: 'startTimes', type: 'uint32[]' },
      { name: 'endTimes', type: 'uint32[]' },
    ],
    outputs: [],
  },
  {
    name: 'songExistsById',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'string' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'songExistsByGeniusId',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'geniusId', type: 'uint32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

let walletClient: WalletClient | null = null
let publicClient: PublicClient | null = null

/**
 * Initialize public client (read-only, no wallet needed)
 */
function initPublicClient() {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(config.contract.rpcUrl),
    })
  }
  return publicClient
}

/**
 * Initialize wallet client (for write operations)
 */
function initWalletClient() {
  if (!walletClient) {
    if (!config.wallet.privateKey) {
      throw new Error('PRIVATE_KEY environment variable is required for write operations')
    }

    const account = privateKeyToAccount(config.wallet.privateKey)

    walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(config.contract.rpcUrl),
    })

    console.log('📝 Wallet client initialized')
    console.log(`   Wallet: ${account.address}`)
    console.log(`   Contract: ${config.contract.address}`)
  }
  return walletClient
}

/**
 * Check if song already exists in catalog
 */
export async function checkSongExists(songId: string): Promise<boolean> {
  const publicClient = initPublicClient()

  const exists = await publicClient.readContract({
    address: config.contract.address,
    abi: KARAOKE_CATALOG_ABI,
    functionName: 'songExistsById',
    args: [songId],
  })

  return exists as boolean
}

/**
 * Add full song to catalog (copyright-free uploaded song)
 */
export async function addFullSong(params: AddFullSongParams): Promise<string> {
  const walletClient = initWalletClient()
  const publicClient = initPublicClient()

  console.log('📤 Adding song to KaraokeCatalogV2...')
  console.log(`   ID: ${params.id}`)
  console.log(`   Title: ${params.title}`)
  console.log(`   Artist: ${params.artist}`)
  console.log(`   Duration: ${params.duration}s`)

  const hash = await walletClient.writeContract({
    address: config.contract.address,
    abi: KARAOKE_CATALOG_ABI,
    functionName: 'addFullSong',
    args: [params],
  })

  console.log(`   TX submitted: ${hash}`)
  console.log(`   Waiting for confirmation...`)

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
  })

  if (receipt.status === 'success') {
    console.log(`✅ Song added to catalog!`)
    console.log(`   Block: ${receipt.blockNumber}`)
    console.log(`   Gas: ${receipt.gasUsed}`)
  } else {
    throw new Error(`Transaction failed: ${receipt.status}`)
  }

  return hash
}

/**
 * Add segments with stems to catalog
 */
export async function processSegmentsBatch(params: ProcessSegmentsBatchParams): Promise<string> {
  const walletClient = initWalletClient()
  const publicClient = initPublicClient()

  console.log('📤 Adding segments to KaraokeCatalogV2...')
  console.log(`   Song ID: ${params.songId}`)
  console.log(`   Segments: ${params.segmentIds.length}`)

  const hash = await walletClient.writeContract({
    address: config.contract.address,
    abi: KARAOKE_CATALOG_ABI,
    functionName: 'processSegmentsBatch',
    args: [
      params.geniusId,
      params.songId,
      params.segmentIds,
      params.sectionTypes,
      params.vocalsUris,
      params.drumsUris,
      params.audioSnippetUris,
      params.startTimes,
      params.endTimes,
    ],
  })

  console.log(`   TX submitted: ${hash}`)
  console.log(`   Waiting for confirmation...`)

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
  })

  if (receipt.status === 'success') {
    console.log(`✅ Segments added to catalog!`)
    console.log(`   Block: ${receipt.blockNumber}`)
    console.log(`   Gas: ${receipt.gasUsed}`)
  } else {
    throw new Error(`Transaction failed: ${receipt.status}`)
  }

  return hash
}
