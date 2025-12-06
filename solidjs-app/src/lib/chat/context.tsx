/**
 * Chat Context Provider
 *
 * Provides reactive chat state management using SolidJS primitives.
 * Handles:
 * - User profile (singleton)
 * - Active thread and messages
 * - Survey flow
 * - User context for AI personalization
 */

import {
  createContext,
  createSignal,
  createMemo,
  createEffect,
  useContext,
  onMount,
  type ParentProps,
  type Accessor,
} from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import type {
  UserProfile,
  Thread,
  Message,
  PersonalityId,
  UserContext,
  Survey,
  LearningPreferences,
} from './types'
import * as store from './store'
import {
  getNextSurvey,
  areSurveysComplete,
  PERSONALITY_SURVEYS,
} from './surveys'

// ============================================================
// Context Types
// ============================================================

interface ChatContextValue {
  // Profile
  profile: Accessor<UserProfile | null>
  profileLoading: Accessor<boolean>
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>

  // Thread state
  currentScenarioId: Accessor<string | null>
  setCurrentScenarioId: (id: string | null) => void
  currentThread: Accessor<Thread | null>
  messages: Message[]
  messagesLoading: Accessor<boolean>

  // Message operations
  addMessage: (
    role: Message['role'],
    content: string,
    metadata?: Message['metadata']
  ) => Promise<Message>
  addMessagesBatch: (
    messages: Array<{
      role: Message['role']
      content: string
      metadata?: Message['metadata']
    }>
  ) => Promise<Message[]>
  refreshThread: () => Promise<void>

  // Survey state
  nextSurvey: Accessor<Survey | null>
  surveysComplete: Accessor<boolean>
  saveSurveyResponse: (
    surveyId: string,
    optionId: string,
    translatedLabel: string
  ) => Promise<void>

  // User context (for AI personalization)
  userContext: Accessor<UserContext | null>

  // Roleplay mode
  isRoleplay: Accessor<boolean>
  roleplayMessages: Message[]
  addRoleplayMessage: (role: 'user' | 'assistant', content: string) => Message
  clearRoleplayMessages: () => void
  roleplayTokenCount: Accessor<number>
  roleplayNearLimit: Accessor<boolean>
  roleplayOverLimit: Accessor<boolean>
}

const ChatContext = createContext<ChatContextValue>()

// ============================================================
// Constants
// ============================================================

const MAX_CONTEXT_TOKENS = 64000
const CHARS_PER_TOKEN = 4
const SYSTEM_PROMPT_TOKENS = 800

// ============================================================
// Provider Component
// ============================================================

export function ChatProvider(props: ParentProps) {
  // Profile state
  const [profile, setProfile] = createSignal<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = createSignal(true)

  // Thread state
  const [currentScenarioId, setCurrentScenarioId] = createSignal<string | null>(
    null
  )
  const [currentThread, setCurrentThread] = createSignal<Thread | null>(null)
  const [messages, setMessages] = createStore<Message[]>([])
  const [messagesLoading, setMessagesLoading] = createSignal(false)

  // Roleplay state (ephemeral, not persisted)
  const [roleplayMessages, setRoleplayMessages] = createStore<Message[]>([])
  let roleplayIdCounter = 0

  // Derived: personality ID from scenario
  const currentPersonalityId = createMemo<PersonalityId | null>(() => {
    const scenarioId = currentScenarioId()
    if (!scenarioId) return null
    return scenarioId.split('-')[0] as PersonalityId
  })

  // Derived: is this a roleplay scenario?
  const isRoleplay = createMemo(() => {
    const scenarioId = currentScenarioId()
    if (!scenarioId) return false
    // Default chats end with "-chat", roleplays have other suffixes
    return !scenarioId.endsWith('-chat')
  })

  // Load profile on mount
  onMount(async () => {
    try {
      const p = await store.getProfile()
      setProfile(p)
    } finally {
      setProfileLoading(false)
    }
  })

  // Load thread when scenario changes (only for persisted chats)
  createEffect(async () => {
    const scenarioId = currentScenarioId()

    // Clear roleplay messages when switching scenarios
    setRoleplayMessages([])
    roleplayIdCounter = 0

    if (!scenarioId || isRoleplay()) {
      setCurrentThread(null)
      setMessages([])
      return
    }

    setMessagesLoading(true)
    try {
      const thread = await store.getThread(scenarioId)
      setCurrentThread(thread)

      if (thread) {
        const msgs = await store.getMessages(scenarioId)
        setMessages(msgs)
      } else {
        setMessages([])
      }
    } finally {
      setMessagesLoading(false)
    }
  })

  // Profile operations
  const updateProfile = async (
    updates: Partial<UserProfile>
  ): Promise<UserProfile> => {
    const updated = await store.saveProfile(updates)
    setProfile(updated)
    return updated
  }

  // Message operations
  const addMessage = async (
    role: Message['role'],
    content: string,
    metadata?: Message['metadata']
  ): Promise<Message> => {
    const scenarioId = currentScenarioId()
    if (!scenarioId) throw new Error('No scenario selected')

    const msg = await store.addMessage(scenarioId, role, content, metadata)

    // Refresh messages
    const msgs = await store.getMessages(scenarioId)
    setMessages(msgs)

    // Refresh thread
    const thread = await store.getThread(scenarioId)
    setCurrentThread(thread)

    return msg
  }

  const addMessagesBatch = async (
    messagesToAdd: Array<{
      role: Message['role']
      content: string
      metadata?: Message['metadata']
    }>
  ): Promise<Message[]> => {
    const scenarioId = currentScenarioId()
    if (!scenarioId) throw new Error('No scenario selected')

    const saved = await store.addMessagesBatch(scenarioId, messagesToAdd)

    // Refresh messages
    const msgs = await store.getMessages(scenarioId)
    setMessages(msgs)

    // Refresh thread
    const thread = await store.getThread(scenarioId)
    setCurrentThread(thread)

    return saved
  }

  const refreshThread = async (): Promise<void> => {
    const scenarioId = currentScenarioId()
    if (!scenarioId) return

    const thread = await store.getThread(scenarioId)
    setCurrentThread(thread)

    if (thread) {
      const msgs = await store.getMessages(scenarioId)
      setMessages(msgs)
    }
  }

  // Roleplay message operations
  const addRoleplayMessage = (
    role: 'user' | 'assistant',
    content: string
  ): Message => {
    const msg: Message = {
      id: `roleplay-${roleplayIdCounter++}`,
      threadId: currentScenarioId() || 'roleplay',
      idx: roleplayMessages.length,
      role,
      content,
      createdAt: Date.now(),
    }

    setRoleplayMessages(
      produce((draft) => {
        draft.push(msg)
      })
    )

    return msg
  }

  const clearRoleplayMessages = () => {
    setRoleplayMessages([])
    roleplayIdCounter = 0
  }

  // Roleplay token tracking
  const roleplayTokenCount = createMemo(() => {
    return roleplayMessages.reduce((acc, msg) => {
      return acc + Math.ceil(msg.content.length / CHARS_PER_TOKEN)
    }, SYSTEM_PROMPT_TOKENS)
  })

  const roleplayNearLimit = createMemo(
    () => roleplayTokenCount() > MAX_CONTEXT_TOKENS * 0.9
  )
  const roleplayOverLimit = createMemo(
    () => roleplayTokenCount() > MAX_CONTEXT_TOKENS
  )

  // Survey state
  const completedSurveys = createMemo(() => {
    const p = profile()
    const personalityId = currentPersonalityId()
    if (!p || !personalityId) return []
    return p.completedSurveys?.[personalityId] || []
  })

  const nextSurvey = createMemo(() => {
    const personalityId = currentPersonalityId()
    if (!personalityId || isRoleplay()) return null
    return getNextSurvey(personalityId, completedSurveys())
  })

  const surveysComplete = createMemo(() => {
    const personalityId = currentPersonalityId()
    if (!personalityId) return true
    if (isRoleplay()) return true
    return areSurveysComplete(personalityId, completedSurveys())
  })

  const saveSurveyResponse = async (
    surveyId: string,
    optionId: string,
    translatedLabel: string
  ): Promise<void> => {
    const personalityId = currentPersonalityId()
    if (!personalityId) return

    const p = profile() || ({} as Partial<UserProfile>)
    const surveys = PERSONALITY_SURVEYS[personalityId]
    const survey = surveys?.find((s) => s.id === surveyId)

    if (!survey) return

    // Update completed surveys
    const existingCompleted = p.completedSurveys || {}
    const personalityCompleted = existingCompleted[personalityId] || []

    const updatedProfile: Partial<UserProfile> = {
      completedSurveys: {
        ...existingCompleted,
        [personalityId]: [...personalityCompleted, surveyId],
      },
    }

    // Update learning preferences based on survey
    const learning = { ...(p.learning || {}) }

    if (optionId !== 'none' && optionId !== 'other') {
      if (survey.id === 'englishLevel') {
        // Special case: level goes to root profile
        ;(updatedProfile as any).level = optionId
      } else if (survey.multiSelect) {
        // Append to existing array
        const existing = (learning as any)[survey.profileField] || []
        ;(learning as any)[survey.profileField] = [...existing, translatedLabel]
      } else {
        // Single select: set value
        ;(learning as any)[survey.profileField] = optionId
      }
    }

    updatedProfile.learning = learning as LearningPreferences

    await updateProfile(updatedProfile)
  }

  // User context for AI personalization
  const userContext = createMemo<UserContext | null>(() => {
    const p = profile()
    if (!p) return null

    return {
      name: p.name,
      language: p.language,
      level: p.level,
      favoriteArtists: p.learning?.favoriteArtists,
      favoriteAnime: p.learning?.favoriteAnime,
      favoriteGames: p.learning?.favoriteGames,
      goals: p.learning?.goals,
      musicProductionInterest: p.learning?.musicProductionInterest,
      // FSRS study data (TODO: integrate with study context)
      studiedToday: false,
      cardsStudiedToday: 0,
      newCardsRemaining: 0,
      totalCardsLearning: 0,
      totalCardsReview: 0,
    }
  })

  const value: ChatContextValue = {
    // Profile
    profile,
    profileLoading,
    updateProfile,

    // Thread state
    currentScenarioId,
    setCurrentScenarioId,
    currentThread,
    messages,
    messagesLoading,

    // Message operations
    addMessage,
    addMessagesBatch,
    refreshThread,

    // Survey state
    nextSurvey,
    surveysComplete,
    saveSurveyResponse,

    // User context
    userContext,

    // Roleplay mode
    isRoleplay,
    roleplayMessages,
    addRoleplayMessage,
    clearRoleplayMessages,
    roleplayTokenCount,
    roleplayNearLimit,
    roleplayOverLimit,
  }

  return (
    <ChatContext.Provider value={value}>{props.children}</ChatContext.Provider>
  )
}

// ============================================================
// Hook
// ============================================================

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}
