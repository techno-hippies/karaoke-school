import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WalletProvider } from './providers/WalletProvider'
import Homepage from './components/Homepage'
import { EditProfilePage } from './components/profile/EditProfilePage'
import { ProfilePage } from './components/profile/ProfilePage'
import { ClaimAccountPage } from './components/profile/ClaimAccountPage'
import { LearnPage } from './components/LearnPage'
import { SongPickerPage } from './components/create/SongPickerPage';
import { SegmentPickerPage } from './components/create/SegmentPickerPage';
import { CameraRecorderPage } from './components/create/CameraRecorderPage';
import { PostEditorPage } from './components/create/PostEditorPage';
import { TikTokTest } from './components/TikTokTest'
import './index.css'

function App() {
  return (
    <WalletProvider>
      <HashRouter>
            <Routes>
              <Route path="/" element={<Homepage />} />
              <Route path="/profile/lens/:username" element={<ProfilePage />} />
              <Route path="/profile/:addressOrEns" element={<ProfilePage />} />
              <Route path="/profile" element={<Navigate to="/profile/karaokeschool" replace />} />
              <Route path="/edit-profile" element={<EditProfilePage />} />
              <Route path="/claim/:username" element={<ClaimAccountPage username="" claimableAmount={0} onBack={() => {}} onClaim={() => {}} />} />
              <Route path="/study" element={<LearnPage />} />
              <Route path="/create/song-picker" element={<SongPickerPage />} />
              <Route path="/create/segment-picker/:songId" element={<SegmentPickerPage />} />
              <Route path="/create/camera-recorder/:songId" element={<CameraRecorderPage />} />
              <Route path="/create/post-editor/:songId" element={<PostEditorPage />} />
              <Route path="/test" element={<TikTokTest />} />
              <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </WalletProvider>
  )
}

export default App
