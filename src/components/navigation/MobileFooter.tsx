import React from 'react';
import { Home, Plus, User } from 'lucide-react';

interface MobileFooterProps {
  activeTab: 'home' | 'post' | 'profile';
  onTabChange: (tab: 'home' | 'post' | 'profile') => void;
}

export const MobileFooter: React.FC<MobileFooterProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-neutral-900 md:hidden">
      <div className="flex items-center justify-around h-16">
        <button
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'home' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Home className="w-6 h-6" />
          <span className="text-xs mt-1">Home</span>
        </button>

        <button
          onClick={() => onTabChange('post')}
          className="flex flex-col items-center justify-center flex-1 h-full text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
        >
          <div className="bg-white hover:bg-neutral-100 rounded-lg p-1 transition-colors">
            <Plus className="w-6 h-6 text-black" />
          </div>
          <span className="text-xs mt-1">Post</span>
        </button>

        <button
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === 'profile' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <User className="w-6 h-6" />
          <span className="text-xs mt-1">Profile</span>
        </button>
      </div>
    </div>
  );
};