/**
 * useSongPurchase - Unified hook for song purchase dialog logic
 *
 * Encapsulates all purchase-related state and handlers:
 * - Dialog open/close state
 * - Chain selection and balance fetching
 * - Auto-select Base chain when dialog opens
 * - Purchase flow integration with useSongAccess
 *
 * Used by both SongPlayPage and KaraokePracticePage
 */

import { createSignal, createMemo, createEffect, type Accessor } from 'solid-js'
import { createPublicClient, http, type Address } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import type { ChainOption, ChainBalances } from '@/components/purchase/ChainSelectorGrid'
import type { PurchaseStep } from '@/components/purchase/types'
import type { UsePaymentWalletResult } from './usePaymentWallet'

const IS_DEV = import.meta.env.DEV

// Use Base Sepolia in dev, Base mainnet in production
const activeChain = IS_DEV ? baseSepolia : base

// Base chain config (only enabled chain for now)
const BASE_CHAIN: ChainOption = {
  id: activeChain.id,
  name: IS_DEV ? 'Base Sepolia' : 'Base',
  icon: '/images/base-chain.svg',
  nativeToken: 'ETH',
}

// Public client for fetching balances
const baseClient = createPublicClient({
  chain: activeChain,
  transport: http(),
})

export interface UseSongPurchaseOptions {
  /** Song access state machine */
  songAccess: {
    state: () => string
    isOwned: () => boolean
    isPurchasing: () => boolean
    purchaseSubState: () => string | null
    error: () => string | undefined
    purchase: () => Promise<void>
    reset: () => void
    retryDecrypt: () => void
  }
  /** Payment wallet hook result */
  paymentWallet: UsePaymentWalletResult
  /** Auth context for checking authentication */
  auth: {
    pkpAddress: Accessor<string | null>
    openAuthDialog: () => void
  }
}

export interface UseSongPurchaseResult {
  /** Whether purchase dialog is open */
  showDialog: Accessor<boolean>
  /** Open the purchase dialog */
  openDialog: () => void
  /** Close the purchase dialog */
  closeDialog: () => void
  /** Handle dialog open/close changes */
  handleDialogChange: (open: boolean) => void
  /** Current dialog step */
  dialogStep: Accessor<PurchaseStep>
  /** Selected chain */
  selectedChain: Accessor<ChainOption | undefined>
  /** Chain balances */
  chainBalances: Accessor<ChainBalances>
  /** Handle chain selection */
  handleChainSelect: (chain: ChainOption) => void
  /** Handle balance refresh */
  handleRefreshBalance: () => void
  /** Handle purchase confirmation */
  handlePurchaseConfirm: () => Promise<void>
  /** Handle retry after error */
  handleRetry: () => void
  /** Handle unlock button click (checks auth, opens dialog or retries decrypt) */
  handleUnlockClick: () => void
}

export function useSongPurchase(options: UseSongPurchaseOptions): UseSongPurchaseResult {
  const { songAccess, paymentWallet, auth } = options

  // Dialog state
  const [showDialog, setShowDialog] = createSignal(false)
  const [selectedChain, setSelectedChain] = createSignal<ChainOption | undefined>()
  const [chainBalances, setChainBalances] = createSignal<ChainBalances>({})

  // Map song access state to dialog step
  const dialogStep = createMemo((): PurchaseStep => {
    const state = songAccess.state()
    const isPurchasing = songAccess.isPurchasing()
    const subState = songAccess.purchaseSubState()
    const error = songAccess.error()
    const isOwned = songAccess.isOwned()

    if (!isPurchasing && state === 'not-owned') {
      if (error) return 'error'
      return 'idle'
    }

    if (isPurchasing) {
      switch (subState) {
        case 'checking-balance':
          return 'checking'
        case 'signing':
          return 'signing'
        case 'confirming':
          return 'purchasing'
        default:
          return 'checking'
      }
    }

    // After purchase success, show complete if dialog is still open
    if (isOwned && showDialog()) {
      return 'complete'
    }

    return 'idle'
  })

  // Fetch ETH balance on selected chain
  const fetchChainBalance = async (walletAddr: string) => {
    setChainBalances({ loading: true })
    try {
      const balance = await baseClient.getBalance({ address: walletAddr as Address })
      const ethBalance = Number(balance) / 1e18
      setChainBalances({ native: ethBalance })
      if (IS_DEV) {
        console.log('[useSongPurchase] Fetched balance:', ethBalance, 'ETH')
      }
    } catch (err) {
      console.error('[useSongPurchase] Error fetching balance:', err)
      setChainBalances({ native: 0 })
    }
  }

  // Handle chain selection
  const handleChainSelect = (chain: ChainOption) => {
    if (IS_DEV) {
      console.log('[useSongPurchase] handleChainSelect:', {
        chain: chain.name,
        walletAddr: paymentWallet.walletAddress(),
      })
    }
    setSelectedChain(chain)
    const walletAddr = paymentWallet.walletAddress()
    if (walletAddr) {
      fetchChainBalance(walletAddr)
    }
  }

  // Handle balance refresh (after user sends funds)
  const handleRefreshBalance = () => {
    const walletAddr = paymentWallet.walletAddress()
    if (walletAddr && selectedChain()) {
      fetchChainBalance(walletAddr)
    }
  }

  // Handle dialog close - reset chain selection
  const handleDialogChange = (open: boolean) => {
    setShowDialog(open)
    if (!open) {
      setSelectedChain(undefined)
      setChainBalances({})
    }
  }

  // Handle unlock button click
  const handleUnlockClick = () => {
    const pkpAddress = auth.pkpAddress()

    if (!pkpAddress) {
      // Not authenticated - open auth dialog
      auth.openAuthDialog()
      return
    }

    // If decrypt failed, retry instead of showing dialog
    if (songAccess.state() === 'owned-decrypt-failed') {
      songAccess.retryDecrypt()
      return
    }

    setShowDialog(true)
  }

  // Handle purchase confirmation
  const handlePurchaseConfirm = async () => {
    const pkpAddress = auth.pkpAddress()

    if (!pkpAddress) {
      auth.openAuthDialog()
      return
    }

    await songAccess.purchase()
  }

  // Handle retry after error
  const handleRetry = () => {
    songAccess.reset()
    // Keep dialog open for retry
  }

  // Auto-select Base when dialog opens and wallet is available
  createEffect(() => {
    const walletAddr = paymentWallet.walletAddress()
    const dialogOpen = showDialog()
    const chain = selectedChain()

    if (IS_DEV) {
      console.log('[useSongPurchase] Auto-select effect:', {
        dialogOpen,
        walletAddr,
        selectedChain: chain?.name,
        willAutoSelect: dialogOpen && !chain && !!walletAddr,
      })
    }

    if (dialogOpen && !chain && walletAddr) {
      if (IS_DEV) {
        console.log('[useSongPurchase] Auto-selecting Base chain')
      }
      handleChainSelect(BASE_CHAIN)
    }
  })

  return {
    showDialog,
    openDialog: () => setShowDialog(true),
    closeDialog: () => handleDialogChange(false),
    handleDialogChange,
    dialogStep,
    selectedChain,
    chainBalances,
    handleChainSelect,
    handleRefreshBalance,
    handlePurchaseConfirm,
    handleRetry,
    handleUnlockClick,
  }
}
