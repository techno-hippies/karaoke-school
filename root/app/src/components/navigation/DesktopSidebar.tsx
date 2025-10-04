import React from 'react'
import { House, Exam, User, MicrophoneStage, ChatCenteredText } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface DesktopSidebarProps {
  activeTab: 'home' | 'study' | 'post' | 'inbox' | 'profile'
  onTabChange: (tab: 'home' | 'study' | 'post' | 'inbox' | 'profile') => void
  onCreatePost: () => void
  isConnected?: boolean
  walletAddress?: string
  onDisconnect?: () => void
  onConnectWallet?: () => void
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onTabChange,
  onCreatePost,
  isConnected,
  walletAddress,
  onConnectWallet
}) => {
  return (
    <div className="max-md:hidden fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-border z-50">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 px-8">
          <h1 className="text-white font-bold text-2xl">KSchool</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          <Button
            onClick={() => onTabChange('home')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-4 py-3 h-auto ${
              activeTab === 'home'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <House className="w-6 h-6 flex-shrink-0" />
            <span className="text-lg">Home</span>
          </Button>

          <Button
            onClick={() => onTabChange('study')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-4 py-3 h-auto ${
              activeTab === 'study'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <Exam className="w-6 h-6 flex-shrink-0" />
            <span className="text-lg">Class</span>
          </Button>

          <Button
            onClick={() => {
              onTabChange('post')
              onCreatePost()
            }}
            variant="ghost"
            className={`w-full justify-start gap-4 px-4 py-3 h-auto ${
              activeTab === 'post'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <MicrophoneStage className="w-6 h-6 flex-shrink-0" weight="duotone" />
            <span className="text-lg">Karaoke</span>
          </Button>

          <Button
            onClick={() => onTabChange('inbox')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-4 py-3 h-auto ${
              activeTab === 'inbox'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <ChatCenteredText className="w-6 h-6 flex-shrink-0" />
            <span className="text-lg">Inbox</span>
          </Button>

          <Button
            onClick={() => onTabChange('profile')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-4 py-3 h-auto ${
              activeTab === 'profile'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <User className="w-6 h-6 flex-shrink-0" />
            <span className="text-lg">Profile</span>
          </Button>
        </nav>

        {/* Auth section */}
        <div className="p-4 border-t border-border">
          {isConnected && walletAddress ? (
            <Button
              onClick={() => onTabChange('profile')}
              variant="ghost"
              className="w-full justify-start gap-3 hover:bg-secondary p-2 h-auto"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex-shrink-0" />
              <p className="text-foreground text-base font-medium truncate">
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
              className="w-full"
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
