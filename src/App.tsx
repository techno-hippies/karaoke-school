import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WalletProvider } from './providers/WalletProvider'
import { WalletModalProvider } from './contexts/WalletModalContext'
import Homepage from './components/Homepage'
import { EditProfilePage } from './components/profile/EditProfilePage'
import { ProfilePage } from './components/profile/ProfilePage'
import { ClaimAccountPage } from './components/profile/ClaimAccountPage'
import { TikTokTest } from './components/TikTokTest'
import './index.css'

function App() {
  return (
    <WalletProvider>
      <WalletModalProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<Homepage />} />
              <Route path="/profile/lens/:username" element={<ProfilePage />} />
              <Route path="/profile/:addressOrEns" element={<ProfilePage />} />
              <Route path="/profile" element={<Navigate to="/profile/karaokeschool" replace />} />
              <Route path="/edit-profile" element={<EditProfilePage />} />
              <Route path="/claim/:username" element={<ClaimAccountPage />} />
              <Route path="/test" element={<TikTokTest />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
      </WalletModalProvider>
    </WalletProvider>
  )
}

export default App
