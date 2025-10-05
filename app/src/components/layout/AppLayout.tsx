import { ReactNode } from 'react'
import { MobileFooter } from '../navigation/MobileFooter'
import { DesktopSidebar } from '../navigation/DesktopSidebar'

export interface AppLayoutProps {
  children: ReactNode
  activeTab: 'home' | 'study' | 'post' | 'inbox' | 'profile'
  onTabChange: (tab: 'home' | 'study' | 'post' | 'inbox' | 'profile') => void
  isConnected?: boolean
  walletAddress?: string
  onConnectWallet?: () => void
  onDisconnect?: () => void
}

export function AppLayout({
  children,
  activeTab,
  onTabChange,
  isConnected = false,
  walletAddress,
  onConnectWallet,
  onDisconnect
}: AppLayoutProps) {
  const handleCreatePost = () => {
    // Post navigation is handled by onTabChange
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - hidden on mobile */}
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        onCreatePost={handleCreatePost}
        isConnected={isConnected}
        walletAddress={walletAddress}
        onConnectWallet={onConnectWallet}
        onDisconnect={onDisconnect}
      />

      {/* Main content area */}
      <div className="md:pl-64">
        {/* Content with bottom padding for mobile footer */}
        <div className="pb-16 md:pb-0">
          {children}
        </div>
      </div>

      {/* Mobile Footer - hidden on desktop */}
      <MobileFooter
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
    </div>
  )
}
