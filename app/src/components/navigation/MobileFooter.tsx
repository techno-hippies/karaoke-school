import React from 'react'
import { House, Exam, MicrophoneStage, ChatCenteredText, User } from '@phosphor-icons/react'

interface MobileFooterProps {
  activeTab: 'home' | 'study' | 'post' | 'inbox' | 'profile'
  onTabChange: (tab: 'home' | 'study' | 'post' | 'inbox' | 'profile') => void
}

export const MobileFooter: React.FC<MobileFooterProps> = ({ activeTab, onTabChange }) => {
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
          aria-label="Home"
        >
          <House className="w-6 h-6" weight={activeTab === 'home' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">Home</span>
        </button>

        <button
          onClick={() => onTabChange('study')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'study' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Class"
        >
          <Exam className="w-6 h-6" weight={activeTab === 'study' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">Class</span>
        </button>

        <button
          onClick={() => onTabChange('post')}
          className="flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer"
          aria-label="Create Post"
        >
          <div className="bg-primary hover:bg-primary/90 rounded-xl px-6 py-3 transition-all">
            <MicrophoneStage className="w-6 h-6 text-primary-foreground" weight="duotone" />
          </div>
        </button>

        <button
          onClick={() => onTabChange('inbox')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'inbox' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Inbox"
        >
          <ChatCenteredText className="w-6 h-6" weight={activeTab === 'inbox' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">Inbox</span>
        </button>

        <button
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'profile' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Profile"
        >
          <User className="w-6 h-6" weight={activeTab === 'profile' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">Profile</span>
        </button>
      </div>
    </div>
  )
}
