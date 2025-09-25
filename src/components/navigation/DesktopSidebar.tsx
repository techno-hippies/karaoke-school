import React from 'react';
import { House, MagnifyingGlass, Users, User } from '@phosphor-icons/react';
import { Button } from '../ui/button';

interface DesktopSidebarProps {
  activeTab: 'home' | 'discover' | 'following' | 'profile';
  onTabChange: (tab: 'home' | 'discover' | 'following' | 'profile') => void;
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
    <div className="max-md:hidden fixed left-0 top-0 h-full w-64 bg-black border-r border-neutral-800 z-50">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 px-8">
          <h1 className="text-white font-bold text-2xl">TikTok</h1>
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
            onClick={() => onTabChange('discover')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'discover' 
                ? 'bg-neutral-900 text-white' 
                : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'
            }`}
          >
            <MagnifyingGlass className="w-6 h-6 flex-shrink-0" />
            <span className="text-lg">Discover</span>
          </button>

          <button
            onClick={() => onTabChange('following')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'following' 
                ? 'bg-neutral-900 text-white' 
                : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'
            }`}
          >
            <Users className="w-6 h-6 flex-shrink-0" />
            <span className="text-lg">Following</span>
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