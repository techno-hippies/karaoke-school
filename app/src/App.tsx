import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AppLayout } from './components/layout/AppLayout'

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
      isConnected={false}
      onConnectWallet={() => console.log('Connect wallet')}
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
    <HashRouter>
      <AppRouter />
    </HashRouter>
  )
}

export default App
