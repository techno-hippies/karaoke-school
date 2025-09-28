import React, { useState } from 'react'
import { useDisconnect } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { StudyStats } from './exercises/StudyStats'
import { DesktopSidebar } from './navigation/DesktopSidebar'
import { MobileFooter } from './navigation/MobileFooter'
import { useDisplayAuth } from '../hooks/lens/useDisplayAuth'
import { useAppNavigation } from '../hooks/navigation/useAppNavigation'
import { useLikedSongs } from '../hooks/media/useLikedSongs'

export const LearnPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'study' | 'post' | 'profile'>('study')
  const [mobileTab, setMobileTab] = useState<'home' | 'study' | 'post' | 'inbox' | 'profile'>('study')
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()

  // Liked songs hook
  const { likedSongs, clearAllLikedSongs } = useLikedSongs()

  // Shared authentication logic
  const {
    displayAddress,
    displayConnected
  } = useDisplayAuth()

  // Shared navigation logic
  const navigation = useAppNavigation()

  const handleStudy = () => {
    console.log('Starting study session...')
    // Future: Navigate to actual study session
  }

  // Handle desktop tab changes using the navigation hook
  const handleDesktopTabChange = (tab: 'home' | 'study' | 'post' | 'profile') => {
    navigation.handleDesktopTabChange(
      tab,
      activeTab,
      (newTab: string) => setActiveTab(newTab as 'home' | 'study' | 'post' | 'profile'),
      () => openConnectModal?.()
    )
  }

  // Handle mobile tab changes using the navigation hook
  const handleMobileTabChange = (tab: 'home' | 'study' | 'post' | 'inbox' | 'profile') => {
    navigation.handleMobileTabChange(
      tab,
      (newTab: string) => setMobileTab(newTab as 'home' | 'study' | 'post' | 'inbox' | 'profile'),
      (newTab: string) => setActiveTab(newTab as 'home' | 'study' | 'post' | 'profile'),
      () => openConnectModal?.()
    )
  }

  return (
    <div className="h-screen bg-neutral-900 flex">
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={handleDesktopTabChange}
        onCreatePost={() => console.log('Create post')}
        isConnected={displayConnected}
        walletAddress={displayAddress}
        onDisconnect={() => disconnect()}
        onConnectWallet={() => openConnectModal?.()}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:ml-20 lg:ml-64">
        <div className="flex-1 overflow-hidden">
          <div className="max-w-4xl mx-auto p-6 space-y-8">
            {/* Study stats section */}
            <StudyStats
              newCount={15}
              learningCount={8}
              dueCount={23}
              showButton={true}
              onStudy={handleStudy}
            />

            {/* Liked Songs section */}
            <div className="bg-neutral-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Liked Songs</h2>
                {likedSongs.length > 0 && (
                  <button
                    onClick={clearAllLikedSongs}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {likedSongs.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  No liked songs yet. Like posts to see them here!
                </p>
              ) : (
                <div className="space-y-3">
                  {likedSongs.map((song, index) => (
                    <div key={song.postId} className="bg-neutral-700 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-white font-medium">@{song.username}</span>
                            <span className="text-gray-400 text-sm">#{index + 1}</span>
                          </div>
                          <p className="text-gray-300 text-sm mb-2 line-clamp-2">{song.description}</p>
                          <div className="flex flex-col gap-1 text-xs">
                            <div className="text-gray-500">
                              Liked: {new Date(song.timestamp).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="ml-4">
                          <button className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm">
                            Study
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Spacer for mobile footer */}
            <div className="h-20 md:h-0" />
          </div>
        </div>
      </div>

      <MobileFooter
        activeTab={mobileTab}
        onTabChange={handleMobileTabChange}
      />
    </div>
  )
}