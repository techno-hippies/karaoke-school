import React from 'react'
import { House, Exam, User, MagnifyingGlass, Wallet } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface DesktopSidebarProps {
  activeTab: 'home' | 'study' | 'search' | 'wallet' | 'profile' | 'none'
  onTabChange: (tab: 'home' | 'study' | 'search' | 'wallet' | 'profile') => void
  isConnected?: boolean
  walletAddress?: string
  onConnectWallet?: () => void
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onTabChange,
  isConnected,
  walletAddress,
  onConnectWallet
}) => {
  return (
    <div className="max-md:hidden fixed left-0 top-0 h-full w-80 bg-sidebar border-r border-border z-50">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 px-8">
          <h1 className="text-foreground font-bold text-3xl">KSchool</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-2">
          <Button
            onClick={() => onTabChange('home')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-6 py-4 h-auto text-xl ${
              activeTab === 'home'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <House className="w-7 h-7 flex-shrink-0" />
            <span>Home</span>
          </Button>

          <Button
            onClick={() => onTabChange('search')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-6 py-4 h-auto text-xl ${
              activeTab === 'search'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <MagnifyingGlass className="w-7 h-7 flex-shrink-0" />
            <span>Search</span>
          </Button>

          <Button
            onClick={() => onTabChange('study')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-6 py-4 h-auto text-xl ${
              activeTab === 'study'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <Exam className="w-7 h-7 flex-shrink-0" />
            <span>Study</span>
          </Button>

          <Button
            onClick={() => onTabChange('wallet')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-6 py-4 h-auto text-xl ${
              activeTab === 'wallet'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <Wallet className="w-7 h-7 flex-shrink-0" />
            <span>Wallet</span>
          </Button>

          <Button
            onClick={() => onTabChange('profile')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-6 py-4 h-auto text-xl ${
              activeTab === 'profile'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <User className="w-7 h-7 flex-shrink-0" />
            <span>Profile</span>
          </Button>
        </nav>

        {/* Auth section */}
        <div className="px-4 pt-8 pb-6 border-t border-border">
          {isConnected && walletAddress ? (
            <Button
              onClick={() => onTabChange('profile')}
              variant="ghost"
              className="w-full justify-start gap-4 px-6 py-4 h-auto hover:bg-secondary"
            >
              <div className="w-12 h-12 bg-primary rounded-lg flex-shrink-0" />
              <p className="text-foreground text-lg font-medium truncate flex-1 text-left">
                {walletAddress.length > 15
                  ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                  : walletAddress
                }
              </p>
            </Button>
          ) : (
            <Button
              onClick={onConnectWallet}
              variant="default"
              className="w-full px-6 py-4 h-auto text-base md:text-lg lg:text-xl"
            >
              Connect
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
