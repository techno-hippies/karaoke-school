import { HashRouter, Route, useLocation, useNavigate } from '@solidjs/router'
import { createSignal, createEffect, onMount, lazy, type Component, type ParentComponent } from 'solid-js'
import { preloadChatImages } from '@/hooks/usePrefetch'

// Providers
import { QueryProvider } from '@/providers/QueryProvider'
import { LensProvider } from '@/providers/LensProvider'
import { Web3Provider } from '@/providers/Web3Provider'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { LanguagePreferenceProvider } from '@/contexts/LanguagePreferenceContext'
import { VideoPlaybackProvider } from '@/contexts/VideoPlaybackContext'
import { CurrencyProvider } from '@/contexts/CurrencyContext'
import { I18nProvider } from '@/lib/i18n'

// Layout
import { AppLayout } from '@/components/layout/AppLayout'
import { ConnectedAuthDialog } from '@/components/layout/ConnectedAuthDialog'
import { Toaster } from '@/components/ui/sonner'
import { DebugOverlay } from '@/components/debug/DebugOverlay'

// Pages - Static imports for core navigation
import { HomePage } from '@/pages/HomePage'
import { SearchPage } from '@/pages/SearchPage'
import { StudyPage } from '@/pages/StudyPage'
import { WalletPage } from '@/pages/WalletPage'
import { SongDetailPage } from '@/pages/SongDetailPage'
import { ArtistPage } from '@/pages/ArtistPage'
import { FeedPage } from '@/pages/FeedPage'
import { UserProfilePage } from '@/pages/UserProfilePage'

// Pages - Lazy loaded (use Lit Protocol SDK)
const ChatPage = lazy(() => import('@/pages/ChatPage').then(m => ({ default: m.ChatPage })))
const StudySessionPage = lazy(() => import('@/pages/StudySessionPage').then(m => ({ default: m.StudySessionPage })))
const SongPlayPage = lazy(() => import('@/pages/SongPlayPage').then(m => ({ default: m.SongPlayPage })))
const KaraokePracticePage = lazy(() => import('@/pages/KaraokePracticePage').then(m => ({ default: m.KaraokePracticePage })))

const AppShell: ParentComponent = (props) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = createSignal<'home' | 'study' | 'songs' | 'chat' | 'wallet' | 'none'>('home')
  const [showAuthDialog, setShowAuthDialog] = createSignal(false)

  const auth = useAuth()

  // Preload chat images on app mount
  onMount(() => {
    preloadChatImages()
  })

  // Register the auth dialog opener
  createEffect(() => {
    auth.setAuthDialogOpener(() => setShowAuthDialog(true))
  })

  // Update active tab based on route
  createEffect(() => {
    const pathToTab: Record<string, 'home' | 'study' | 'songs' | 'chat' | 'wallet'> = {
      '/': 'home',
      '/songs': 'songs',
      '/study': 'study',
      '/chat': 'chat',
      '/wallet': 'wallet',
    }

    const pathParts = location.pathname.split('/').filter(Boolean)
    const reservedPaths = ['songs', 'study', 'chat', 'wallet', 'u', 'song']

    if (location.pathname.startsWith('/song/') || location.pathname.startsWith('/u/') ||
        (pathParts.length === 1 && !reservedPaths.includes(pathParts[0])) ||
        (pathParts.length >= 2 && !reservedPaths.includes(pathParts[0]))) {
      setActiveTab('none')
    } else if (location.pathname.startsWith('/chat')) {
      setActiveTab('chat')
    } else {
      setActiveTab(pathToTab[location.pathname] || 'home')
    }
  })

  const handleTabChange = (tab: 'home' | 'study' | 'songs' | 'chat' | 'wallet') => {
    const routes = {
      home: '/',
      study: '/study',
      songs: '/songs',
      chat: '/chat',
      wallet: '/wallet',
    }
    navigate(routes[tab])
  }

  // Determine if footer should be hidden
  const hideMobileFooter = () => {
    const pathParts = location.pathname.split('/').filter(Boolean)
    const reservedPaths = ['songs', 'study', 'chat', 'wallet', 'u', 'song']

    return (
      !!location.pathname.match(/^\/song\//) ||
      !!location.pathname.match(/^\/u\//) ||
      (pathParts.length === 1 && !reservedPaths.includes(pathParts[0])) ||
      (pathParts.length >= 2 && !reservedPaths.includes(pathParts[0])) ||
      (location.pathname.startsWith('/chat/') && pathParts.length >= 2)
    )
  }

  return (
    <>
      <AppLayout
        activeTab={activeTab()}
        onTabChange={handleTabChange}
        isConnected={auth.isPKPReady()}
        isCheckingSession={auth.isCheckingSession()}
        walletAddress={auth.pkpAddress() || undefined}
        onConnectWallet={() => setShowAuthDialog(true)}
        hideMobileFooter={hideMobileFooter()}
      >
        {props.children}
      </AppLayout>

      <ConnectedAuthDialog
        open={showAuthDialog()}
        onOpenChange={setShowAuthDialog}
      />

      <Toaster />
      <DebugOverlay />
    </>
  )
}

const App: Component = () => {
  return (
    <QueryProvider>
      <LensProvider>
        <Web3Provider>
          <CurrencyProvider>
            <I18nProvider>
              <AuthProvider>
                <LanguagePreferenceProvider>
                  <VideoPlaybackProvider>
                    <HashRouter root={AppShell}>
                      <Route path="/" component={FeedPage} />
                      <Route path="/library" component={HomePage} />
                      <Route path="/songs" component={SearchPage} />
                      <Route path="/study" component={StudyPage} />
                      <Route path="/study/session" component={StudySessionPage} />
                      <Route path="/chat" component={ChatPage} />
                      <Route path="/chat/:scenarioId" component={ChatPage} />
                      <Route path="/wallet" component={WalletPage} />
                      {/* User profile page (e.g., /u/scarlett-ks) */}
                      <Route path="/u/:handle" component={UserProfilePage} />
                      {/* Artist page (e.g., /queen, /eminem) */}
                      <Route path="/:artistSlug" component={ArtistPage} />
                      {/* Song detail pages (shows info + Study/Karaoke buttons) */}
                      <Route path="/song/:spotifyTrackId" component={SongDetailPage} />
                      <Route path="/:artistSlug/:songSlug" component={SongDetailPage} />
                      {/* Song study pages (exercise session) */}
                      <Route path="/song/:workId/study" component={StudySessionPage} />
                      <Route path="/:artistSlug/:songSlug/study" component={StudySessionPage} />
                      {/* Song play pages (listen with lyrics) */}
                      <Route path="/song/:spotifyTrackId/play" component={SongPlayPage} />
                      <Route path="/:artistSlug/:songSlug/play" component={SongPlayPage} />
                      {/* Karaoke practice pages (record + grade) */}
                      <Route path="/song/:spotifyTrackId/karaoke" component={KaraokePracticePage} />
                      <Route path="/:artistSlug/:songSlug/karaoke" component={KaraokePracticePage} />
                      <Route path="*" component={FeedPage} />
                    </HashRouter>
                  </VideoPlaybackProvider>
                </LanguagePreferenceProvider>
              </AuthProvider>
            </I18nProvider>
          </CurrencyProvider>
        </Web3Provider>
      </LensProvider>
    </QueryProvider>
  )
}

export default App
