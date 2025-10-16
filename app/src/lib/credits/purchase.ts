/**
 * Credit Purchase Module
 * Handles all credit purchase operations separate from state machine
 */

import { executeTransactionWithPKP } from '@/lib/lit/pkp-transaction'
import type { PKPAuthContext, PKPInfo } from '@/lib/lit-webauthn/types'
import type { Hash } from 'viem'
import {
  encodeFunctionData,
  formatUnits,
  createPublicClient,
  http
} from 'viem'
import { baseSepolia } from 'viem/chains'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'

const KARAOKE_CREDITS_CONTRACT = BASE_SEPOLIA_CONTRACTS.karaokeCredits
const USDC_ADDRESS = BASE_SEPOLIA_CONTRACTS.usdc

export interface PurchaseResult {
  txHash: Hash
  creditsAdded: number
}

export interface PackageInfo {
  credits: number
  priceUSDC: bigint
  priceETH: bigint
  enabled: boolean
}

/**
 * Fetch package details from contract
 */
export async function getPackageInfo(packageId: number): Promise<PackageInfo> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  })

  const data = await publicClient.readContract({
    address: KARAOKE_CREDITS_CONTRACT,
    abi: [{
      name: 'packages',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'packageId', type: 'uint8' }],
      outputs: [
        { name: 'credits', type: 'uint16' },
        { name: 'priceUSDC', type: 'uint256' },
        { name: 'priceETH', type: 'uint256' },
        { name: 'enabled', type: 'bool' },
      ],
    }],
    functionName: 'packages',
    args: [packageId],
  }) as [number, bigint, bigint, boolean]

  const [credits, priceUSDC, priceETH, enabled] = data

  return { credits, priceUSDC, priceETH, enabled }
}

/**
 * Purchase credits with USDC
 * Handles approval and purchase in one transaction flow
 */
export async function purchaseCreditsWithUSDC(
  packageId: number,
  pkpAuthContext: PKPAuthContext,
  pkpInfo: PKPInfo
): Promise<PurchaseResult> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  })

  // 1. Fetch package info
  const pkg = await getPackageInfo(packageId)

  if (!pkg.enabled) {
    throw new Error(`Package ${packageId} is not enabled`)
  }

  // 2. Check USDC balance
  const usdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: [{
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    }],
    functionName: 'balanceOf',
    args: [pkpInfo.ethAddress],
  }) as bigint

  console.log('[PurchaseCredits] Balance check:', {
    balance: formatUnits(usdcBalance, 6),
    required: formatUnits(pkg.priceUSDC, 6),
    hasEnough: usdcBalance >= pkg.priceUSDC,
  })

  if (usdcBalance < pkg.priceUSDC) {
    throw new Error(
      `Insufficient USDC balance. Need ${formatUnits(pkg.priceUSDC, 6)} USDC, ` +
      `have ${formatUnits(usdcBalance, 6)} USDC. ` +
      `Please fund your PKP wallet at ${pkpInfo.ethAddress}`
    )
  }

  // 3. Approve USDC spending
  const approveData = encodeFunctionData({
    abi: [{
      name: 'approve',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    }],
    functionName: 'approve',
    args: [KARAOKE_CREDITS_CONTRACT, pkg.priceUSDC],
  })

  console.log('[PurchaseCredits] Approving USDC spending...')
  const approveTxHash = await executeTransactionWithPKP({
    to: USDC_ADDRESS,
    data: approveData,
    pkpAuthContext,
    pkpInfo,
  })

  // 4. Wait for approval confirmation
  console.log('[PurchaseCredits] Waiting for approval confirmation...')
  const { waitForTransactionReceipt } = await import('viem/actions')

  const receipt = await waitForTransactionReceipt(publicClient, {
    hash: approveTxHash,
    confirmations: 2,
  })

  if (receipt.status === 'reverted') {
    throw new Error('Approval transaction reverted')
  }

  console.log('[PurchaseCredits] ✅ Approval confirmed, waiting for indexing...')
  await new Promise(resolve => setTimeout(resolve, 2000))

  // 5. Purchase credits
  const purchaseData = encodeFunctionData({
    abi: [{
      name: 'purchaseCreditsUSDC',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'packageId', type: 'uint8' }],
      outputs: [],
    }],
    functionName: 'purchaseCreditsUSDC',
    args: [packageId],
  })

  console.log('[PurchaseCredits] Purchasing credits...')
  const txHash = await executeTransactionWithPKP({
    to: KARAOKE_CREDITS_CONTRACT,
    data: purchaseData,
    pkpAuthContext,
    pkpInfo,
  })

  console.log('[PurchaseCredits] Waiting for purchase confirmation...')
  const purchaseReceipt = await waitForTransactionReceipt(publicClient, {
    hash: txHash,
    confirmations: 2,
  })

  if (purchaseReceipt.status === 'reverted') {
    throw new Error('Purchase transaction reverted')
  }

  console.log('[PurchaseCredits] ✅ Purchase confirmed, waiting for indexing...')
  await new Promise(resolve => setTimeout(resolve, 3000))

  console.log('[PurchaseCredits] ✅ Purchase complete! TX:', txHash)

  return {
    txHash,
    creditsAdded: pkg.credits,
  }
}

/**
 * Simpler wrapper for purchasing credits (defaults to USDC)
 */
export async function purchaseCredits({
  packageId,
  pkpAuthContext,
  pkpInfo,
}: {
  packageId: number
  pkpAuthContext: PKPAuthContext
  pkpInfo: PKPInfo
}): Promise<PurchaseResult> {
  return purchaseCreditsWithUSDC(packageId, pkpAuthContext, pkpInfo)
}
