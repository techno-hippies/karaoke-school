/**
 * ChatContainer - Main chat orchestrator
 *
 * Handles:
 * - Scenario list view (personality selection)
 * - Individual chat view
 * - Navigation between them
 * - Message persistence (IDB for default, React state for roleplay)
 * - Translation, TTS, and audio recording
 *
 * Each AI personality has exactly one ongoing conversation (default)
 * plus ephemeral roleplay scenarios.
 */

import {
  Component,
  Show,
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
  splitProps,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import { ChatPage, type ChatItem } from './ChatPage'
import { ScenarioPicker, type PersonalityGroup, type ScenarioItem } from './ScenarioPicker'
import {
  useChatContext,
  getThread,
  getOrCreateConversation,
  addMessage as addStoredMessage,
  addMessagesBatch,
  markThreadRead,
  translateText,
  synthesizeSpeech,
  getWelcomeMessageKey,
  createAudioPlayback,
  buildHighlightedContent,
  type Message,
  type PersonalityId,
  type UserContext,
  type TTSWord,
  AI_PERSONALITIES,
} from '@/lib/chat'
import type { PKPAuthContext } from '@/lib/lit/types'
import { createAudioRecorder } from '@/hooks/useAudioRecorder'
import { useUnlockSubscription } from '@/hooks/useUnlockSubscription'
import { useTranslation } from '@/lib/i18n'
import { PremiumUpgradeDialog } from '@/components/purchase/PremiumUpgradeDialog'
import { PREMIUM_AI_LOCK } from '@/lib/contracts/addresses'

// ============================================================
// Scenario Definitions
// ============================================================

interface ScenarioDef {
  id: string
  titleKey: string
  descriptionKey: string
  image: string
  isAdult?: boolean
  /** Roleplays are ephemeral (signal state only), default chats persist to IDB */
  isRoleplay?: boolean
}

const SCARLETT_SCENARIO_DEFS: ScenarioDef[] = [
  {
    id: 'scarlett-chat',
    titleKey: 'Default Chat',
    descriptionKey: 'Learn English through music and casual conversation',
    image: '/images/scarlett/default.webp',
    isRoleplay: false,
  },
  {
    id: 'scarlett-surfing',
    titleKey: 'Beach Day',
    descriptionKey: 'Join Scarlett for a day at the beach! Practice casual conversation while learning to surf.',
    image: '/images/scarlett/beach.webp',
    isRoleplay: true,
  },
  {
    id: 'scarlett-cafe',
    titleKey: 'Coffee Shop',
    descriptionKey: 'Meet Scarlett at a cozy café. Practice ordering and small talk.',
    image: '/images/scarlett/cafe.webp',
    isRoleplay: true,
  },
]

const VIOLET_SCENARIO_DEFS: ScenarioDef[] = [
  {
    id: 'violet-chat',
    titleKey: 'Default Chat',
    descriptionKey: 'Chat about anime, gaming, and Japanese culture',
    image: '/images/violet/default.webp',
    isRoleplay: false,
  },
  {
    id: 'violet-nightclub',
    titleKey: 'Late Night',
    descriptionKey: 'A more mature conversation setting for adult learners.',
    image: '/images/violet/nightclub.webp',
    isAdult: true,
    isRoleplay: true,
  },
  {
    id: 'violet-ramen',
    titleKey: 'Ramen Shop',
    descriptionKey: 'Visit a cozy ramen shop with Violet. Learn food vocabulary!',
    image: '/images/violet/ramen.webp',
    isRoleplay: true,
  },
]

const ALL_SCENARIOS: ScenarioDef[] = [...SCARLETT_SCENARIO_DEFS, ...VIOLET_SCENARIO_DEFS]

/** Get scenario definition by ID */
function getScenarioDef(scenarioId: string | null): ScenarioDef | undefined {
  if (!scenarioId) return undefined
  return ALL_SCENARIOS.find((s) => s.id === scenarioId)
}

/** Extract personality ID from scenario ID (e.g., "scarlett-surfing" -> "scarlett") */
function getPersonalityIdFromScenario(scenarioId: string | null): string | null {
  if (!scenarioId) return null
  return scenarioId.split('-')[0]
}

// ============================================================
// Audio Data Types
// ============================================================

interface MessageAudioData {
  audio: string // base64 MP3
  words: TTSWord[]
}

// ============================================================
// Component Props
// ============================================================

export interface ChatContainerProps {
  /** Called when LLM response is needed (text or audio) */
  onSendMessage?: (
    message: string,
    context: {
      personalityId: string
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      audioBase64?: string
      userContext?: UserContext | null
      scenarioId?: string
    }
  ) => Promise<{ reply: string; transcript?: string }>
  class?: string
  /** Whether user is authenticated */
  isAuthenticated?: boolean
  /** PKP auth context for translations */
  authContext?: PKPAuthContext | null
  /** Called when auth is required */
  onAuthRequired?: () => void
  /** Called when conversation view changes */
  onConversationChange?: (inConversation: boolean) => void
  /** Initial scenario ID from URL */
  initialScenarioId?: string
  /** Called when a scenario is selected (for URL navigation) */
  onScenarioSelect?: (scenarioId: string) => void
  /** Called when user wants to go back to scenario list */
  onBackToList?: () => void
}

// ============================================================
// Main Component
// ============================================================

export const ChatContainer: Component<ChatContainerProps> = (props) => {
  const { t } = useTranslation()
  const [local] = splitProps(props, [
    'onSendMessage',
    'class',
    'isAuthenticated',
    'authContext',
    'onAuthRequired',
    'onConversationChange',
    'initialScenarioId',
    'onScenarioSelect',
    'onBackToList',
  ])

  // ============================================================
  // Core State
  // ============================================================

  const [currentScenarioId, setCurrentScenarioId] = createSignal<string | null>(
    local.initialScenarioId || null
  )
  const [isTyping, setIsTyping] = createSignal(false)
  const [recordingDuration, setRecordingDuration] = createSignal(0)
  const [isProcessingAudio, setIsProcessingAudio] = createSignal(false)
  const [isRecording, setIsRecording] = createSignal(false)

  // Persisted messages (from IDB)
  const [persistedMessages, setPersistedMessages] = createSignal<Message[]>([])

  // Roleplay messages (ephemeral, signal state only)
  const [roleplayMessages, setRoleplayMessages] = createSignal<Message[]>([])

  // Survey state
  const [isProcessingSurvey, setIsProcessingSurvey] = createSignal(false)

  // Translation state
  const [translations, setTranslations] = createStore<Record<string, string>>({})
  const [translatingIds, setTranslatingIds] = createSignal<Set<string>>(new Set())

  // Audio/TTS state
  const [audioDataMap, setAudioDataMap] = createStore<Record<string, MessageAudioData>>({})
  const [playingMessageId, setPlayingMessageId] = createSignal<string | null>(null)
  const [loadingTtsIds, setLoadingTtsIds] = createSignal<Set<string>>(new Set())
  const [currentWordIndex, setCurrentWordIndex] = createSignal(-1)

  // Audio playback instance
  let audioPlayback: ReturnType<typeof createAudioPlayback> | null = null

  // Recording timer
  let recordingTimerRef: ReturnType<typeof setInterval> | null = null

  // Audio recorder instance
  const audioRecorder = createAudioRecorder()

  // Premium upgrade dialog state
  const [upgradeDialogOpen, setUpgradeDialogOpen] = createSignal(false)

  // Premium AI subscription hook (0.001 ETH / 30 days on Base Sepolia)
  const premiumLock = PREMIUM_AI_LOCK.testnet
  const unlockSubscription = useUnlockSubscription({
    lockAddress:
      premiumLock.lockAddress !== '0x0000000000000000000000000000000000000000'
        ? premiumLock.lockAddress
        : undefined,
  })

  // ============================================================
  // Derived State
  // ============================================================

  const currentScenarioDef = createMemo(() => getScenarioDef(currentScenarioId()))
  const currentPersonalityId = createMemo(() => getPersonalityIdFromScenario(currentScenarioId()))
  const isRoleplay = createMemo(() => currentScenarioDef()?.isRoleplay ?? false)

  const currentPersonality = createMemo(() => {
    const id = currentPersonalityId()
    if (!id) return null
    return AI_PERSONALITIES.find((p) => p.id === id) || null
  })

  // Use chat context for surveys and user profile
  const chatContext = useChatContext()

  // Unified messages (from either IDB or signal state based on mode)
  const messages = createMemo(() => (isRoleplay() ? roleplayMessages() : persistedMessages()))

  // Use context's survey state - it's already computed based on current personality
  // Note: chatContext.setCurrentScenarioId syncs with our local state
  createEffect(() => {
    chatContext.setCurrentScenarioId(currentScenarioId())
  })

  // Determine if input should be disabled
  const isNewConversation = createMemo(() => messages().length === 0)
  const inputDisabled = createMemo(() => {
    if (isRoleplay()) {
      // For roleplays: could check token limit here
      return false
    }
    // For default chats: disable input until surveys complete
    return isNewConversation() && !chatContext.surveysComplete()
  })

  // ============================================================
  // Scenario Groups for Picker
  // ============================================================

  const scenarioGroups = createMemo<PersonalityGroup[]>(() => [
    {
      id: 'scarlett',
      name: 'Scarlett',
      scenarios: SCARLETT_SCENARIO_DEFS.map((def) => ({
        id: def.id,
        title: def.titleKey,
        description: def.descriptionKey,
        image: def.image,
        isAdult: def.isAdult,
      })),
    },
    {
      id: 'violet',
      name: 'Violet',
      scenarios: VIOLET_SCENARIO_DEFS.map((def) => ({
        id: def.id,
        title: def.titleKey,
        description: def.descriptionKey,
        image: def.image,
        isAdult: def.isAdult,
      })),
    },
  ])

  // ============================================================
  // Effects
  // ============================================================

  // Sync state with URL when initialScenarioId changes
  createEffect(() => {
    const urlScenario = local.initialScenarioId
    if (urlScenario !== currentScenarioId()) {
      setCurrentScenarioId(urlScenario || null)
      setIsProcessingSurvey(false)
    }
  })

  // Notify parent when conversation view changes
  createEffect(() => {
    local.onConversationChange?.(currentPersonalityId() !== null)
  })

  // Load messages when scenario changes
  createEffect(async () => {
    const scenarioId = currentScenarioId()
    const roleplay = isRoleplay()

    if (!scenarioId) {
      setPersistedMessages([])
      setRoleplayMessages([])
      return
    }

    if (roleplay) {
      // Clear persisted, roleplay will be empty at start
      setPersistedMessages([])
      setRoleplayMessages([])

      // Add intro message for roleplay
      const scenarioDef = currentScenarioDef()
      const personality = currentPersonality()
      if (scenarioDef && personality) {
        const introMessage: Message = {
          id: `intro-${Date.now()}`,
          threadId: scenarioId,
          idx: 0,
          role: 'assistant',
          content: `*${scenarioDef.descriptionKey}*\n\nHey! ${personality.name === 'Scarlett' ? '✨' : '🎧'}`,
          createdAt: Date.now(),
        }
        setRoleplayMessages([introMessage])
      }
    } else {
      // Load from IDB
      setRoleplayMessages([])
      const thread = await getThread(scenarioId)
      if (thread) {
        // Thread exists, load messages
        const { getMessages } = await import('@/lib/chat/store')
        const msgs = await getMessages(thread.id)
        setPersistedMessages(msgs)
      } else {
        setPersistedMessages([])
      }
    }
  })

  // Recording duration timer
  createEffect(() => {
    if (isRecording()) {
      setRecordingDuration(0)
      recordingTimerRef = setInterval(() => {
        setRecordingDuration((d) => d + 1)
      }, 1000)
    } else {
      if (recordingTimerRef) {
        clearInterval(recordingTimerRef)
        recordingTimerRef = null
      }
    }
  })

  onCleanup(() => {
    if (recordingTimerRef) {
      clearInterval(recordingTimerRef)
    }
    if (audioPlayback) {
      audioPlayback.stop()
    }
  })

  // ============================================================
  // Message Handlers
  // ============================================================

  const addMessage = async (role: 'user' | 'assistant', content: string, metadata?: Record<string, unknown>) => {
    const scenarioId = currentScenarioId()
    if (!scenarioId) return

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      threadId: scenarioId,
      idx: messages().length,
      role,
      content,
      metadata,
      createdAt: Date.now(),
    }

    if (isRoleplay()) {
      setRoleplayMessages((prev) => [...prev, newMessage])
    } else {
      // Persist to IDB
      await addStoredMessage(scenarioId, role, content, metadata)
      setPersistedMessages((prev) => [...prev, newMessage])
    }
  }

  // ============================================================
  // Send Message
  // ============================================================

  const handleSend = async (content: string) => {
    const scenarioId = currentScenarioId()
    const personalityId = currentPersonalityId()
    const personality = currentPersonality()

    if (!scenarioId || !personalityId || !personality) return

    // Check authentication
    if (!local.isAuthenticated) {
      local.onAuthRequired?.()
      return
    }

    // Only persist for default chats
    if (!isRoleplay()) {
      await getOrCreateConversation(scenarioId, personality.name, personality.avatarUrl)
    }

    // Add user message
    await addMessage('user', content)

    // Get LLM response
    if (local.onSendMessage) {
      setIsTyping(true)
      try {
        const recentMessages = messages()
          .slice(-20)
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
        recentMessages.push({ role: 'user', content })

        const { reply } = await local.onSendMessage(content, {
          personalityId,
          messages: recentMessages,
          userContext: chatContext.userContext(),
          scenarioId,
        })

        await addMessage('assistant', reply)
      } catch (error) {
        console.error('Failed to get LLM response:', error)
        await addMessage('assistant', "Sorry, I'm having trouble responding right now. Please try again.")
      } finally {
        setIsTyping(false)
      }
    }
  }

  // ============================================================
  // Audio Recording Handlers
  // ============================================================

  const handleStartRecording = async () => {
    // Check authentication
    if (!local.isAuthenticated) {
      local.onAuthRequired?.()
      return
    }

    try {
      setIsRecording(true)
      await audioRecorder.startRecording()
    } catch (error) {
      console.error('[ChatContainer] Failed to start recording:', error)
      setIsRecording(false)
    }
  }

  const handleStopRecording = async () => {
    setIsRecording(false)
    setIsProcessingAudio(true)

    try {
      const result = await audioRecorder.stopRecording()
      if (!result) {
        throw new Error('No audio recorded')
      }

      const scenarioId = currentScenarioId()
      const personalityId = currentPersonalityId()
      const personality = currentPersonality()

      if (!scenarioId || !personalityId || !personality) {
        throw new Error('No active conversation')
      }

      // Only persist for default chats
      if (!isRoleplay()) {
        await getOrCreateConversation(scenarioId, personality.name, personality.avatarUrl)
      }

      // Get LLM response with audio
      if (local.onSendMessage) {
        setIsTyping(true)
        try {
          const recentMessages = messages()
            .slice(-20)
            .map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }))

          const { reply, transcript } = await local.onSendMessage('', {
            personalityId,
            messages: recentMessages,
            audioBase64: result.base64,
            userContext: chatContext.userContext(),
            scenarioId,
          })

          // Add user message with transcript if available
          if (transcript) {
            await addMessage('user', transcript)
          }

          // Add AI response
          await addMessage('assistant', reply)
        } catch (error) {
          console.error('Failed to get LLM response:', error)
          await addMessage('assistant', "Sorry, I couldn't understand your voice message. Please try again.")
        } finally {
          setIsTyping(false)
        }
      }
    } catch (error) {
      console.error('[ChatContainer] Recording error:', error)
    } finally {
      setIsProcessingAudio(false)
    }
  }

  // ============================================================
  // Survey Handler
  // ============================================================

  const handleSurveySelect = async (opt: { id: string; label: string; labelKey?: string }) => {
    if (isProcessingSurvey() || isRoleplay()) return

    const survey = chatContext.nextSurvey()
    const personality = currentPersonality()
    const scenarioId = currentScenarioId()

    if (!survey || !personality || !scenarioId) return

    setIsProcessingSurvey(true)

    // Use the already-translated label for display
    const optionText = opt.label

    try {
      const thread = await getOrCreateConversation(scenarioId, personality.name, personality.avatarUrl)

      // Build batch of messages to save
      const messagesToSave: Array<{
        role: 'user' | 'assistant'
        content: string
        metadata?: Record<string, unknown>
      }> = []

      // If brand new thread, include welcome intro
      if (thread.messageCount === 0) {
        const welcomeKey = getWelcomeMessageKey(personality.id as PersonalityId)
        messagesToSave.push({
          role: 'assistant',
          content: t(welcomeKey),
          metadata: { isWelcome: true },
        })
      }

      // Add question
      messagesToSave.push({
        role: 'assistant',
        content: t(survey.questionKey),
        metadata: { isSurvey: true, surveyId: survey.id },
      })

      // Add answer
      messagesToSave.push({
        role: 'user',
        content: optionText,
        metadata: { isSurvey: true, surveyId: survey.id, optionId: opt.id },
      })

      // Save messages
      await addMessagesBatch(scenarioId, messagesToSave)

      // Update user profile via context
      await chatContext.saveSurveyResponse(survey.id, opt.id, optionText)

      // Refresh messages from IDB
      const thread2 = await getThread(scenarioId)
      if (thread2) {
        const { getMessages } = await import('@/lib/chat/store')
        const msgs = await getMessages(thread2.id)
        setPersistedMessages(msgs)
      }
    } finally {
      setIsProcessingSurvey(false)
    }
  }

  // ============================================================
  // Translation Handler
  // ============================================================

  const handleTranslate = async (messageId: string, text: string) => {
    if (!local.authContext) {
      local.onAuthRequired?.()
      return
    }

    if (translatingIds().has(messageId) || translations[messageId]) {
      return
    }

    setTranslatingIds((prev) => new Set(prev).add(messageId))

    try {
      const response = await translateText(
        {
          text,
          targetLanguage: 'zh', // Default to Chinese
        },
        local.authContext!
      )

      if (response.success && response.translation) {
        setTranslations(messageId, response.translation)
      }
    } catch (error) {
      console.error('Translation error:', error)
    } finally {
      setTranslatingIds((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
    }
  }

  // ============================================================
  // Audio Handlers
  // ============================================================

  const handlePlayAudio = async (messageId: string, text: string) => {
    if (!local.authContext) {
      local.onAuthRequired?.()
      return
    }

    // Check if we already have audio data
    if (audioDataMap[messageId]) {
      playAudioData(messageId, audioDataMap[messageId])
      return
    }

    // Mark as loading
    setLoadingTtsIds((prev) => new Set(prev).add(messageId))

    try {
      const response = await synthesizeSpeech(
        { text },
        local.authContext!
      )

      if (response.success && response.audio) {
        const audioData: MessageAudioData = {
          audio: response.audio,
          words: response.words || [],
        }
        setAudioDataMap(messageId, audioData)
        playAudioData(messageId, audioData)
      }
    } catch (error) {
      console.error('TTS error:', error)
    } finally {
      setLoadingTtsIds((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
    }
  }

  const playAudioData = (messageId: string, data: MessageAudioData) => {
    // Stop any existing playback
    if (audioPlayback) {
      audioPlayback.stop()
    }

    setPlayingMessageId(messageId)
    setCurrentWordIndex(-1)

    // Create playback instance with onEnd callback
    audioPlayback = createAudioPlayback({
      onEnd: () => {
        setPlayingMessageId(null)
        setCurrentWordIndex(-1)
      },
    })

    // Track word index during playback
    createEffect(() => {
      if (audioPlayback && playingMessageId() === messageId) {
        setCurrentWordIndex(audioPlayback.currentWordIndex())
      }
    })

    // Start playback
    audioPlayback.play(data.audio, data.words)
  }

  const handleStopAudio = () => {
    if (audioPlayback) {
      audioPlayback.stop()
    }
    setPlayingMessageId(null)
    setCurrentWordIndex(-1)
  }

  // ============================================================
  // Navigation Handlers
  // ============================================================

  const handleScenarioSelect = async (scenario: ScenarioItem) => {
    const personalityId = scenario.id.split('-')[0]
    const personality = AI_PERSONALITIES.find((p) => p.id === personalityId)

    if (!personality) return

    // Only persist for default chats
    if (!scenario.isRoleplay) {
      await getOrCreateConversation(scenario.id, personality.name, personality.avatarUrl)
      await markThreadRead(scenario.id)
    }

    // Navigate
    if (local.onScenarioSelect) {
      local.onScenarioSelect(scenario.id)
    } else {
      setCurrentScenarioId(scenario.id)
    }
  }

  const goBack = () => {
    if (local.onBackToList) {
      local.onBackToList()
    } else {
      setCurrentScenarioId(null)
      setIsProcessingSurvey(false)
    }

    // Clear roleplay messages
    if (isRoleplay()) {
      setRoleplayMessages([])
    }
  }

  // ============================================================
  // Build Chat Items
  // ============================================================

  const chatItems = createMemo<ChatItem[]>(() => {
    const personality = currentPersonality()
    const personalityId = currentPersonalityId()
    const scenarioId = currentScenarioId()
    const msgs = messages()
    const survey = chatContext.nextSurvey()
    const complete = chatContext.surveysComplete()
    const roleplay = isRoleplay()

    if (!personality || !personalityId || !scenarioId) return []

    const items: ChatItem[] = []
    const MAX_TOKENS = 64000
    let cumulativeTokens = 500 // System prompt

    // For brand new default chats, show welcome message
    if (msgs.length === 0 && !roleplay) {
      const welcomeKey = getWelcomeMessageKey(personalityId as PersonalityId)
      const welcomeText = t(welcomeKey)
      cumulativeTokens += Math.ceil(welcomeText.length / 4)

      items.push({
        type: 'message',
        id: 'welcome',
        props: {
          content: welcomeText,
          sender: 'ai',
          showTranslate: true,
          translation: translations['welcome'],
          isTranslating: translatingIds().has('welcome'),
          onTranslate: () => handleTranslate('welcome', welcomeText),
          tokensUsed: cumulativeTokens,
          maxTokens: MAX_TOKENS,
        },
      })
    }

    // Add conversation messages
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i]
      const isAssistant = m.role === 'assistant'
      const audio = audioDataMap[m.id]
      const isThisPlaying = playingMessageId() === m.id
      const isLoadingTts = loadingTtsIds().has(m.id)

      cumulativeTokens += Math.ceil(m.content.length / 4)

      // Use stable key for welcome message
      const itemKey = i === 0 && m.metadata?.isWelcome ? 'welcome' : m.id

      // Build content with word highlighting (preserves emojis)
      let content: string | Array<{ text: string; isHighlighted: boolean }>
      if (isThisPlaying && audio?.words) {
        content = buildHighlightedContent(m.content, audio.words, currentWordIndex())
      } else {
        content = m.content
      }

      items.push({
        type: 'message',
        id: itemKey,
        props: {
          content,
          sender: m.role === 'user' ? 'user' : 'ai',
          showTranslate: isAssistant,
          translation: translations[m.id],
          isTranslating: translatingIds().has(m.id),
          onTranslate: isAssistant ? () => handleTranslate(m.id, m.content) : undefined,
          hasAudio: isAssistant,
          isPlayingAudio: isThisPlaying,
          isLoadingAudio: isLoadingTts,
          onPlayAudio: isAssistant ? () => handlePlayAudio(m.id, m.content) : undefined,
          onStopAudio: handleStopAudio,
          tokensUsed: isAssistant ? cumulativeTokens : undefined,
          maxTokens: isAssistant ? MAX_TOKENS : undefined,
        },
      })
    }

    // Show next survey (only for default chats)
    if (personalityId && survey && !complete && !roleplay) {
      const translatedOptions = survey.options.map((opt) => ({
        id: opt.id,
        label: t(opt.labelKey),
        labelKey: opt.labelKey,
      }))

      items.push({
        type: 'survey',
        id: `survey-${survey.id}`,
        props: {
          question: t(survey.questionKey),
          options: translatedOptions,
          onSelect: handleSurveySelect,
          disabled: isProcessingSurvey(),
        },
      })
    }

    return items
  })

  // ============================================================
  // Premium Upgrade Handlers
  // ============================================================

  const handleUpgradeClick = () => {
    // Check authentication first
    if (!local.isAuthenticated) {
      local.onAuthRequired?.()
      return
    }

    // Check if lock is deployed
    if (premiumLock.lockAddress === '0x0000000000000000000000000000000000000000') {
      console.warn('[ChatContainer] Premium AI lock not deployed yet')
      return
    }

    setUpgradeDialogOpen(true)
  }

  const handleUpgrade = async () => {
    await unlockSubscription.subscribe()
  }

  const handleUpgradeRetry = () => {
    unlockSubscription.reset()
  }

  // Close dialog on success after a short delay
  createEffect(() => {
    if (unlockSubscription.status() === 'complete') {
      setTimeout(() => {
        setUpgradeDialogOpen(false)
        unlockSubscription.reset()
      }, 2000)
    }
  })

  // ============================================================
  // Render
  // ============================================================

  // Don't show upgrade button if user already has a valid subscription
  const showUpgradeButton = createMemo(() => {
    return !unlockSubscription.hasValidKey()
  })

  return (
    <>
      <Show
        when={currentPersonalityId() && currentPersonality()}
        fallback={
          <ScenarioPicker
            groups={scenarioGroups()}
            onSelect={handleScenarioSelect}
            class={local.class}
          />
        }
      >
        <ChatPage
          items={chatItems()}
          title={currentPersonality()!.name}
          aiAvatarUrl={currentPersonality()!.avatarUrl}
          onBack={goBack}
          isTyping={isTyping()}
          showUpgrade={showUpgradeButton()}
          onUpgrade={handleUpgradeClick}
          inputProps={{
            onSend: handleSend,
            onStartRecording: handleStartRecording,
            onStopRecording: handleStopRecording,
            isRecording: isRecording(),
            recordingDuration: recordingDuration(),
            isProcessing: isProcessingAudio(),
            placeholder: inputDisabled()
              ? isRoleplay()
                ? 'Roleplay ended - go back to start a new one'
                : 'Complete the survey above...'
              : 'Type a message...',
            disabled: inputDisabled(),
          }}
          class={local.class}
        />
      </Show>

      {/* Premium Upgrade Dialog */}
      <PremiumUpgradeDialog
        open={upgradeDialogOpen()}
        onOpenChange={setUpgradeDialogOpen}
        currentStep={unlockSubscription.status()}
        statusMessage={unlockSubscription.statusMessage()}
        errorMessage={unlockSubscription.errorMessage()}
        priceEth={0.001}
        onUpgrade={handleUpgrade}
        onRetry={handleUpgradeRetry}
      />
    </>
  )
}

export default ChatContainer
