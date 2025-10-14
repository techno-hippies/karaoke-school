import React from 'react'
import { House, Exam, User, MicrophoneStage, Wallet } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface DesktopSidebarProps {
  activeTab: 'home' | 'study' | 'post' | 'wallet' | 'profile' | 'none'
  onTabChange: (tab: 'home' | 'study' | 'post' | 'wallet' | 'profile') => void
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
        <nav className="flex-1 px-6 space-y-2">
          <Button
            onClick={() => onTabChange('home')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-5 py-4 h-auto ${
              activeTab === 'home'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <House className="w-7 h-7 flex-shrink-0" />
            <span className="text-xl">Home</span>
          </Button>

          <Button
            onClick={() => onTabChange('study')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-5 py-4 h-auto ${
              activeTab === 'study'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <Exam className="w-7 h-7 flex-shrink-0" />
            <span className="text-xl">Class</span>
          </Button>

          <Button
            onClick={() => onTabChange('post')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-5 py-4 h-auto ${
              activeTab === 'post'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <MicrophoneStage className="w-7 h-7 flex-shrink-0" weight="duotone" />
            <span className="text-xl">Karaoke</span>
          </Button>

          <Button
            onClick={() => onTabChange('wallet')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-5 py-4 h-auto ${
              activeTab === 'wallet'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <Wallet className="w-7 h-7 flex-shrink-0" />
            <span className="text-xl">Wallet</span>
          </Button>

          <Button
            onClick={() => onTabChange('profile')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-5 py-4 h-auto ${
              activeTab === 'profile'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <User className="w-7 h-7 flex-shrink-0" />
            <span className="text-xl">Profile</span>
          </Button>
        </nav>

        {/* Auth section */}
        <div className="p-6 border-t border-border">
          {isConnected && walletAddress ? (
            <Button
              onClick={() => onTabChange('profile')}
              variant="ghost"
              className="w-full justify-start gap-3 hover:bg-secondary p-3 h-auto min-h-[64px]"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex-shrink-0" />
              <p className="text-foreground text-lg font-medium truncate flex-1">
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
              className="w-full min-h-[64px] text-lg"
            >
              Connect
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
