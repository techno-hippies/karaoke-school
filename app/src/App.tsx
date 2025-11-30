import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { HomePage } from '@/pages/HomePage'
import { ChatPage } from '@/pages/ChatPage'
import { SearchPage } from '@/pages/SearchPage'
import { AccountPageContainer } from '@/pages/AccountPageContainer'
import { VideoDetailPage } from '@/pages/VideoDetailPage'
import { SongPageContainer } from '@/pages/SongPageContainer'
import { SlugSongPageContainer } from '@/pages/SlugSongPageContainer'
import { ArtistPageContainer } from '@/pages/ArtistPageContainer'
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
import { Web3Provider } from '@/providers/Web3Provider'

function AppRouter() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'home' | 'study' | 'search' | 'chat' | 'wallet' | 'none'>('home')
  const [inChatConversation, setInChatConversation] = useState(false)

  const { isPKPReady, pkpAddress, setAuthDialogOpener } = useAuth()
  const [showAuthDialog, setShowAuthDialog] = useState(false)

  // Register the auth dialog opener with AuthContext so any component can trigger it
  useEffect(() => {
    setAuthDialogOpener(() => setShowAuthDialog(true))
  }, [setAuthDialogOpener])

  useEffect(() => {
    const pathToTab: Record<string, 'home' | 'study' | 'search' | 'chat' | 'wallet' | 'none'> = {
      '/': 'home',
      '/search': 'search',
      '/study': 'study',
      '/chat': 'chat',
      '/wallet': 'wallet',
    }

    // Hide tab bar on song pages (slug-based or legacy), user pages, and artist pages
    const pathParts = location.pathname.split('/').filter(Boolean)
    const reservedPaths = ['search', 'study', 'chat', 'wallet', 'u', 'song']

    if (location.pathname.startsWith('/song/') || location.pathname.startsWith('/u/') ||
        // Artist pages: /:artistSlug (single segment, not reserved)
        (pathParts.length === 1 && !reservedPaths.includes(pathParts[0])) ||
        // Slug-based song routes: /:artistSlug/:songSlug
        (pathParts.length >= 2 && !reservedPaths.includes(pathParts[0]))) {
      setActiveTab('none')
    } else {
      const tab = pathToTab[location.pathname] || 'home'
      setActiveTab(tab)
    }

    // Reset chat conversation state when leaving /chat
    if (location.pathname !== '/chat') {
      setInChatConversation(false)
    }
  }, [location.pathname])

  const handleTabChange = (tab: 'home' | 'study' | 'search' | 'chat' | 'wallet') => {
    const routes = {
      home: '/',
      study: '/study',
      search: '/search',
      chat: '/chat',
      wallet: '/wallet'
    }
    navigate(routes[tab])
  }

  // Hide footer on song pages (both slug-based and legacy), video detail pages, artist pages, and chat conversations
  const footerPathParts = location.pathname.split('/').filter(Boolean)
  const footerReservedPaths = ['search', 'study', 'chat', 'wallet', 'u', 'song']

  const hideMobileFooter =
    location.pathname.match(/^\/song\//) ||
    location.pathname.match(/^\/u\/[^/]+\/video\//) ||
    // Artist pages: /:artistSlug (single segment, not reserved)
    (footerPathParts.length === 1 && !footerReservedPaths.includes(footerPathParts[0])) ||
    // Slug-based routes: /:artistSlug/:songSlug
    (footerPathParts.length >= 2 && !footerReservedPaths.includes(footerPathParts[0])) ||
    // Inside a chat conversation
    inChatConversation

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

          {/* Artist page (e.g., /queen, /eminem) */}
          <Route path="/:artistSlug" element={<ArtistPageContainer />} />

          {/* Primary song routes - slug-based (e.g., /eminem/lose-yourself) */}
          <Route path="/:artistSlug/:songSlug" element={<SlugSongPageContainer />} />
          <Route path="/:artistSlug/:songSlug/play" element={<MediaPageContainer />} />
          <Route path="/:artistSlug/:songSlug/karaoke" element={<MediaPageContainer variant="practice" />} />
          <Route path="/:artistSlug/:songSlug/study" element={<StudySessionPage onConnectWallet={() => setShowAuthDialog(true)} />} />

          {/* Legacy song routes - redirect to search (no longer supported) */}
          <Route path="/song/:workId" element={<SongPageContainer />} />
          <Route path="/song/:workId/play" element={<MediaPageContainer />} />
          <Route path="/song/:workId/karaoke" element={<MediaPageContainer variant="practice" />} />
          <Route path="/song/:workId/study" element={<StudySessionPage onConnectWallet={() => setShowAuthDialog(true)} />} />

          <Route path="/study/session" element={<StudySessionPage onConnectWallet={() => setShowAuthDialog(true)} />} />
          <Route path="/study" element={<ClassPage onConnectWallet={() => setShowAuthDialog(true)} />} />

          <Route path="/chat" element={<ChatPage onConversationChange={setInChatConversation} />} />
          <Route path="/wallet" element={<ProfilePageContainer onConnectWallet={() => setShowAuthDialog(true)} />} />
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
    <Web3Provider>
      <HashRouter>
        <AuthProvider>
          <LanguagePreferenceProvider>
            <VideoPlaybackProvider>
              <AppRouter />
            </VideoPlaybackProvider>
          </LanguagePreferenceProvider>
        </AuthProvider>
      </HashRouter>
    </Web3Provider>
  )
}

export default App
