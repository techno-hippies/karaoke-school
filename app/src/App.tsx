import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LensProvider } from '@lens-protocol/react'
import { HomePage } from '@/pages/HomePage'
import { WalletPage } from '@/pages/WalletPage'
import { SearchPage } from '@/pages/SearchPage'
import { AccountPageContainer } from '@/pages/AccountPageContainer'
import { VideoDetailPage } from '@/pages/VideoDetailPage'
import { SongPageContainer } from '@/pages/SongPageContainer'
import { MediaPageContainer } from '@/pages/MediaPageContainer'
import { ProfilePageContainer } from '@/pages/ProfilePageContainer'
import { ClassPage } from '@/pages/ClassPage'
import { StudySessionPage } from '@/pages/StudySessionPage'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthDialog } from '@/components/layout/AuthDialog'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { VideoPlaybackProvider } from '@/contexts/VideoPlaybackContext'
import { validateUsernameFormat } from '@/lib/lens/account-creation'
import { lensClient } from '@/lib/lens/client'

// React Query client for data fetching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

/**
 * AppRouter - Main routing with layout and navigation state
 */
function AppRouter() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'home' | 'study' | 'search' | 'wallet' | 'profile' | 'none'>('home')

  // Auth from context
  const {
    isPKPReady,
    pkpAddress,
    hasLensAccount,
    isAuthenticating,
    authStep,
    authMode,
    authStatus,
    authError,
    register,
    signIn,
    showUsernameInput,
    resetAuthFlow,
  } = useAuth()

  // Dialog state
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [usernameAvailability, setUsernameAvailability] = useState<'available' | 'unavailable' | null>(null)

  // Map routes to active tabs
  useEffect(() => {
    const pathToTab: Record<string, 'home' | 'study' | 'search' | 'wallet' | 'profile' | 'none'> = {
      '/': 'home',
      '/search': 'search',
      '/study': 'study',
      '/wallet': 'wallet',
      '/profile': 'profile',
    }

    // Deep routes (song, creator pages) should have no tab selected
    if (location.pathname.startsWith('/song/') ||
        location.pathname.startsWith('/u/')) {
      setActiveTab('none')
    } else {
      const tab = pathToTab[location.pathname] || 'home'
      setActiveTab(tab)
    }
  }, [location.pathname])

  const handleTabChange = (tab: 'home' | 'study' | 'search' | 'wallet' | 'profile') => {
    const routes = {
      home: '/',
      study: '/study',
      search: '/search',
      wallet: '/wallet',
      profile: '/profile'
    }
    navigate(routes[tab])
  }

  // Auth Handlers
  const handleRegisterClick = useCallback(() => {
    showUsernameInput()
    setUsernameAvailability(null)
  }, [showUsernameInput])

  const handleRegisterWithUsername = useCallback(async (username: string) => {
    try {
      await register(username)

      // After successful registration, close dialog after showing success
      setTimeout(() => {
        setShowAuthDialog(false)
      }, 2000)
    } catch (error) {
      // Error is already set in auth context
      console.error('[App] Registration error:', error)
    }
  }, [register])

  const handleLogin = useCallback(async () => {
    try {
      await signIn()

      // After successful login, close dialog after showing success
      setTimeout(() => {
        setShowAuthDialog(false)
      }, 2000)
    } catch (error) {
      // Error is already set in auth context
      console.error('[App] Login error:', error)
    }
  }, [signIn])

  const handleUsernameBack = useCallback(() => {
    resetAuthFlow()
    setUsernameAvailability(null)
  }, [resetAuthFlow])

  const checkUsernameAvailabilityDebounced = useCallback(async (username: string) => {
    // Validate format first
    const formatError = validateUsernameFormat(username)
    if (formatError) {
      setUsernameAvailability(null)
      return
    }

    // Note: We can't check actual availability without authentication
    // The Lens API requires authentication for canCreateUsername query
    // Actual availability will be checked during account creation
    // For now, just validate format and assume available if format is valid
    setUsernameAvailability('available')
  }, [])

  // Hide mobile footer on full-screen pages (song detail, media player, study, video detail)
  const hideMobileFooter =
    location.pathname.match(/^\/song\//) || location.pathname.match(/^\/u\/[^/]+\/video\//)

  return (
    <>
      <AppLayout
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isConnected={isPKPReady}
        walletAddress={pkpAddress || undefined}
        onConnectWallet={() => setShowAuthDialog(true)}
        hideMobileFooter={!!hideMobileFooter}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/u/:lenshandle" element={<AccountPageContainer />} />
          <Route path="/u/:lenshandle/video/:postId" element={<VideoDetailPage />} />

          {/* Song routes - GRC-20 work ID based */}
          <Route path="/song/:workId" element={<SongPageContainer />} />
          <Route path="/song/:workId/play" element={<MediaPageContainer />} />
          <Route path="/song/:workId/study" element={<StudySessionPage />} />

          {/* Study routes - Global study dashboard */}
          <Route path="/study" element={<ClassPage />} />

          {/* Legacy routes (redirect for backwards compatibility) */}
          <Route path="/karaoke/:workId" element={<Navigate to={`/song/:workId`} replace />} />
          <Route path="/karaoke/:workId/play" element={<Navigate to={`/song/:workId/play`} replace />} />
          <Route path="/song/grc20/:workId" element={<Navigate to={`/song/:workId`} replace />} />
          <Route path="/song/grc20/:workId/play" element={<Navigate to={`/song/:workId/play`} replace />} />

          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/profile" element={<ProfilePageContainer />} />
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
        onLogin={handleLogin}
        onUsernameBack={handleUsernameBack}
        onUsernameChange={checkUsernameAvailabilityDebounced}
      />

      <Toaster />
    </>
  )
}

/**
 * App - Root component with providers
 *
 * Routes:
 * / - Feed (all artist videos, chronological)
 * /search - Search for songs
 * /u/:lenshandle - Account profile (students, creators, artists - from Lens + Grove metadata)
 * /u/:lenshandle/video/:postId - Video detail (TikTok sidebar)
 * /song/:workId - Song overview + creator videos (from GRC-20 + Lens)
 * /song/:workId/play - Media player with instrumental and lyrics
 * /song/:workId/study - Study session with FSRS
 * /wallet - Wallet balances and address
 * /profile - Current user's own profile with Edit Profile button
 */
function App() {
  return (
    <LensProvider client={lensClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <VideoPlaybackProvider>
              <AppRouter />
            </VideoPlaybackProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </LensProvider>
  )
}

export default App
