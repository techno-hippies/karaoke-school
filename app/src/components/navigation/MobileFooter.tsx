import type { Component } from 'solid-js'
import { Icon } from '@/components/icons'
import { useTranslation } from '@/lib/i18n'
import { haptic } from '@/lib/utils'

interface MobileFooterProps {
  activeTab: 'home' | 'study' | 'songs' | 'chat' | 'wallet' | 'none'
  onTabChange: (tab: 'home' | 'study' | 'songs' | 'chat' | 'wallet') => void
}

export const MobileFooter: Component<MobileFooterProps> = (props) => {
  const { t } = useTranslation()

  const handleTabChange = (tab: 'home' | 'study' | 'songs' | 'chat' | 'wallet') => {
    haptic.light()
    props.onTabChange(tab)
  }

  return (
    <div
      class="fixed bottom-0 left-0 right-0 bg-card border-t border-border md:hidden z-50"
      style={{ 'padding-bottom': 'env(safe-area-inset-bottom)' }}
    >
      <div class="flex items-center justify-around h-16">
        <button
          onClick={() => handleTabChange('home')}
          class={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            props.activeTab === 'home' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label={t('nav.home')}
        >
          <Icon name="house" class="text-2xl" weight={props.activeTab === 'home' ? 'fill' : 'regular'} />
          <span class="text-xs mt-1">{t('nav.home')}</span>
        </button>

        <button
          onClick={() => handleTabChange('songs')}
          class={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            props.activeTab === 'songs' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label={t('nav.songs')}
        >
          <Icon name="music-notes-simple" class="text-2xl" weight={props.activeTab === 'songs' ? 'fill' : 'regular'} />
          <span class="text-xs mt-1">{t('nav.songs')}</span>
        </button>

        <button
          onClick={() => handleTabChange('study')}
          class={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            props.activeTab === 'study' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label={t('nav.study')}
        >
          <Icon name="exam" class="text-2xl" weight={props.activeTab === 'study' ? 'fill' : 'regular'} />
          <span class="text-xs mt-1">{t('nav.study')}</span>
        </button>

        <button
          onClick={() => handleTabChange('chat')}
          class={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            props.activeTab === 'chat' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label={t('nav.chat')}
        >
          <Icon name="chat-circle" class="text-2xl" weight={props.activeTab === 'chat' ? 'fill' : 'regular'} />
          <span class="text-xs mt-1">{t('nav.chat')}</span>
        </button>

        <button
          onClick={() => handleTabChange('wallet')}
          class={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            props.activeTab === 'wallet' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label={t('nav.wallet')}
        >
          <Icon name="wallet" class="text-2xl" weight={props.activeTab === 'wallet' ? 'fill' : 'regular'} />
          <span class="text-xs mt-1">{t('nav.wallet')}</span>
        </button>
      </div>
    </div>
  )
}
