/**
 * Basic wallet setup for Synpress E2E tests
 *
 * This creates a MetaMask wallet with a test seed phrase.
 * The wallet cache is built once and reused across tests.
 */
import { defineWalletSetup } from '@synthetixio/synpress'
import { MetaMask } from '@synthetixio/synpress/playwright'

// Test seed phrase - DO NOT use for real funds
// This is Hardhat's default test account
const SEED_PHRASE = 'test test test test test test test test test test test junk'
const PASSWORD = 'Tester@1234'

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  // Create MetaMask instance and import wallet
  const metamask = new MetaMask(context, walletPage, PASSWORD)
  await metamask.importWallet(SEED_PHRASE)

  // Note: We don't add Base Sepolia network here because:
  // 1. The app uses RainbowKit which auto-suggests network switching
  // 2. Tests will prompt MetaMask to switch networks when needed
})
