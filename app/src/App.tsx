import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LensProvider } from '@lens-protocol/react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { VideoPlaybackProvider } from './contexts/VideoPlaybackContext'
import { AppLayout } from './components/layout/AppLayout'
import { AuthDialog } from './components/layout/AuthDialog'
import { Toaster } from './components/ui/sonner'
import { lensClient } from './lens/client'

// Page imports
import { HomePage } from './pages/HomePage'
import { ClassPage } from './pages/ClassPage'
import { ClassArtistPage } from './pages/ClassArtistPage'
import { WalletPage } from './pages/WalletPage'
import { KaraokePage } from './components/karaoke/KaraokePage'
import { KaraokeSongPage } from './components/karaoke/KaraokeSongPage'
import { KaraokeSegmentPage } from './components/karaoke/KaraokeSegmentPage'
import { ProfilePage } from './components/profile/ProfilePage'
import { VideoDetailPage } from './pages/VideoDetailPage'
import { StudyExercisePageContainer } from './pages/StudyExercisePageContainer'
import { useParams } from 'react-router-dom'

// Wrapper to ensure ProfilePage remounts when username changes
function ProfilePageWrapper() {
  const { username, address } = useParams<{ username?: string; address?: string }>()
  const key = username || address || 'default'
  return <ProfilePage key={key} />
}

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
  const [pendingUsername, setPendingUsername] = useState<string | null>(null)
  const [usernameAvailability, setUsernameAvailability] = useState<'checking' | 'available' | 'unavailable' | null>(null)
  const checkUsernameTimeoutRef = useRef<NodeJS.Timeout>()

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
    showUsernameInput,
    resetAuthFlow,
    loginLens,
    logout,
    pkpAddress,
  } = useAuth()

  // Map routes to active tabs
  const [activeTab, setActiveTab] = useState<'home' | 'study' | 'search' | 'wallet' | 'profile' | 'none'>('home')

  useEffect(() => {
    const pathToTab: Record<string, 'home' | 'study' | 'search' | 'wallet' | 'profile' | 'none'> = {
      '/': 'home',
      '/class': 'study',
      '/search': 'search',
      '/wallet': 'wallet',
      '/profile': 'profile',
    }

    // Deep routes (song, artist, segment pages) should have no tab selected
    if (location.pathname.startsWith('/song/') ||
        location.pathname.startsWith('/artist/') ||
        location.pathname.startsWith('/class/') ||
        location.pathname.startsWith('/u/') ||
        (location.pathname.startsWith('/profile/') && location.pathname !== '/profile')) {
      setActiveTab('none')
    } else {
      const tab = pathToTab[location.pathname] || 'home'
      setActiveTab(tab)
    }
  }, [location.pathname])

  const handleTabChange = (tab: 'home' | 'study' | 'search' | 'wallet' | 'profile') => {
    const routes = {
      home: '/',
      study: '/class',
      search: '/search',
      wallet: '/wallet',
      profile: '/profile'
    }
    navigate(routes[tab])
  }

  // Check username availability with debouncing
  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (username.trim().length < 6) {
      setUsernameAvailability(null)
      return
    }

    // Clear previous timeout
    if (checkUsernameTimeoutRef.current) {
      clearTimeout(checkUsernameTimeoutRef.current)
    }

    // Set checking state
    setUsernameAvailability('checking')

    // Debounce: wait 500ms before checking
    checkUsernameTimeoutRef.current = setTimeout(async () => {
      try {
        // TODO: Replace with actual Lens username availability check
        // For now, simulate with random delay
        await new Promise(resolve => setTimeout(resolve, 500))

        // Simulate: usernames starting with 'test' are unavailable
        const isAvailable = !username.toLowerCase().startsWith('test')
        setUsernameAvailability(isAvailable ? 'available' : 'unavailable')
      } catch (error) {
        console.error('[App] Username check error:', error)
        setUsernameAvailability(null)
      }
    }, 500)
  }, [])

  // Handle "Create Account" click - show username input
  const handleRegisterClick = useCallback(() => {
    setPendingUsername(null)
    setUsernameAvailability(null)
    showUsernameInput()
  }, [showUsernameInput])

  // Handle username submission - start actual registration
  const handleRegisterWithUsername = useCallback(async (username: string) => {
    setPendingUsername(username)
    await registerWithPasskey(username)
  }, [registerWithPasskey])

  // Handle back from username input
  const handleUsernameBack = useCallback(() => {
    setPendingUsername(null)
    setUsernameAvailability(null)
    resetAuthFlow()
  }, [resetAuthFlow])

  // Hide mobile footer on full-screen pages (song detail, artist detail, segment pages, study pages, video detail)
  const hideMobileFooter = location.pathname.match(/^\/song\/\d+/) || location.pathname.match(/^\/artist\/\d+/) || location.pathname.match(/^\/u\/[^/]+\/video\//)

  return (
    <>
      <AppLayout
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isConnected={isPKPReady && !!pkpAddress}
        walletAddress={pkpAddress || undefined}
        onConnectWallet={() => setShowAuthDialog(true)}
        onDisconnect={logout}
        hideMobileFooter={!!hideMobileFooter}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<KaraokePage />} />
          <Route path="/song/:geniusId" element={<KaraokeSongPage />} />
          <Route path="/song/:geniusId/segment/:segmentId" element={<KaraokeSegmentPage />} />
          <Route path="/song/:geniusId/segment/:segmentId/study" element={<StudyExercisePageContainer />} />
          <Route path="/artist/:geniusArtistId" element={<ClassArtistPage />} />
          <Route path="/class" element={<ClassPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* Lens v3 style username routing */}
          <Route path="/u/:username" element={<ProfilePageWrapper />} />
          {/* Video detail page */}
          <Route path="/u/:username/video/:postId" element={<VideoDetailPage />} />
          {/* Legacy address-based routing (fallback) */}
          <Route path="/profile/:address" element={<ProfilePageWrapper />} />
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
        usernameAvailability={usernameAvailability}
        isPKPReady={isPKPReady}
        hasSocialAccount={hasLensAccount}
        onRegister={handleRegisterClick}
        onRegisterWithUsername={handleRegisterWithUsername}
        onLogin={signInWithPasskey}
        onUsernameBack={handleUsernameBack}
        onUsernameChange={checkUsernameAvailability}
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
    <LensProvider client={lensClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <VideoPlaybackProvider>
            <HashRouter>
              <AppRouter />
            </HashRouter>
          </VideoPlaybackProvider>
        </AuthProvider>
      </QueryClientProvider>
    </LensProvider>
  )
}

export default App
