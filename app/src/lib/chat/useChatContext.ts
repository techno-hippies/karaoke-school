/**
 * useChatContext Hook
 *
 * Gathers all context sources for AI chat:
 * - User profile (survey responses, preferences)
 * - View history / engagement profile (psychographics)
 * - FSRS study stats (cards due, streak)
 * - Recent practice sessions (on-chain)
 * - Per-personality survey management
 */

import { useEffect, useState, useMemo, useCallback } from 'react'
import * as store from './store'
import { useStudyCards } from '@/hooks/useStudyCards'
import type { UserProfile, UserContext, PersonalityId } from './types'
import { getNextSurvey, allSurveysCompleted, type SurveyConfig } from './surveys'

export interface ChatContext {
  // User profile (from survey + preferences)
  profile: {
    name?: string
    language?: string
    level?: string
    favoriteArtists?: string[]
    favoriteAnime?: string[]
    favoriteGames?: string[]
    goals?: string[]
    musicProductionInterest?: string
    interests?: string[]
  }

  // Engagement profile (from view history)
  engagement: {
    topVisualTags: string[] // e.g., ["death-note", "anime", "cyberpunk"]
    topLyricTags: string[] // e.g., ["empowerment", "heartbreak"]
    topArtists: string[] // e.g., ["Eminem", "Britney Spears"]
    topSongs: Array<{ title: string; artist: string }>
    totalViews: number
  }

  // Study stats (FSRS)
  study?: {
    cardsDueToday: number
    cardsStudiedToday: number
    newCardsRemaining: number
    totalCardsLearning: number
    totalCardsReview: number
    streak: number
    lastStudyDate?: string
  }

  // Recent activity
  recentActivity: {
    lastPracticedSong?: { title: string; artist: string; score?: number }
    studiedToday: boolean
  }

  // Survey management (per-personality)
  nextSurvey: SurveyConfig | null
  surveysComplete: boolean

  // Loading state
  isLoading: boolean
}

/** Full result from the hook including actions */
export interface UseChatContextResult extends ChatContext {
  /** Raw user profile from IDB */
  rawProfile: UserProfile | null
  /** UserContext to pass to Lit Action */
  userContext: UserContext | null
  /** Save a survey response */
  saveSurveyResponse: (surveyId: string, optionId: string, optionLabel: string) => Promise<void>
  /** Refresh profile from IDB */
  refreshProfile: () => Promise<void>
}

/**
 * Hook to gather all chat context
 *
 * @param personalityId - Current AI personality (for per-personality surveys)
 */
export function useChatContext(personalityId?: PersonalityId | null): UseChatContextResult {
  const [rawProfile, setRawProfile] = useState<UserProfile | null>(null)
  const [engagement, setEngagement] = useState<ChatContext['engagement']>({
    topVisualTags: [],
    topLyricTags: [],
    topArtists: [],
    topSongs: [],
    totalViews: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  // Fetch FSRS study stats
  const { data: studyData } = useStudyCards()

  // Load profile and engagement from IDB
  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        // Load user profile from IndexedDB
        const profile = await store.getProfile()
        setRawProfile(profile)

        // Load engagement profile from view history
        try {
          const engagementData = await store.getEngagementProfile()

          // Get top tags (sorted by count, take top 5)
          const topVisualTags = Object.entries(engagementData.visualTagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([tag]) => tag)

          const topLyricTags = Object.entries(engagementData.lyricTagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([tag]) => tag)

          setEngagement({
            topVisualTags,
            topLyricTags,
            topArtists: engagementData.topArtists.map((a) => a.name),
            topSongs: engagementData.topSongs.map((s) => ({ title: s.title, artist: s.artist })),
            totalViews: engagementData.totalViews,
          })
        } catch (engagementError) {
          console.warn('[useChatContext] Engagement data not available:', engagementError)
        }
      } catch (error) {
        console.error('[useChatContext] Failed to load context:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  // Refresh profile
  const refreshProfile = useCallback(async () => {
    const profile = await store.getProfile()
    setRawProfile(profile)
  }, [])

  // Get completed surveys for this personality
  const completedSurveyIds = useMemo(() => {
    if (!personalityId || !rawProfile?.completedSurveys) return []
    return rawProfile.completedSurveys[personalityId] || []
  }, [personalityId, rawProfile?.completedSurveys])

  // Get next survey to show
  const nextSurvey = useMemo(() => {
    if (!personalityId) return null
    return getNextSurvey(personalityId, completedSurveyIds)
  }, [personalityId, completedSurveyIds])

  // Check if all surveys completed
  const surveysComplete = useMemo(() => {
    if (!personalityId) return true
    return allSurveysCompleted(personalityId, completedSurveyIds)
  }, [personalityId, completedSurveyIds])

  // Save survey response to IDB
  const saveSurveyResponse = useCallback(async (
    surveyId: string,
    optionId: string,
    optionLabel: string
  ) => {
    if (!personalityId || !nextSurvey || nextSurvey.id !== surveyId) {
      console.warn('[useChatContext] Invalid survey save:', surveyId)
      return
    }

    const survey = nextSurvey
    const currentProfile = await store.getProfile()

    // Skip saving if 'none' option and skipNone is true
    if (!(optionId === 'none' && survey.skipNone)) {
      // Parse the saveTo path (e.g., 'learning.favoriteArtists')
      const pathParts = survey.saveTo.split('.')

      if (pathParts.length === 1) {
        // Top-level field (e.g., 'level')
        await store.saveProfile({
          [survey.saveTo]: survey.isArray ? optionLabel : optionId,
        })
      } else if (pathParts.length === 2 && pathParts[0] === 'learning') {
        // Nested under learning (e.g., 'learning.favoriteArtists')
        const fieldName = pathParts[1]
        const currentLearning = currentProfile?.learning || {}

        if (survey.isArray) {
          // Append to array (avoid duplicates)
          const currentArray = (currentLearning as Record<string, unknown>)[fieldName] as string[] || []
          if (!currentArray.includes(optionLabel)) {
            await store.saveProfile({
              learning: {
                ...currentLearning,
                [fieldName]: [...currentArray, optionLabel],
              },
            })
          }
        } else {
          // Set value
          await store.saveProfile({
            learning: {
              ...currentLearning,
              [fieldName]: optionId,
            },
          })
        }
      }
    }

    // Mark survey as completed for this personality
    const completedSurveys = currentProfile?.completedSurveys || {}
    const personalityCompleted = completedSurveys[personalityId] || []

    if (!personalityCompleted.includes(surveyId)) {
      await store.saveProfile({
        completedSurveys: {
          ...completedSurveys,
          [personalityId]: [...personalityCompleted, surveyId],
        },
      })
    }

    // Refresh profile
    await refreshProfile()
  }, [personalityId, nextSurvey, refreshProfile])

  // Calculate study stats from FSRS data
  const study = useMemo(() => {
    if (!studyData?.stats) return undefined
    return {
      cardsDueToday: studyData.stats.dueToday,
      cardsStudiedToday: studyData.stats.newCardsIntroducedToday,
      newCardsRemaining: studyData.stats.newCardsRemaining,
      totalCardsLearning: studyData.stats.learning,
      totalCardsReview: studyData.stats.review,
      streak: 0, // TODO: calculate from subgraph
      lastStudyDate: undefined,
    }
  }, [studyData])

  // Calculate if user studied today
  const studiedToday = useMemo(() => {
    return (studyData?.stats?.newCardsIntroducedToday ?? 0) > 0 ||
      (studyData?.stats?.review ?? 0) > 0
  }, [studyData])

  // Build the full ChatContext
  const context: ChatContext = useMemo(() => ({
    profile: {
      name: rawProfile?.name,
      language: rawProfile?.language,
      level: rawProfile?.level,
      favoriteArtists: rawProfile?.learning?.favoriteArtists,
      favoriteAnime: rawProfile?.learning?.favoriteAnime,
      favoriteGames: rawProfile?.learning?.favoriteGames,
      goals: rawProfile?.learning?.goals,
      musicProductionInterest: rawProfile?.learning?.musicProductionInterest,
      interests: rawProfile?.learning?.interests,
    },
    engagement,
    study,
    recentActivity: {
      lastPracticedSong: engagement.topSongs[0]
        ? { title: engagement.topSongs[0].title, artist: engagement.topSongs[0].artist }
        : undefined,
      studiedToday,
    },
    nextSurvey,
    surveysComplete,
    isLoading,
  }), [rawProfile, engagement, study, studiedToday, nextSurvey, surveysComplete, isLoading])

  // Build UserContext for Lit Action
  const userContext = useMemo((): UserContext | null => {
    if (!rawProfile && !studyData) return null

    return {
      // Profile data
      name: rawProfile?.name,
      language: rawProfile?.language,
      level: rawProfile?.level,
      favoriteArtists: rawProfile?.learning?.favoriteArtists,
      favoriteAnime: rawProfile?.learning?.favoriteAnime,
      favoriteGames: rawProfile?.learning?.favoriteGames,
      goals: rawProfile?.learning?.goals,
      musicProductionInterest: rawProfile?.learning?.musicProductionInterest,

      // FSRS study data
      studiedToday,
      cardsStudiedToday: studyData?.stats?.newCardsIntroducedToday ?? 0,
      newCardsRemaining: studyData?.stats?.newCardsRemaining ?? 15,
      totalCardsLearning: studyData?.stats?.learning ?? 0,
      totalCardsReview: studyData?.stats?.review ?? 0,

      // Recent activity (TODO: fetch from subgraph)
      recentSongsPracticed: engagement.topSongs.slice(0, 3).map(s => s.title),
      lastSessionScore: undefined,
      totalSessions: undefined,
      averageScore: undefined,
    }
  }, [rawProfile, studyData, studiedToday, engagement.topSongs])

  return {
    ...context,
    rawProfile,
    userContext,
    saveSurveyResponse,
    refreshProfile,
  }
}
