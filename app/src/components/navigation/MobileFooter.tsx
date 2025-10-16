import React from 'react'
import { House, Exam, MagnifyingGlass, Wallet, User } from '@phosphor-icons/react'

interface MobileFooterProps {
  activeTab: 'home' | 'study' | 'search' | 'wallet' | 'profile' | 'none'
  onTabChange: (tab: 'home' | 'study' | 'search' | 'wallet' | 'profile') => void
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
          onClick={() => onTabChange('search')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'search' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Search"
        >
          <MagnifyingGlass className="w-6 h-6" weight={activeTab === 'search' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">Search</span>
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
          onClick={() => onTabChange('wallet')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'wallet' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Wallet"
        >
          <Wallet className="w-6 h-6" weight={activeTab === 'wallet' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">Wallet</span>
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
