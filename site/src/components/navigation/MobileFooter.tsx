import React from 'react';
import { House, PlusCircle, User, GraduationCap, ChatCenteredText } from '@phosphor-icons/react';

interface MobileFooterProps {
  activeTab: 'home' | 'study' | 'post' | 'inbox' | 'profile';
  onTabChange: (tab: 'home' | 'study' | 'post' | 'inbox' | 'profile') => void;
}

export const MobileFooter: React.FC<MobileFooterProps> = ({ activeTab, onTabChange }) => {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 md:hidden z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16">
        <button
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'home' ? 'text-neutral-300' : 'text-neutral-500 hover:text-neutral-400'
          }`}
        >
          <House className="w-6 h-6" weight={activeTab === 'home' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">Home</span>
        </button>

        <button
          onClick={() => onTabChange('study')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'study' ? 'text-neutral-300' : 'text-neutral-500 hover:text-neutral-400'
          }`}
        >
          <GraduationCap className="w-6 h-6" weight={activeTab === 'study' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">Study</span>
        </button>

        <button
          onClick={() => onTabChange('post')}
          className="flex flex-col items-center justify-center flex-1 h-full text-neutral-500 hover:text-neutral-400 transition-colors cursor-pointer"
        >
          <PlusCircle className="w-12 h-12 text-white mb-1" weight="fill" />
        </button>

        <button
          onClick={() => onTabChange('inbox')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'inbox' ? 'text-neutral-300' : 'text-neutral-500 hover:text-neutral-400'
          }`}
        >
          <ChatCenteredText className="w-6 h-6" weight={activeTab === 'inbox' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">Inbox</span>
        </button>

        <button
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'profile' ? 'text-neutral-300' : 'text-neutral-500 hover:text-neutral-400'
          }`}
        >
          <User className="w-6 h-6" weight={activeTab === 'profile' ? 'fill' : 'regular'} />
          <span className="text-xs mt-1">Profile</span>
        </button>
      </div>
    </div>
  );
};