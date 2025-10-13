import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { AuthDialog } from './components/layout/AuthDialog'
import { Toaster } from './components/ui/sonner'

// Page imports
import { HomePage } from './pages/HomePage'
import { ClassPage } from './pages/ClassPage'
import { WalletPage } from './pages/WalletPage'
import { KaraokePage } from './components/karaoke/KaraokePage'
import { KaraokeSongPage } from './components/karaoke/KaraokeSongPage'
import { KaraokeSegmentPage } from './components/karaoke/KaraokeSegmentPage'
import { ProfilePage } from './components/profile/ProfilePage'

import './i18n/config'

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

/**
 * AppRouter - Main routing and layout component
 * Handles:
 * - Route definitions
 * - Active tab state
 * - Auth dialog
 * - Mobile footer visibility
 */
function AppRouter() {
  const location = useLocation()
  const navigate = useNavigate()
  const [showAuthDialog, setShowAuthDialog] = useState(false)

  const {
    isPKPReady,
    hasLensAccount,
    isAuthenticating,
    authStep,
    authMode,
    authStatus,
    authError,
    registerWithPasskey,
    signInWithPasskey,
    loginLens,
    logout,
    pkpAddress,
  } = useAuth()

  // Map routes to active tabs
  const [activeTab, setActiveTab] = useState<'home' | 'study' | 'post' | 'wallet' | 'profile'>('home')

  useEffect(() => {
    const pathToTab: Record<string, 'home' | 'study' | 'post' | 'wallet' | 'profile'> = {
      '/': 'home',
      '/class': 'study',
      '/karaoke': 'post',
      '/wallet': 'wallet',
      '/profile': 'profile',
    }

    const tab = pathToTab[location.pathname] || 'home'
    setActiveTab(tab)
  }, [location.pathname])

  const handleTabChange = (tab: 'home' | 'study' | 'post' | 'wallet' | 'profile') => {
    const routes = {
      home: '/',
      study: '/class',
      post: '/karaoke',
      wallet: '/wallet',
      profile: '/profile'
    }
    navigate(routes[tab])
  }

  // Hide mobile footer on full-screen pages (song detail, segment pages)
  const hideMobileFooter = location.pathname.match(/^\/karaoke\/song\/\d+/)

  return (
    <>
      <AppLayout
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isConnected={isPKPReady}
        walletAddress={pkpAddress || undefined}
        onConnectWallet={() => setShowAuthDialog(true)}
        onDisconnect={logout}
        hideMobileFooter={!!hideMobileFooter}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/class" element={<ClassPage />} />
          <Route path="/karaoke" element={<KaraokePage />} />
          <Route path="/karaoke/song/:geniusId" element={<KaraokeSongPage />} />
          <Route path="/karaoke/song/:geniusId/segment/:segmentId" element={<KaraokeSegmentPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:address" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>

      <AuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        currentStep={authStep}
        isAuthenticating={isAuthenticating}
        authMode={authMode}
        statusMessage={authStatus}
        errorMessage={authError?.message || ''}
        isPKPReady={isPKPReady}
        hasSocialAccount={hasLensAccount}
        onRegister={registerWithPasskey}
        onLogin={signInWithPasskey}
        onConnectSocial={loginLens}
      />

      <Toaster />
    </>
  )
}

/**
 * App - Root component with providers
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <AppRouter />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
