import { Router, Route, useLocation, useNavigate } from '@solidjs/router'
import { createSignal, createEffect, onMount, type Component, type ParentComponent } from 'solid-js'
import { preloadChatImages } from '@/hooks/usePrefetch'

// Providers
import { QueryProvider } from '@/providers/QueryProvider'
import { LensProvider } from '@/providers/LensProvider'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { LanguagePreferenceProvider } from '@/contexts/LanguagePreferenceContext'
import { VideoPlaybackProvider } from '@/contexts/VideoPlaybackContext'
import { CurrencyProvider } from '@/contexts/CurrencyContext'
import { I18nProvider } from '@/lib/i18n'

// Layout
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthDialog } from '@/components/layout/AuthDialog'
import { Toaster } from '@/components/ui/sonner'

// Pages
import { HomePage } from '@/pages/HomePage'
import { SearchPage } from '@/pages/SearchPage'
import { ChatPage } from '@/pages/ChatPage'
import { StudyPage } from '@/pages/StudyPage'
import { StudySessionPage } from '@/pages/StudySessionPage'
import { WalletPage } from '@/pages/WalletPage'
import { SongDetailPage } from '@/pages/SongDetailPage'
import { SongPlayPage } from '@/pages/SongPlayPage'
import { ArtistPage } from '@/pages/ArtistPage'
import { FeedPage } from '@/pages/FeedPage'

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
      !!location.pathname.match(/^\/u\/[^/]+\/video\//) ||
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

      <AuthDialog
        open={showAuthDialog()}
        onOpenChange={setShowAuthDialog}
        currentStep={auth.authStep()}
        authMode={auth.authMode()}
        isAuthenticating={auth.isAuthenticating()}
        statusMessage={auth.authStatus()}
        errorMessage={auth.authError()?.message || ''}
        onRegister={() => auth.showUsernameInput()}
        onRegisterWithUsername={(username) => auth.register(username)}
        onLogin={() => auth.signIn()}
        onUsernameBack={() => auth.resetAuthFlow()}
      />

      <Toaster />
    </>
  )
}

const App: Component = () => {
  return (
    <QueryProvider>
      <LensProvider>
        <CurrencyProvider>
          <I18nProvider>
            <AuthProvider>
              <LanguagePreferenceProvider>
                <VideoPlaybackProvider>
                  <Router root={AppShell}>
                  <Route path="/" component={FeedPage} />
                  <Route path="/library" component={HomePage} />
                  <Route path="/songs" component={SearchPage} />
                  <Route path="/study" component={StudyPage} />
                  <Route path="/study/session" component={StudySessionPage} />
                  <Route path="/chat" component={ChatPage} />
                  <Route path="/chat/:scenarioId" component={ChatPage} />
                  <Route path="/wallet" component={WalletPage} />
                  {/* Artist page (e.g., /queen, /eminem) */}
                  <Route path="/:artistSlug" component={ArtistPage} />
                  {/* Song detail pages (shows info + Study/Karaoke buttons) */}
                  <Route path="/song/:spotifyTrackId" component={SongDetailPage} />
                  <Route path="/:artistSlug/:songSlug" component={SongDetailPage} />
                  {/* Song study pages (exercise session) */}
                  <Route path="/song/:workId/study" component={StudySessionPage} />
                  <Route path="/:artistSlug/:songSlug/study" component={StudySessionPage} />
                  {/* Song play pages (karaoke player with lyrics) */}
                  <Route path="/song/:spotifyTrackId/play" component={SongPlayPage} />
                  <Route path="/song/:spotifyTrackId/karaoke" component={SongPlayPage} />
                  <Route path="/:artistSlug/:songSlug/play" component={SongPlayPage} />
                  <Route path="/:artistSlug/:songSlug/karaoke" component={SongPlayPage} />
                    <Route path="*" component={FeedPage} />
                  </Router>
                </VideoPlaybackProvider>
              </LanguagePreferenceProvider>
            </AuthProvider>
          </I18nProvider>
        </CurrencyProvider>
      </LensProvider>
    </QueryProvider>
  )
}

export default App
