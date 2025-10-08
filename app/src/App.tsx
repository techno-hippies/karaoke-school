import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { ConnectKitProvider, getParticleConfig } from './lib/particle/client'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AppLayout } from './components/layout/AppLayout'

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

function PostPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">Post</h1>
        <p className="text-muted-foreground">Video recorder coming soon</p>
      </div>
    </div>
  )
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
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">Profile</h1>
        <p className="text-muted-foreground">User profile coming soon</p>
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

  // Debug: Log auth state
  useEffect(() => {
    console.log('[App] Auth state:', {
      isWalletConnected,
      walletAddress,
    })
  }, [isWalletConnected, walletAddress])

  // Sync active tab with current route
  useEffect(() => {
    const pathToTab: Record<string, 'home' | 'study' | 'post' | 'inbox' | 'profile'> = {
      '/': 'home',
      '/class': 'study',
      '/post': 'post',
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
      post: '/post',
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
        <Route path="/post" element={<PostPage />} />
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
