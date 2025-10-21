import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { WalletPage } from '@/pages/WalletPage'
import { SearchPage } from '@/pages/SearchPage'
import { ArtistPageContainer } from '@/pages/ArtistPageContainer'
import { SongPageContainer } from '@/pages/SongPageContainer'
import { MediaPageContainer } from '@/pages/MediaPageContainer'
import { ProfilePageContainer } from '@/pages/ProfilePageContainer'
import { AppLayout } from '@/components/layout/AppLayout'

/**
 * AppRouter - Main routing with layout and navigation state
 */
function AppRouter() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'home' | 'study' | 'search' | 'wallet' | 'profile' | 'none'>('home')

  // Map routes to active tabs
  useEffect(() => {
    const pathToTab: Record<string, 'home' | 'study' | 'search' | 'wallet' | 'profile' | 'none'> = {
      '/': 'home',
      '/search': 'search',
      '/wallet': 'wallet',
      '/profile': 'profile',
    }

    // Deep routes (song, artist, user pages) should have no tab selected
    if (location.pathname.startsWith('/song/') ||
        location.pathname.startsWith('/a/') ||
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
      study: '/class',
      search: '/search',
      wallet: '/wallet',
      profile: '/profile'
    }
    navigate(routes[tab])
  }

  // Hide mobile footer on full-screen pages (song detail, media player, video detail)
  const hideMobileFooter = location.pathname.match(/^\/song\/\d+/) || location.pathname.match(/^\/u\/[^/]+\/video\//)

  return (
    <AppLayout
      activeTab={activeTab}
      onTabChange={handleTabChange}
      isConnected={false}
      onConnectWallet={() => console.log('Connect wallet')}
      hideMobileFooter={!!hideMobileFooter}
    >
      <Routes>
        <Route path="/" element={<div>Feed</div>} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/a/:lenshandle" element={<ArtistPageContainer />} />
        <Route path="/u/:lenshandle" element={<div>Student Profile</div>} />
        <Route path="/u/:lenshandle/video/:postId" element={<div>Video Detail</div>} />
        <Route path="/song/:geniusId" element={<SongPageContainer />} />
        <Route path="/song/:geniusId/play" element={<MediaPageContainer />} />
        <Route path="/song/:geniusId/segment/:segmentId" element={<div>Study Segment</div>} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/profile" element={<ProfilePageContainer />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}

/**
 * App - Root component with providers
 *
 * Routes:
 * / - Feed (all artist videos, chronological)
 * /search - Search for songs
 * /a/:lenshandle - Artist profile (from ArtistRegistryV1 contract)
 * /u/:lenshandle - Student/User profile (from StudentProfileV1 contract)
 * /u/:lenshandle/video/:postId - Video detail (TikTok sidebar)
 * /song/:geniusId - Song overview + creator videos (from SongRegistryV1 + Lens)
 * /song/:geniusId/play - Media player with instrumental and lyrics
 * /song/:geniusId/segment/:segmentId - Study a segment
 * /wallet - Wallet balances and address
 * /profile - Current user's profile with Edit Profile button
 */
function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}

export default App
