import React from 'react';
import { House, GraduationCap, User } from '@phosphor-icons/react';
import { Button } from '../ui/button';

interface DesktopSidebarProps {
  activeTab: 'home' | 'study' | 'profile';
  onTabChange: (tab: 'home' | 'study' | 'profile') => void;
  onCreatePost: () => void;
  isConnected?: boolean;
  walletAddress?: string;
  onDisconnect?: () => void;
  onConnectWallet?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ 
  activeTab, 
  onTabChange,
  onCreatePost,
  isConnected,
  walletAddress,
  onDisconnect,
  onConnectWallet
}) => {
  return (
    <div className="max-md:hidden fixed left-0 top-0 h-full w-64 bg-neutral-900 border-r border-neutral-800 z-50">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 px-8">
          <h1 className="text-white font-bold text-2xl">KSchool</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4">
          <button
            onClick={() => onTabChange('home')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'home' 
                ? 'bg-neutral-900 text-white' 
                : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'
            }`}
          >
            <House className="w-6 h-6 flex-shrink-0" />
            <span className="text-lg">For You</span>
          </button>

          <button
            onClick={() => onTabChange('study')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'study'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'
            }`}
          >
            <GraduationCap className="w-6 h-6 flex-shrink-0" />
            <span className="text-lg">Study</span>
          </button>

          <button
            onClick={() => onTabChange('profile')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'profile' 
                ? 'bg-neutral-900 text-white' 
                : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'
            }`}
          >
            <User className="w-6 h-6 flex-shrink-0" />
            <span className="text-lg">Profile</span>
          </button>

        </nav>

        {/* Auth section */}
        <div className="p-4 border-t border-neutral-800">
          {isConnected && walletAddress ? (
            <Button 
              onClick={() => onTabChange('profile')}
              variant="ghost"
              className="w-full justify-start gap-3 hover:bg-neutral-900 p-2 h-auto"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex-shrink-0" />
              <p className="text-white text-sm font-medium">
                {walletAddress && walletAddress.length > 15 
                  ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                  : walletAddress
                }
              </p>
            </Button>
          ) : (
            <Button 
              onClick={onConnectWallet}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};