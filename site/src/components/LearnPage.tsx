import React, { useState, useEffect } from 'react'
import { useDisconnect } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { StudyStats } from './exercises/StudyStats'
import { StudySession } from './exercises/StudySession'
import { DesktopSidebar } from './navigation/DesktopSidebar'
import { MobileFooter } from './navigation/MobileFooter'
import { useLensAuth } from '../hooks/lens/useLensAuth'
import { useAppNavigation } from '../hooks/navigation/useAppNavigation'
import { getStudyStats, getLikedSongs, getAllCards } from '../services/database/tinybase'
import { fsrsService } from '../services/FSRSService'
import { store } from '../services/database/tinybase'

export const LearnPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'study' | 'post' | 'profile'>('study')
  const [mobileTab, setMobileTab] = useState<'home' | 'study' | 'post' | 'inbox' | 'profile'>('study')
  const [showStudySession, setShowStudySession] = useState(false)
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()

  // TinyBase state
  const [stats, setStats] = useState({ newCount: 0, learningCount: 0, dueCount: 0, totalCards: 0 })
  const [likedSongs, setLikedSongs] = useState<Array<{
    postId: string
    songId: string
    songTitle: string
    artist: string
    cardCount: number
    likedAt: number
  }>>([])
  const [allCards, setAllCards] = useState<any[]>([])

  // Shared authentication logic
  const {
    displayAddress,
    displayConnected
  } = useLensAuth()

  // Shared navigation logic
  const navigation = useAppNavigation()

  // Load TinyBase data on mount and listen for changes
  useEffect(() => {
    const loadData = () => {
      setStats(getStudyStats())
      setLikedSongs(getLikedSongs())
      setAllCards(getAllCards())
    }

    // Initial load
    loadData()

    // Listen for changes in TinyBase
    const listenerId = store.addDidFinishTransactionListener(() => {
      loadData()
    })

    return () => {
      store.delListener(listenerId)
    }
  }, [])

  const handleStudy = () => {
    console.log('[LearnPage] Starting study session...')
    setShowStudySession(true)
  }

  const handleExitStudy = () => {
    console.log('[LearnPage] Exiting study session')
    setShowStudySession(false)
  }

  const handleDeleteCard = (cardId: string) => {
    fsrsService.deleteCard(cardId)
    console.log(`[LearnPage] Deleted card: ${cardId}`)
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
    <div className="h-screen bg-neutral-900 flex overflow-hidden">
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
      <div className="flex-1 flex flex-col md:ml-20 lg:ml-64 min-w-0">
        {showStudySession ? (
          <StudySession onExit={handleExitStudy} />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4 md:space-y-8">
              {/* Study stats section */}
              <StudyStats
                newCount={stats.newCount}
                learningCount={stats.learningCount}
                dueCount={stats.dueCount}
                showButton={true}
                onStudy={handleStudy}
              />

              {/* All Cards section */}
              <div className="bg-neutral-800 rounded-xl p-4 md:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg md:text-xl font-bold text-white">Study Cards ({allCards.length})</h2>
                </div>

                {allCards.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">
                    No study cards yet. Like karaoke videos to create cards!
                  </p>
                ) : (
                  <div className="space-y-2 md:space-y-3">
                    {allCards.map((card) => (
                      <div key={card.card_id} className="bg-neutral-700 rounded-lg p-3 md:p-4">
                        <div className="flex justify-between items-start gap-2 md:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium mb-1 truncate text-sm md:text-base">
                              {card.fragment}
                            </div>
                            {card.translation && (
                              <div className="text-gray-400 text-xs md:text-sm mb-2 truncate">
                                {card.translation}
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-1 md:gap-2 text-xs text-gray-500">
                              <span className="truncate max-w-[120px] md:max-w-none">{card.song_title}</span>
                              {card.artist && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[100px] md:max-w-none">{card.artist}</span>
                                </>
                              )}
                              <span>•</span>
                              <span className={`font-semibold flex-shrink-0 ${
                                card.state === 0 ? 'text-green-400' :
                                card.state === 1 ? 'text-blue-400' :
                                card.state === 2 ? 'text-purple-400' :
                                'text-orange-400'
                              }`}>
                                {['NEW', 'LEARNING', 'REVIEW', 'RELEARNING'][card.state]}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteCard(card.card_id)}
                            className="text-red-400 hover:text-red-300 text-xs md:text-sm px-2 md:px-3 py-1 rounded border border-red-400 hover:border-red-300 transition-colors flex-shrink-0"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Liked Songs grouped view */}
              <div className="bg-neutral-800 rounded-xl p-4 md:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg md:text-xl font-bold text-white">Liked Songs ({likedSongs.length})</h2>
                </div>

                {likedSongs.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">
                    No liked songs yet. Like karaoke posts to see them here!
                  </p>
                ) : (
                  <div className="space-y-2 md:space-y-3">
                    {likedSongs.map((song) => (
                      <div key={song.postId} className="bg-neutral-700 rounded-lg p-3 md:p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium mb-1 text-sm md:text-base truncate">
                              {song.songTitle}
                            </div>
                            <div className="text-gray-400 text-xs md:text-sm mb-2 truncate">
                              {song.artist}
                            </div>
                            <div className="flex flex-col gap-1 text-xs text-gray-500">
                              <div>
                                {song.cardCount} {song.cardCount === 1 ? 'card' : 'cards'}
                              </div>
                              <div>
                                Liked: {new Date(song.likedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Spacer for mobile footer (h-16) + safe area */}
              <div
                className="h-20 md:h-0"
                style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Only show MobileFooter when NOT in active study session */}
      {!showStudySession && (
        <MobileFooter
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
        />
      )}
    </div>
  )
}