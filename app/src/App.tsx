import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LensProvider } from '@lens-protocol/react'
import { WagmiProvider } from 'wagmi'
import { config as wagmiConfig } from '@/wagmi.config'
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
import { ConnectedAuthDialog } from '@/components/layout/ConnectedAuthDialog'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { LanguagePreferenceProvider } from '@/contexts/LanguagePreferenceContext'
import { VideoPlaybackProvider } from '@/contexts/VideoPlaybackContext'
import { lensClient } from '@/lib/lens/client'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function AppRouter() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'home' | 'study' | 'search' | 'wallet' | 'profile' | 'none'>('home')

  const { isPKPReady, pkpAddress } = useAuth()
  const [showAuthDialog, setShowAuthDialog] = useState(false)

  useEffect(() => {
    const pathToTab: Record<string, 'home' | 'study' | 'search' | 'wallet' | 'profile' | 'none'> = {
      '/': 'home',
      '/search': 'search',
      '/study': 'study',
      '/wallet': 'wallet',
      '/profile': 'profile',
    }

    if (location.pathname.startsWith('/song/') || location.pathname.startsWith('/u/')) {
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

          <Route path="/song/:workId" element={<SongPageContainer />} />
          <Route path="/song/:workId/play" element={<MediaPageContainer />} />
          <Route path="/song/:workId/karaoke" element={<MediaPageContainer variant="practice" />} />
          <Route path="/song/:workId/study" element={<StudySessionPage onConnectWallet={() => setShowAuthDialog(true)} />} />

          <Route path="/study/session" element={<StudySessionPage onConnectWallet={() => setShowAuthDialog(true)} />} />
          <Route path="/study" element={<ClassPage onConnectWallet={() => setShowAuthDialog(true)} />} />

          <Route path="/karaoke/:workId" element={<Navigate to={`/song/:workId`} replace />} />
          <Route path="/karaoke/:workId/play" element={<Navigate to={`/song/:workId/play`} replace />} />
          <Route path="/song/grc20/:workId" element={<Navigate to={`/song/:workId`} replace />} />
          <Route path="/song/grc20/:workId/play" element={<Navigate to={`/song/:workId/play`} replace />} />

          <Route path="/wallet" element={<WalletPage onConnectWallet={() => setShowAuthDialog(true)} />} />
          <Route path="/profile" element={<ProfilePageContainer />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>

      <ConnectedAuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
      />

      <Toaster />
    </>
  )
}

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <LensProvider client={lensClient}>
        <QueryClientProvider client={queryClient}>
          <HashRouter>
            <AuthProvider>
              <LanguagePreferenceProvider>
                <VideoPlaybackProvider>
                  <AppRouter />
                </VideoPlaybackProvider>
              </LanguagePreferenceProvider>
            </AuthProvider>
          </HashRouter>
        </QueryClientProvider>
      </LensProvider>
    </WagmiProvider>
  )
}

export default App
