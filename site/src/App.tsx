import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WalletProvider } from './providers/WalletProvider'
import { LensProvider } from './providers/LensProvider'
import Homepage from './components/Homepage'
import { EditProfilePage } from './components/profile/EditProfilePage'
import { ProfilePage } from './components/profile/ProfilePage'
import { ClaimAccountPage } from './components/profile/ClaimAccountPage'
import { VideoPage } from './components/video/VideoPage'
import { LearnPage } from './components/LearnPage'
import { SongPickerPage } from './components/create/SongPickerPage';
import { ClipPickerPageRoute } from './components/create/ClipPickerPageRoute';
import { SegmentPickerPageRoute } from './components/create/SegmentPickerPageRoute';
import { LyricsPageRoute } from './components/create/LyricsPageRoute';
import { ModeSelectorPage } from './components/create/ModeSelectorPage';
import { CameraRecorderPage } from './components/create/CameraRecorderPage';
import { PostEditorPage } from './components/create/PostEditorPage';
import { TikTokTest } from './components/TikTokTest'
import './index.css'

function App() {
  return (
    <WalletProvider>
      <LensProvider>
        <HashRouter>
            <Routes>
              <Route path="/" element={<Homepage />} />
              <Route path="/profile/lens/:username/video/:videoId" element={<VideoPage />} />
              <Route path="/profile/:addressOrEns/video/:videoId" element={<VideoPage />} />
              <Route path="/profile/lens/:username" element={<ProfilePage />} />
              <Route path="/profile/:addressOrEns" element={<ProfilePage />} />
              <Route path="/profile" element={<Navigate to="/profile/karaokeschool" replace />} />
              <Route path="/edit-profile" element={<EditProfilePage />} />
              <Route path="/claim/:username" element={<ClaimAccountPage username="" claimableAmount={0} onBack={() => {}} onClaim={() => {}} />} />
              <Route path="/study" element={<LearnPage />} />

              {/* New URL-based routing (Segment Architecture) */}
              <Route path="/create/:source/:songId/:segmentId" element={<CameraRecorderPage />} />
              <Route path="/create/:source/:songId" element={<SegmentPickerPageRoute />} />

              {/* Legacy routes (backward compatibility) */}
              <Route path="/create/song-picker" element={<SongPickerPage />} />
              <Route path="/create/clip-picker" element={<ClipPickerPageRoute />} />
              <Route path="/create/lyrics" element={<LyricsPageRoute />} />
              <Route path="/create/mode-selector" element={<ModeSelectorPage />} />
              <Route path="/create/camera-recorder/:clipId" element={<CameraRecorderPage />} />
              <Route path="/create/post-editor" element={<PostEditorPage />} />

              <Route path="/test" element={<TikTokTest />} />
              <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </HashRouter>
      </LensProvider>
    </WalletProvider>
  )
}

export default App
