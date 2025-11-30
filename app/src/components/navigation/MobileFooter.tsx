import React from 'react'
import { useTranslation } from 'react-i18next'
import { House, Exam, MagnifyingGlass, ChatCircle, Wallet } from '@phosphor-icons/react'

interface MobileFooterProps {
  activeTab: 'home' | 'study' | 'search' | 'chat' | 'wallet' | 'none'
  onTabChange: (tab: 'home' | 'study' | 'search' | 'chat' | 'wallet') => void
}

export const MobileFooter: React.FC<MobileFooterProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation()

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-border md:hidden z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16">
        <button
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'home' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label={t('nav.home')}
        >
          <House className="w-6 h-6" weight={activeTab === 'home' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">{t('nav.home')}</span>
        </button>

        <button
          onClick={() => onTabChange('search')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'search' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label={t('nav.search')}
        >
          <MagnifyingGlass className="w-6 h-6" weight={activeTab === 'search' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">{t('nav.search')}</span>
        </button>

        <button
          onClick={() => onTabChange('study')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'study' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label={t('nav.study')}
        >
          <Exam className="w-6 h-6" weight={activeTab === 'study' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">{t('nav.study')}</span>
        </button>

        <button
          onClick={() => onTabChange('chat')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'chat' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label={t('nav.chat')}
        >
          <ChatCircle className="w-6 h-6" weight={activeTab === 'chat' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">{t('nav.chat')}</span>
        </button>

        <button
          onClick={() => onTabChange('wallet')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'wallet' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label={t('nav.wallet')}
        >
          <Wallet className="w-6 h-6" weight={activeTab === 'wallet' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">{t('nav.wallet')}</span>
        </button>
      </div>
    </div>
  )
}
