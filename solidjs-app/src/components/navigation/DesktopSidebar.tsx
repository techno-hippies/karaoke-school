import type { Component } from 'solid-js'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icons'
import { useTranslation } from '@/lib/i18n'

interface DesktopSidebarProps {
  activeTab: 'home' | 'study' | 'songs' | 'chat' | 'wallet' | 'none'
  onTabChange: (tab: 'home' | 'study' | 'songs' | 'chat' | 'wallet') => void
  isConnected?: boolean
  isCheckingSession?: boolean
  walletAddress?: string
  onConnectWallet?: () => void
}

export const DesktopSidebar: Component<DesktopSidebarProps> = (props) => {
  const { t } = useTranslation()

  return (
    <div class="max-md:hidden fixed left-0 top-0 h-full w-80 bg-sidebar border-r border-border z-50">
      <div class="flex flex-col h-full">
        {/* Logo */}
        <div class="p-6 px-8">
          <h1 class="text-foreground font-bold text-3xl">{t('app.name')}</h1>
        </div>

        {/* Navigation */}
        <nav class="flex-1 px-4 space-y-2">
          <Button
            onClick={() => props.onTabChange('home')}
            variant="ghost"
            class={`w-full justify-start gap-4 px-6 py-4 h-auto text-xl hover:bg-secondary/50 ${
              props.activeTab === 'home'
                ? 'text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <Icon name="house" class="text-3xl flex-shrink-0" weight={props.activeTab === 'home' ? 'fill' : 'regular'} />
            <span>{t('nav.home')}</span>
          </Button>

          <Button
            onClick={() => props.onTabChange('songs')}
            variant="ghost"
            class={`w-full justify-start gap-4 px-6 py-4 h-auto text-xl hover:bg-secondary/50 ${
              props.activeTab === 'songs'
                ? 'text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <Icon name="music-notes-simple" class="text-3xl flex-shrink-0" weight={props.activeTab === 'songs' ? 'fill' : 'regular'} />
            <span>{t('nav.songs')}</span>
          </Button>

          <Button
            onClick={() => props.onTabChange('study')}
            variant="ghost"
            class={`w-full justify-start gap-4 px-6 py-4 h-auto text-xl hover:bg-secondary/50 ${
              props.activeTab === 'study'
                ? 'text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <Icon name="exam" class="text-3xl flex-shrink-0" weight={props.activeTab === 'study' ? 'fill' : 'regular'} />
            <span>{t('nav.study')}</span>
          </Button>

          <Button
            onClick={() => props.onTabChange('chat')}
            variant="ghost"
            class={`w-full justify-start gap-4 px-6 py-4 h-auto text-xl hover:bg-secondary/50 ${
              props.activeTab === 'chat'
                ? 'text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <Icon name="chat-circle" class="text-3xl flex-shrink-0" weight={props.activeTab === 'chat' ? 'fill' : 'regular'} />
            <span>{t('nav.chat')}</span>
          </Button>

          <Button
            onClick={() => props.onTabChange('wallet')}
            variant="ghost"
            class={`w-full justify-start gap-4 px-6 py-4 h-auto text-xl hover:bg-secondary/50 ${
              props.activeTab === 'wallet'
                ? 'text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <Icon name="wallet" class="text-3xl flex-shrink-0" weight={props.activeTab === 'wallet' ? 'fill' : 'regular'} />
            <span>{t('nav.wallet')}</span>
          </Button>
        </nav>

        {/* Auth section */}
        <div class="px-4 pt-8 pb-6 border-t border-border">
          {props.isCheckingSession ? (
            <div class="w-full justify-start gap-4 px-6 py-4 h-auto flex items-center">
              <div class="w-12 h-12 bg-secondary rounded-lg flex-shrink-0 animate-pulse" />
              <div class="h-5 w-24 bg-secondary rounded animate-pulse" />
            </div>
          ) : props.isConnected && props.walletAddress ? (
            <Button
              onClick={() => props.onTabChange('wallet')}
              variant="ghost"
              class="w-full justify-start gap-4 px-6 py-4 h-auto hover:bg-secondary"
            >
              <div class="w-12 h-12 bg-primary rounded-lg flex-shrink-0" />
              <p class="text-foreground text-lg font-medium truncate flex-1 text-left">
                {props.walletAddress.length > 15
                  ? `${props.walletAddress.slice(0, 6)}...${props.walletAddress.slice(-4)}`
                  : props.walletAddress}
              </p>
            </Button>
          ) : (
            <Button
              onClick={() => props.onConnectWallet?.()}
              variant="default"
              class="w-full px-6 py-4 h-auto text-base md:text-lg lg:text-xl"
            >
              {t('auth.connect')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
