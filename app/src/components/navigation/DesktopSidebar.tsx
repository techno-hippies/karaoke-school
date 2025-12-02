import React from 'react'
import { useTranslation } from 'react-i18next'
import { House, Exam, Wallet, MagnifyingGlass, ChatCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface DesktopSidebarProps {
  activeTab: 'home' | 'study' | 'search' | 'chat' | 'wallet' | 'none'
  onTabChange: (tab: 'home' | 'study' | 'search' | 'chat' | 'wallet') => void
  isConnected?: boolean
  isCheckingSession?: boolean
  walletAddress?: string
  onConnectWallet?: () => void
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onTabChange,
  isConnected,
  isCheckingSession,
  walletAddress,
  onConnectWallet
}) => {
  const { t } = useTranslation()

  return (
    <div className="max-md:hidden fixed left-0 top-0 h-full w-80 bg-sidebar border-r border-border z-50">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 px-8">
          <h1 className="text-foreground font-bold text-3xl">K School</h1>
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
            <span>{t('nav.home')}</span>
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
            <span>{t('nav.search')}</span>
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
            <span>{t('nav.study')}</span>
          </Button>

          <Button
            onClick={() => onTabChange('chat')}
            variant="ghost"
            className={`w-full justify-start gap-4 px-6 py-4 h-auto text-xl ${
              activeTab === 'chat'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            <ChatCircle className="w-7 h-7 flex-shrink-0" />
            <span>{t('nav.chat')}</span>
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
            <span>{t('nav.wallet')}</span>
          </Button>
        </nav>

        {/* Auth section */}
        <div className="px-4 pt-8 pb-6 border-t border-border">
          {isCheckingSession ? (
            <div className="w-full justify-start gap-4 px-6 py-4 h-auto flex items-center">
              <div className="w-12 h-12 bg-secondary rounded-lg flex-shrink-0 animate-pulse" />
              <div className="h-5 w-24 bg-secondary rounded animate-pulse" />
            </div>
          ) : isConnected && walletAddress ? (
            <Button
              onClick={() => onTabChange('wallet')}
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
              {t('auth.connect')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
