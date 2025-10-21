import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WalletPage } from '@/pages/WalletPage'
import { SearchPage } from '@/pages/SearchPage'
import { ArtistPageContainer } from '@/pages/ArtistPageContainer'

/**
 * App - Clean routing architecture
 *
 * Routes:
 * / - Feed (all artist videos, chronological)
 * /search - Search for songs
 * /a/:lenshandle - Artist profile (from ArtistRegistryV1 contract)
 * /u/:lenshandle - Student/User profile (from StudentProfileV1 contract)
 * /u/:lenshandle/video/:postId - Video detail (TikTok sidebar)
 * /song/:geniusId - Song overview (all segments)
 * /song/:geniusId/segment/:segmentId - Study a segment
 * /wallet - Wallet balances and address
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>Feed</div>} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/a/:lenshandle" element={<ArtistPageContainer />} />
        <Route path="/u/:lenshandle" element={<div>Student Profile</div>} />
        <Route path="/u/:lenshandle/video/:postId" element={<div>Video Detail</div>} />
        <Route path="/song/:geniusId" element={<div>Song Overview</div>} />
        <Route path="/song/:geniusId/segment/:segmentId" element={<div>Study Segment</div>} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
