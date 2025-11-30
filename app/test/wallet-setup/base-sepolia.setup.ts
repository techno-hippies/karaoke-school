/**
 * Wallet setup with Base Sepolia network pre-configured
 *
 * This creates a MetaMask wallet configured with:
 * - Test seed phrase imported
 * - Base Sepolia network added and selected
 */
import { defineWalletSetup } from '@synthetixio/synpress'
import { MetaMask } from '@synthetixio/synpress/playwright'

// Test seed phrase - DO NOT use for real funds
const SEED_PHRASE = 'test test test test test test test test test test test junk'
const PASSWORD = 'Tester@1234'

// Base Sepolia network configuration
const BASE_SEPOLIA = {
  name: 'Base Sepolia',
  rpcUrl: 'https://sepolia.base.org',
  chainId: 84532,
  symbol: 'ETH',
  blockExplorerUrl: 'https://sepolia.basescan.org',
}

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  // Create MetaMask instance and import wallet
  const metamask = new MetaMask(context, walletPage, PASSWORD)
  await metamask.importWallet(SEED_PHRASE)

  // Add Base Sepolia network
  await metamask.addNetwork(BASE_SEPOLIA)

  // Switch to Base Sepolia
  await metamask.switchNetwork('Base Sepolia')
})
