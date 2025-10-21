import type { ReactNode } from 'react'
import { MobileFooter } from '@/components/navigation/MobileFooter'
import { DesktopSidebar } from '@/components/navigation/DesktopSidebar'

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

/**
 * AppLayout - Main application layout with responsive navigation
 *
 * Desktop: Fixed sidebar (w-80) on left, content offset by md:pl-80
 * Mobile: Content full-width, footer navigation at bottom
 *
 * The md:pl-80 offset combined with flex centering creates perfect
 * centering for page content on desktop (excluding sidebar width)
 */
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
      {/* Desktop Sidebar - fixed, hidden on mobile */}
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        isConnected={isConnected}
        walletAddress={walletAddress}
        onConnectWallet={onConnectWallet}
      />

      {/* Main content area - offset by sidebar width on desktop */}
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
