/**
 * Subscription Purchase Module
 * Handles purchasing Unlock Protocol subscription keys with PKP
 */

import { executeTransactionWithPKP } from '@/lib/lit/pkp-transaction'
import type { PKPAuthContext, PKPInfo } from '@/lib/lit-webauthn/types'
import type { Hash } from 'viem'
import {
  encodeFunctionData,
  createPublicClient,
  http,
  formatUnits,
} from 'viem'
import { baseSepolia } from 'viem/chains'
import { getLockInfo } from './queries'
import { BASE_SEPOLIA_CONTRACTS } from '@/config/contracts'

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
})

const USDC_ADDRESS = BASE_SEPOLIA_CONTRACTS.usdc

/**
 * Minimal PublicLock ABI for purchasing
 */
const PUBLIC_LOCK_ABI = [
  {
    inputs: [
      { type: 'uint256[]', name: '_values' },
      { type: 'address[]', name: '_recipients' },
      { type: 'address[]', name: '_referrers' },
      { type: 'address[]', name: '_keyManagers' },
      { type: 'bytes[]', name: '_data' },
    ],
    name: 'purchase',
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

export interface SubscriptionPurchaseResult {
  txHash: Hash
  keyPrice: bigint
}

/**
 * Purchase subscription key with PKP wallet
 * Handles both ETH and ERC20 (USDC) payments
 * Similar to purchaseCreditsWithUSDC - uses approval flow for USDC
 */
export async function purchaseSubscription(
  lockAddress: string,
  pkpAuthContext: PKPAuthContext,
  pkpInfo: PKPInfo
): Promise<SubscriptionPurchaseResult> {
  console.log('[PurchaseSubscription] Starting purchase...', {
    lockAddress,
    buyer: pkpInfo.ethAddress,
  })

  // 1. Get key price and payment token from lock
  const lockInfo = await getLockInfo(lockAddress)
  const keyPrice = lockInfo.keyPrice
  const isNativePayment = lockInfo.isNativePayment

  console.log('[PurchaseSubscription] Lock info:', {
    keyPrice: lockInfo.keyPriceFormatted,
    duration: `${lockInfo.durationDays} days`,
    paymentToken: isNativePayment ? 'Native ETH' : `ERC20 (${lockInfo.tokenAddress})`,
  })

  // 2. Handle USDC payment (requires approval)
  if (!isNativePayment && lockInfo.tokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
    console.log('[PurchaseSubscription] Using USDC payment with approval flow')

    // 2a. Check USDC balance
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
      args: [pkpInfo.ethAddress as `0x${string}`],
    }) as bigint

    console.log('[PurchaseSubscription] USDC Balance check:', {
      balance: formatUnits(usdcBalance, 6),
      required: formatUnits(keyPrice, 6),
      hasEnough: usdcBalance >= keyPrice,
    })

    if (usdcBalance < keyPrice) {
      throw new Error(
        `Insufficient USDC balance. Need ${formatUnits(keyPrice, 6)} USDC, ` +
        `have ${formatUnits(usdcBalance, 6)} USDC. ` +
        `Please fund your PKP wallet at ${pkpInfo.ethAddress}`
      )
    }

    // 2b. Approve USDC spending
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
      args: [lockAddress as `0x${string}`, keyPrice],
    })

    console.log('[PurchaseSubscription] Approving USDC spending...')
    const approveTxHash = await executeTransactionWithPKP({
      to: USDC_ADDRESS,
      data: approveData,
      pkpAuthContext,
      pkpInfo,
    })

    // 2c. Wait for approval confirmation
    console.log('[PurchaseSubscription] Waiting for approval confirmation...')
    const { waitForTransactionReceipt } = await import('viem/actions')

    const approveReceipt = await waitForTransactionReceipt(publicClient, {
      hash: approveTxHash,
      confirmations: 2,
    })

    if (approveReceipt.status === 'reverted') {
      throw new Error('Approval transaction reverted')
    }

    console.log('[PurchaseSubscription] ✅ Approval confirmed, waiting for indexing...')
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  // 3. Handle native ETH payment
  else if (isNativePayment) {
    console.log('[PurchaseSubscription] Using native ETH payment')

    // Check ETH balance
    const ethBalance = await publicClient.getBalance({
      address: pkpInfo.ethAddress as `0x${string}`,
    })

    console.log('[PurchaseSubscription] ETH Balance check:', {
      balance: formatUnits(ethBalance, 18),
      required: formatUnits(keyPrice, 18),
      hasEnough: ethBalance >= keyPrice,
    })

    if (ethBalance < keyPrice) {
      throw new Error(
        `Insufficient ETH balance. Need ${formatUnits(keyPrice, 18)} ETH, ` +
        `have ${formatUnits(ethBalance, 18)} ETH. ` +
        `Please fund your PKP wallet at ${pkpInfo.ethAddress}`
      )
    }
  }

  // 4. Encode purchase call
  // purchase(uint256[] _values, address[] _recipients, address[] _referrers, address[] _keyManagers, bytes[] _data)
  const purchaseData = encodeFunctionData({
    abi: PUBLIC_LOCK_ABI,
    functionName: 'purchase',
    args: [
      [keyPrice], // _values (array of prices for each key)
      [pkpInfo.ethAddress as `0x${string}`], // _recipients (who receives the key)
      [pkpInfo.ethAddress as `0x${string}`], // _referrers (referral address, can be same as buyer)
      [pkpInfo.ethAddress as `0x${string}`], // _keyManagers (who can manage the key)
      ['0x'], // _data (additional data, none needed)
    ],
  })

  console.log('[PurchaseSubscription] Executing purchase transaction...')

  // 5. Execute transaction with PKP
  const txHash = await executeTransactionWithPKP({
    to: lockAddress as `0x${string}`,
    data: purchaseData,
    value: isNativePayment ? keyPrice : undefined, // Only send ETH for native payments
    pkpAuthContext,
    pkpInfo,
  })

  // 6. Wait for confirmation
  console.log('[PurchaseSubscription] Waiting for purchase confirmation...')
  const { waitForTransactionReceipt } = await import('viem/actions')

  const receipt = await waitForTransactionReceipt(publicClient, {
    hash: txHash,
    confirmations: 2,
  })

  if (receipt.status === 'reverted') {
    throw new Error('Purchase transaction reverted')
  }

  console.log('[PurchaseSubscription] ✅ Purchase confirmed, waiting for indexing...')
  await new Promise(resolve => setTimeout(resolve, 3000))

  console.log('[PurchaseSubscription] ✅ Purchase complete! TX:', txHash)

  return {
    txHash,
    keyPrice,
  }
}

/**
 * Simpler wrapper for purchasing subscription
 */
export async function purchaseSubscriptionKey({
  lockAddress,
  pkpAuthContext,
  pkpInfo,
}: {
  lockAddress: string
  pkpAuthContext: PKPAuthContext
  pkpInfo: PKPInfo
}): Promise<{ success: boolean; txHash?: Hash; keyPrice?: bigint; error?: string }> {
  try {
    const result = await purchaseSubscription(lockAddress, pkpAuthContext, pkpInfo)
    return {
      success: true,
      ...result,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to purchase subscription'
    console.error('[PurchaseSubscription] ❌ Failed:', errorMsg)

    return {
      success: false,
      error: errorMsg,
    }
  }
}
