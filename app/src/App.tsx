import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import React, { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { ConnectKitProvider, getParticleConfig } from './lib/particle/client'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { PostFlowContainer } from './features/post-flow/PostFlowContainer'

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Get Particle config (which includes wagmi config)
const particleConfig = getParticleConfig()

// Placeholder pages - we'll create these properly
function HomePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">Karaoke School</h1>
        <p className="text-muted-foreground">Home / Feed coming soon</p>
      </div>
    </div>
  )
}

function ClassPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">Class</h1>
        <p className="text-muted-foreground">Learning content coming soon</p>
      </div>
    </div>
  )
}

function KaraokePage() {
  const navigate = useNavigate()

  // Public page - no auth checks here
  // Auth is checked when user selects a song in PostFlowContainer
  return <PostFlowContainer open={true} onClose={() => navigate('/')} />
}

function InboxPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">Inbox</h1>
        <p className="text-muted-foreground">Messages coming soon</p>
      </div>
    </div>
  )
}

function ProfilePage() {
  const {
    isWalletConnected,
    walletAddress,
    walletClient,
    lensAccount,
    hasLensAccount,
    lensSession,
    litReady,
    loginLens,
    createLensAccountWithUsername,
    refreshLensAccount,
    initializeLit,
    isAuthenticating,
    authError
  } = useAuth()
  const [username, setUsername] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [credits, setCredits] = React.useState<number | null>(null)

  const handleLoginLens = async () => {
    try {
      setStatus('Logging in to Lens...')
      await loginLens()
      console.log('[ProfilePage] After loginLens:', { lensSession, hasLensAccount, lensAccount })
      setStatus('Logged in to Lens! ✅')
    } catch (error) {
      console.error('[ProfilePage] Login error:', error)
      setStatus(`Login error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleCreateAccount = async () => {
    if (!username) {
      setStatus('Please enter a username')
      return
    }
    try {
      setStatus('Creating Lens account...')
      // Using a valid Arweave URI format
      // In production, you'd upload actual metadata to Arweave/IPFS
      const metadataUri = 'ar://jVechMdgJdRKGaE72VNYRD1hqz7R_7cc8PykLkKvPqE'
      await createLensAccountWithUsername(username, metadataUri)
      setStatus('Account created! ✅')
    } catch (error) {
      console.error('[ProfilePage] Create account full error:', error)
      setStatus(`Create error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleRefreshAccount = async () => {
    try {
      setStatus('Refreshing account...')
      await refreshLensAccount()
      setStatus('Account refreshed! ✅')
    } catch (error) {
      console.error('[ProfilePage] Refresh error:', error)
      setStatus(`Refresh error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleInitializeLit = async () => {
    try {
      setStatus('Initializing Lit Protocol...')
      await initializeLit()
      setStatus('Lit Protocol initialized! ✅')
    } catch (error) {
      console.error('[ProfilePage] Lit init error:', error)
      setStatus(`Lit init error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Load credit balance when wallet connects
  React.useEffect(() => {
    if (walletAddress && walletClient) {
      loadCredits()
    }
  }, [walletAddress, walletClient])

  const loadCredits = async () => {
    if (!walletAddress) return

    try {
      const { createPublicClient, http } = await import('viem')
      const { baseSepolia } = await import('viem/chains')

      const contractAddress = import.meta.env.VITE_KARAOKE_CREDITS_CONTRACT as `0x${string}`

      // Create public client for Base Sepolia
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      })

      const data = await publicClient.readContract({
        address: contractAddress,
        abi: [{
          name: 'getCredits',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'user', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        }],
        functionName: 'getCredits',
        args: [walletAddress],
      })

      setCredits(Number(data))
      console.log('[Credits] Balance:', data)
    } catch (error) {
      console.error('[Credits] Load error:', error)
      // Set to 0 on error so button doesn't stay disabled
      setCredits(0)
    }
  }

  const handlePurchaseCredits = async () => {
    if (!walletClient || !walletAddress) return

    try {
      setStatus('Purchasing credits...')

      const contractAddress = import.meta.env.VITE_KARAOKE_CREDITS_CONTRACT as `0x${string}`

      // Package 0: 1 credit for 0.0002 ETH (~$0.50)
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: [{
          name: 'purchaseCreditsETH',
          type: 'function',
          stateMutability: 'payable',
          inputs: [{ name: 'packageId', type: 'uint8' }],
          outputs: [],
        }],
        functionName: 'purchaseCreditsETH',
        args: [0], // Package 0: 1 credit
        value: BigInt('200000000000000'), // 0.0002 ETH
      })

      console.log('[Credits] Purchase tx:', hash)

      // Reload balance (transaction already confirmed by wallet)
      setTimeout(() => loadCredits(), 2000)

      setStatus(`Purchase complete! ✅ TX: ${hash.slice(0, 10)}...`)
    } catch (error) {
      console.error('[Credits] Purchase error:', error)
      setStatus(`Purchase error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleTestLitAction = async () => {
    if (!walletClient) return

    try {
      setStatus('Testing Match & Segment for Sia - Chandelier (378195)...')

      // Import karaoke actions helper
      const { executeMatchAndSegment, formatSection } = await import('@/lib/lit/actions')

      // Execute Lit Action
      const result = await executeMatchAndSegment(378195, walletClient)

      if (result.success && result.isMatch) {
        const sectionsText = result.sections?.slice(0, 3).map(formatSection).join(', ') || 'None'
        setStatus(`✅ Match: ${result.genius?.artist} - ${result.genius?.title} (${result.confidence}) | ${result.sections?.length || 0} sections: ${sectionsText}...`)

        // Log full result
        console.log('[Test] Full result:', result)
      } else if (result.success && !result.isMatch) {
        setStatus(`❌ No match found (${result.confidence})`)
      } else {
        setStatus(`❌ Lit Action error: ${result.error}`)
      }

    } catch (error) {
      console.error('[Test] Lit Action execution failed:', error)
      setStatus(`❌ Test error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">Lens Test</h1>
        </div>

        <div className="bg-sidebar border border-border rounded-lg p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Wallet:</p>
            <p className="font-mono text-sm">{isWalletConnected ? walletAddress : 'Not connected'}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Lens Session:</p>
            <p className="text-sm">{lensSession ? '✅ Active' : '❌ Not logged in'}</p>
            <p className="text-xs text-muted-foreground">lensSession: {String(!!lensSession)}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Lens Account:</p>
            <p className="text-sm">{hasLensAccount ? `✅ ${lensAccount?.account?.username?.value || lensAccount?.account?.address}` : '❌ No account'}</p>
            <p className="text-xs text-muted-foreground">hasLensAccount: {String(hasLensAccount)}, lensAccount: {String(!!lensAccount)}</p>
            {lensAccount && (
              <p className="text-xs text-muted-foreground mt-1">
                Address: {lensAccount.account?.address?.slice(0, 10)}...
              </p>
            )}
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Lit Protocol:</p>
            <p className="text-sm">{litReady ? '✅ Ready' : '❌ Not initialized'}</p>
            <p className="text-xs text-muted-foreground">litReady: {String(litReady)}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Karaoke Credits:</p>
            <p className="text-sm">{credits !== null ? `${credits} credits` : 'Loading...'}</p>
            <p className="text-xs text-muted-foreground">Contract: Base Sepolia</p>
          </div>
        </div>

        {isWalletConnected && !lensSession && (
          <button
            onClick={handleLoginLens}
            disabled={isAuthenticating}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isAuthenticating ? 'Logging in...' : 'Login to Lens'}
          </button>
        )}

        {lensSession && !hasLensAccount && (
          <div className="space-y-3">
            <button
              onClick={handleRefreshAccount}
              disabled={isAuthenticating}
              className="w-full bg-yellow-600 text-white py-3 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
            >
              {isAuthenticating ? 'Refreshing...' : 'Refresh Account'}
            </button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or create new</span>
              </div>
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username (5+ chars)"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg"
            />
            <button
              onClick={handleCreateAccount}
              disabled={isAuthenticating || !username}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isAuthenticating ? 'Creating...' : 'Create Lens Account'}
            </button>
          </div>
        )}

        {hasLensAccount && !litReady && (
          <button
            onClick={handleInitializeLit}
            disabled={isAuthenticating}
            className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {isAuthenticating ? 'Initializing...' : 'Initialize Lit Protocol'}
          </button>
        )}

        {litReady && (
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground">All Systems Ready! 🎉</h3>
              <p className="text-sm text-muted-foreground mt-1">Test flows</p>
            </div>

            <button
              onClick={handlePurchaseCredits}
              disabled={isAuthenticating}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {isAuthenticating ? 'Purchasing...' : 'Buy 1 Credit (0.0002 ETH)'}
            </button>

            <button
              onClick={handleTestLitAction}
              disabled={isAuthenticating || !credits || credits === 0}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isAuthenticating ? 'Processing...' : 'Test Lit Action (Genius 378195)'}
            </button>

            <p className="text-xs text-muted-foreground text-center">
              {credits && credits > 0 ? `You have ${credits} credit(s)` : 'Purchase credits to test Lit Action'}
            </p>
          </div>
        )}

        {status && (
          <div className="bg-sidebar border border-border rounded-lg p-4">
            <p className="text-sm">{status}</p>
          </div>
        )}

        {authError && (
          <div className="bg-red-900/20 border border-red-600 rounded-lg p-4">
            <p className="text-sm text-red-400">{authError.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Router component with navigation state
function AppRouter() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'home' | 'study' | 'post' | 'inbox' | 'profile'>('home')

  // Get auth context
  const { isWalletConnected, walletAddress, connectWallet, disconnectWallet } = useAuth()

  // Sync active tab with current route
  useEffect(() => {
    const pathToTab: Record<string, 'home' | 'study' | 'post' | 'inbox' | 'profile'> = {
      '/': 'home',
      '/class': 'study',
      '/karaoke': 'post',
      '/inbox': 'inbox',
      '/profile': 'profile'
    }
    const tab = pathToTab[location.pathname] || 'home'
    setActiveTab(tab)
  }, [location.pathname])

  const handleTabChange = (tab: 'home' | 'study' | 'post' | 'inbox' | 'profile') => {
    const routes = {
      home: '/',
      study: '/class',
      post: '/karaoke',
      inbox: '/inbox',
      profile: '/profile'
    }
    navigate(routes[tab])
  }

  return (
    <AppLayout
      activeTab={activeTab}
      onTabChange={handleTabChange}
      isConnected={isWalletConnected}
      walletAddress={walletAddress || undefined}
      onConnectWallet={connectWallet}
      onDisconnect={disconnectWallet}
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/class" element={<ClassPage />} />
        <Route path="/karaoke" element={<KaraokePage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:address" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConnectKitProvider config={particleConfig}>
        <WagmiProvider config={particleConfig}>
          <AuthProvider>
            <HashRouter>
              <AppRouter />
            </HashRouter>
          </AuthProvider>
        </WagmiProvider>
      </ConnectKitProvider>
    </QueryClientProvider>
  )
}

export default App
