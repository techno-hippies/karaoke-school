import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

/**
 * App - Clean routing architecture
 *
 * Routes:
 * / - Feed (all artist videos, chronological)
 * /u/:lensHandle - Artist profile (filtered to one artist)
 * /u/:lensHandle/video/:postId - Video detail (TikTok sidebar)
 * /song/:geniusId - Song overview (all segments)
 * /song/:geniusId/segment/:segmentId - Study a segment
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>Feed</div>} />
        <Route path="/u/:lensHandle" element={<div>Artist Profile</div>} />
        <Route path="/u/:lensHandle/video/:postId" element={<div>Video Detail</div>} />
        <Route path="/song/:geniusId" element={<div>Song Overview</div>} />
        <Route path="/song/:geniusId/segment/:segmentId" element={<div>Study Segment</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
