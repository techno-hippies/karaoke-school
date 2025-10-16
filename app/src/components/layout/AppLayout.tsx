import type { ReactNode } from 'react'
import { MobileFooter } from '../navigation/MobileFooter'
import { DesktopSidebar } from '../navigation/DesktopSidebar'

export interface AppLayoutProps {
  children: ReactNode
  activeTab: 'home' | 'study' | 'search' | 'wallet' | 'profile' | 'none'
  onTabChange: (tab: 'home' | 'study' | 'search' | 'wallet' | 'profile') => void
  isConnected?: boolean
  walletAddress?: string
  onConnectWallet?: () => void
  onDisconnect?: () => void
  hideMobileFooter?: boolean // Hide mobile footer for full-screen pages
}

export function AppLayout({
  children,
  activeTab,
  onTabChange,
  isConnected = false,
  walletAddress,
  onConnectWallet,
  onDisconnect: _onDisconnect,
  hideMobileFooter = false
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - hidden on mobile */}
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        isConnected={isConnected}
        walletAddress={walletAddress}
        onConnectWallet={onConnectWallet}
      />

      {/* Main content area */}
      <div className="md:pl-80">
        {/* Content with bottom padding for mobile footer (unless hidden) */}
        <div className={hideMobileFooter ? "" : "pb-16 md:pb-0"}>
          {children}
        </div>
      </div>

      {/* Mobile Footer - hidden on desktop and full-screen pages */}
      {!hideMobileFooter && (
        <MobileFooter
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      )}
    </div>
  )
}
