import type { ParentComponent } from 'solid-js'
import { MobileFooter } from '@/components/navigation/MobileFooter'
import { DesktopSidebar } from '@/components/navigation/DesktopSidebar'

export interface AppLayoutProps {
  activeTab: 'home' | 'study' | 'songs' | 'chat' | 'wallet' | 'none'
  onTabChange: (tab: 'home' | 'study' | 'songs' | 'chat' | 'wallet') => void
  isConnected?: boolean
  isCheckingSession?: boolean
  walletAddress?: string
  onConnectWallet?: () => void
  onDisconnect?: () => void
  hideMobileFooter?: boolean
}

/**
 * AppLayout - Main application layout with responsive navigation
 *
 * Desktop: Fixed sidebar (w-80) on left, content offset by md:pl-80
 * Mobile: Content full-width, footer navigation at bottom
 */
export const AppLayout: ParentComponent<AppLayoutProps> = (props) => {
  return (
    <div class="min-h-[calc(var(--vh,1vh)*100)] md:min-h-screen bg-background">
      {/* Desktop Sidebar - fixed, hidden on mobile */}
      <DesktopSidebar
        activeTab={props.activeTab}
        onTabChange={props.onTabChange}
        isConnected={props.isConnected}
        isCheckingSession={props.isCheckingSession}
        walletAddress={props.walletAddress}
        onConnectWallet={props.onConnectWallet}
      />

      {/* Main content area - offset by sidebar width on desktop */}
      <div class="md:pl-80">
        {/* Content with bottom padding for mobile footer (unless hidden) */}
        <div class={props.hideMobileFooter ? '' : 'pb-16 md:pb-0'}>
          {props.children}
        </div>
      </div>

      {/* Mobile Footer - hidden on desktop and full-screen pages */}
      {!props.hideMobileFooter && (
        <MobileFooter
          activeTab={props.activeTab}
          onTabChange={props.onTabChange}
        />
      )}
    </div>
  )
}
