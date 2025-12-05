/**
 * ChatContainer - Main chat view with storage integration
 *
 * Handles:
 * - Personality list view (who to chat with)
 * - Individual chat view
 * - Navigation between them
 * - Message persistence
 *
 * Each AI personality has exactly one ongoing conversation.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ScenarioCard } from './PersonalityCard'
import type { Scenario } from './PersonalityPicker'
import { ChatPage, type ChatItem } from './ChatPage'
import { PremiumUpgradeDialog } from '@/components/premium/PremiumUpgradeDialog'
import { useAIPersonalities } from '@/lib/chat/useAIPersonalities'
import { useUnlockSubscription } from '@/hooks/useUnlockSubscription'
import { PREMIUM_AI_LOCK } from '@/lib/contracts/addresses'
import { useThread } from '@/lib/chat/hooks'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { translateText, synthesizeSpeech, type TTSWord } from '@/lib/chat/service'
import { useAudioWithHighlight } from '@/lib/chat/useAudioWithHighlight'
import { useChatContext } from '@/lib/chat/useChatContext'
import { getWelcomeMessageKey, PERSONALITY_SURVEYS } from '@/lib/chat/surveys'
import * as store from '@/lib/chat/store'
import type { Thread, PersonalityId, UserContext } from '@/lib/chat/types'
import type { SurveyOption } from './ChatSurveyMessage'
import type { PKPAuthContext } from '@/lib/lit/types'
import { cn } from '@/lib/utils'

// Scenario definitions with i18n keys
interface ScenarioDef {
  id: string
  titleKey: string
  descriptionKey: string
  image: string
  isAdult?: boolean
}

const SCARLETT_SCENARIO_DEFS: ScenarioDef[] = [
  {
    id: 'scarlett-chat',
    titleKey: 'personalities.scarlett.scenarios.chat.title',
    descriptionKey: 'personalities.scarlett.scenarios.chat.description',
    image: '/images/scarlett/default.webp',
  },
  {
    id: 'scarlett-surfing',
    titleKey: 'personalities.scarlett.scenarios.surfing.title',
    descriptionKey: 'personalities.scarlett.scenarios.surfing.description',
    image: '/images/scarlett/beach.webp',
  },
  {
    id: 'scarlett-cafe',
    titleKey: 'personalities.scarlett.scenarios.cafe.title',
    descriptionKey: 'personalities.scarlett.scenarios.cafe.description',
    image: '/images/scarlett/cafe.webp',
  },
]

const VIOLET_SCENARIO_DEFS: ScenarioDef[] = [
  {
    id: 'violet-chat',
    titleKey: 'personalities.violet.scenarios.chat.title',
    descriptionKey: 'personalities.violet.scenarios.chat.description',
    image: '/images/violet/default.webp',
  },
  {
    id: 'violet-nightclub',
    titleKey: 'personalities.violet.scenarios.nightclub.title',
    descriptionKey: 'personalities.violet.scenarios.nightclub.description',
    image: '/images/violet/nightclub.webp',
    isAdult: true,
  },
  {
    id: 'violet-ramen',
    titleKey: 'personalities.violet.scenarios.ramen.title',
    descriptionKey: 'personalities.violet.scenarios.ramen.description',
    image: '/images/violet/ramen.webp',
  },
]

/** Audio data stored per message */
interface MessageAudioData {
  audio: string  // base64 MP3
  words: TTSWord[]
}

export interface ChatContainerProps {
  /** Called when LLM response is needed (text or audio) */
  onSendMessage?: (
    message: string,
    context: {
      personalityId: string
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      /** Base64 audio for STT (if provided, message will be empty) */
      audioBase64?: string
      /** User context for personalization */
      userContext?: UserContext | null
    }
  ) => Promise<{ reply: string; transcript?: string }>
  className?: string
  /** Whether user is authenticated */
  isAuthenticated?: boolean
  /** PKP auth context for translations */
  authContext?: PKPAuthContext | null
  /** Called when auth is required */
  onAuthRequired?: () => void
  /** Called when conversation view changes (true = in conversation, false = in list) */
  onConversationChange?: (inConversation: boolean) => void
  /** Initial scenario ID from URL (e.g., "scarlett-surfing") */
  initialScenarioId?: string
  /** Called when a scenario is selected (for URL navigation) */
  onScenarioSelect?: (scenarioId: string) => void
  /** Called when user wants to go back to scenario list */
  onBackToList?: () => void
}

/**
 * ChatContainer - Manages chat state and navigation
 */
export function ChatContainer({
  onSendMessage,
  className,
  isAuthenticated = false,
  authContext,
  onAuthRequired,
  onConversationChange,
  initialScenarioId,
  onScenarioSelect,
  onBackToList,
}: ChatContainerProps) {
  const { i18n, t } = useTranslation()

  // Parse initialScenarioId to get personality (e.g., "scarlett-surfing" -> "scarlett")
  const initialPersonalityId = initialScenarioId?.split('-')[0] || null

  const [currentPersonalityId, setCurrentPersonalityId] = useState<string | null>(initialPersonalityId)
  const [threads, setThreads] = useState<Map<string, Thread>>(new Map())
  const [isTyping, setIsTyping] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Premium upgrade dialog state
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)

  // Premium AI subscription hook
  // Use testnet lock address (TODO: switch based on environment)
  const premiumLock = PREMIUM_AI_LOCK.testnet
  const userAddress = authContext?.pkpAddress as `0x${string}` | undefined

  const {
    subscribe: purchasePremium,
    status: upgradeStatus,
    statusMessage: upgradeStatusMessage,
    errorMessage: upgradeErrorMessage,
    reset: resetUpgrade,
  } = useUnlockSubscription(
    userAddress,
    premiumLock.lockAddress !== '0x0000000000000000000000000000000000000000'
      ? premiumLock.lockAddress
      : undefined,
    {
      walletClient: authContext?.walletClient ?? null,
    }
  )

  // Track all answered surveys for sequential display
  const [surveyAnswers, setSurveyAnswers] = useState<Array<{
    surveyId: string
    option: SurveyOption
  }>>([])

  // Track if survey is being processed (disable clicking during save)
  const [isProcessingSurvey, setIsProcessingSurvey] = useState(false)

  // Translation state: messageId -> translation text
  const [translations, setTranslations] = useState<Map<string, string>>(new Map())
  // Track which messages are currently being translated
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set())

  // Audio/TTS state: messageId -> { audio, words }
  const [audioDataMap, setAudioDataMap] = useState<Map<string, MessageAudioData>>(new Map())
  // Track which message is currently playing audio
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  // Track which messages are loading TTS
  const [loadingTtsIds, setLoadingTtsIds] = useState<Set<string>>(new Set())

  // Audio playback with word highlighting
  const {
    play: playAudio,
    stop: stopAudio,
    isPlaying,
    currentWordIndex,
  } = useAudioWithHighlight({
    onEnd: () => setPlayingMessageId(null),
  })

  // Audio recording
  const {
    isRecording,
    startRecording,
    stopRecording,
    error: recordingError,
  } = useAudioRecorder()

  // Fetch AI personalities with real avatars from Lens
  const { personalities } = useAIPersonalities()

  // Recording duration timer
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1)
      }, 1000)
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }, [isRecording])

  // Log recording errors
  useEffect(() => {
    if (recordingError) {
      console.error('[ChatContainer] Recording error:', recordingError)
    }
  }, [recordingError])

  const {
    thread: currentThread,
    messages,
    addMessage,
    addMessagesBatch,
    refresh: refreshThread,
  } = useThread(currentPersonalityId)

  // Debug: Log when messages state changes
  useEffect(() => {
    console.log('[ChatContainer] Messages state updated', {
      messagesCount: messages.length,
      currentPersonalityId,
      hasThread: !!currentThread,
    })
  }, [messages, currentPersonalityId, currentThread])

  // Load existing threads for all personalities
  useEffect(() => {
    async function loadThreads() {
      const allThreads = await store.getThreads()
      console.log('[ChatContainer] Loaded threads on mount', {
        threadsCount: allThreads.length,
        threadIds: allThreads.map(t => t.id),
      })
      const threadMap = new Map<string, Thread>()
      for (const t of allThreads) {
        threadMap.set(t.tutorId, t)
      }
      setThreads(threadMap)
    }
    loadThreads()
  }, [])

  // Sync state with URL when initialScenarioId changes (browser back/forward)
  useEffect(() => {
    const newPersonalityId = initialScenarioId?.split('-')[0] || null
    if (newPersonalityId !== currentPersonalityId) {
      setCurrentPersonalityId(newPersonalityId)
      // Reset survey state when switching personalities
      setSurveyAnswers([])
      setIsProcessingSurvey(false)
    }
  }, [initialScenarioId]) // Only react to URL changes, not internal state

  // Notify parent when conversation view changes
  useEffect(() => {
    onConversationChange?.(currentPersonalityId !== null)
  }, [currentPersonalityId, onConversationChange])

  // Get current personality
  const currentPersonality = useMemo(
    () => personalities.find((p) => p.id === currentPersonalityId),
    [currentPersonalityId, personalities]
  )

  // Get chat context with dynamic surveys for current personality
  const {
    nextSurvey,
    surveysComplete,
    saveSurveyResponse,
    userContext,
  } = useChatContext(currentPersonalityId as PersonalityId | null)

  // Handle survey option selection
  const handleSurveySelect = useCallback(async (opt: SurveyOption) => {
    // Prevent double-clicking while processing
    if (isProcessingSurvey) return

    console.log('[Survey] handleSurveySelect START', {
      surveyId: nextSurvey?.id,
      option: opt.id,
      currentPersonalityId,
      personalityId: currentPersonality?.id,
      hasThread: !!currentThread,
      messagesCount: messages.length,
    })

    if (!nextSurvey || !currentPersonality) {
      console.warn('[Survey] Bailing: missing nextSurvey or currentPersonality')
      return
    }

    setIsProcessingSurvey(true)

    try {
      // Ensure conversation exists before saving messages
      console.log('[Survey] Creating/getting conversation...')
      const thread = await store.getOrCreateConversation(
        currentPersonality.id,
        currentPersonality.name,
        currentPersonality.avatarUrl
      )
      console.log('[Survey] Got thread:', { id: thread.id, messageCount: thread.messageCount })

      // Collect all messages to save in one batch
      const messagesToSave: Array<{
        role: 'user' | 'assistant'
        content: string
        metadata?: Record<string, unknown>
      }> = []

      // If brand new thread, include welcome intro as first message
      if (thread.messageCount === 0) {
        const welcomeIntroKey = `personalities.${currentPersonality.id}.welcomeIntro`
        const welcomeIntro = t(welcomeIntroKey)
        console.log('[Survey] Including welcome intro in batch', { welcomeIntro: welcomeIntro.substring(0, 50) })
        messagesToSave.push({
          role: 'assistant',
          content: welcomeIntro,
          metadata: { isWelcome: true },
        })
      }

      // Get translated question and answer
      const questionText = t(nextSurvey.questionKey)
      const translatedLabel = t(opt.labelKey)

      // Add question
      messagesToSave.push({
        role: 'assistant',
        content: questionText,
        metadata: { isSurvey: true, surveyId: nextSurvey.id },
      })

      // Add answer
      messagesToSave.push({
        role: 'user',
        content: translatedLabel,
        metadata: { isSurvey: true, surveyId: nextSurvey.id, optionId: opt.id },
      })

      // Check if this is the last survey
      const personalitySurveys = PERSONALITY_SURVEYS[currentPersonality.id as PersonalityId]
      const totalSurveys = personalitySurveys?.length || 0
      const answeredCount = surveyAnswers.length + 1 // including current answer
      const isLastSurvey = answeredCount >= totalSurveys

      console.log('[Survey] Checking if surveys complete', {
        totalSurveys,
        answeredCount,
        isLastSurvey,
      })

      // If last survey, include completion message
      if (isLastSurvey) {
        const completionKey = `personalities.${currentPersonality.id}.surveyComplete`
        const completionText = t(completionKey)
        console.log('[Survey] Including completion message in batch:', completionText.substring(0, 50))
        messagesToSave.push({
          role: 'assistant',
          content: completionText,
        })
      }

      // Save all messages in one batch (single refresh)
      console.log('[Survey] Saving batch of', messagesToSave.length, 'messages')
      await addMessagesBatch(messagesToSave)

      // Save response to UserProfile (for AI personalization context)
      console.log('[Survey] Saving to UserProfile...')
      await saveSurveyResponse(nextSurvey.id, opt.id, translatedLabel)
      console.log('[Survey] UserProfile updated')

      // Add to answered surveys list
      setSurveyAnswers(prev => [...prev, { surveyId: nextSurvey.id, option: opt }])

      console.log('[Survey] handleSurveySelect END', {
        messagesCount: messages.length,
        nextSurvey: nextSurvey.id,
      })
    } finally {
      setIsProcessingSurvey(false)
    }
  }, [isProcessingSurvey, nextSurvey, saveSurveyResponse, t, currentPersonality, addMessagesBatch, currentPersonalityId, currentThread, messages.length, surveyAnswers.length])

  // Handle translate button click
  const handleTranslate = useCallback(
    async (messageId: string, text: string) => {
      // Check authentication
      if (!authContext) {
        onAuthRequired?.()
        return
      }

      // Already translating or already have translation
      if (translatingIds.has(messageId) || translations.has(messageId)) {
        return
      }

      // Get target language (user's language, default to zh)
      // Only translate if not English
      const userLang = i18n.language
      if (userLang === 'en') {
        // User is in English, translate to Chinese by default
        // (they're learning from English content)
      }
      const targetLanguage = (userLang === 'en' ? 'zh' : userLang) as 'zh' | 'vi' | 'id'

      // Mark as translating
      setTranslatingIds((prev) => new Set(prev).add(messageId))

      try {
        const response = await translateText({
          text,
          targetLanguage,
          authContext,
        })

        if (response.success && response.translation) {
          setTranslations((prev) => {
            const next = new Map(prev)
            next.set(messageId, response.translation)
            return next
          })
        } else {
          console.error('[ChatContainer] Translation failed:', response.error)
        }
      } catch (error) {
        console.error('[ChatContainer] Translation error:', error)
      } finally {
        setTranslatingIds((prev) => {
          const next = new Set(prev)
          next.delete(messageId)
          return next
        })
      }
    },
    [authContext, i18n.language, onAuthRequired, translatingIds, translations]
  )

  // Handle playing audio for a message (on-demand TTS)
  const handlePlayAudio = useCallback(
    async (messageId: string, text: string) => {
      console.log('[ChatContainer] handlePlayAudio called:', messageId, 'text length:', text.length)

      // Check authentication
      if (!authContext) {
        console.warn('[ChatContainer] No authContext for TTS')
        onAuthRequired?.()
        return
      }

      // Already loading?
      if (loadingTtsIds.has(messageId)) {
        console.log('[ChatContainer] TTS already loading for:', messageId)
        return
      }

      // Stop any existing playback
      if (isPlaying) {
        stopAudio()
      }

      // Check if we already have audio cached
      const cachedAudio = audioDataMap.get(messageId)
      if (cachedAudio) {
        console.log('[ChatContainer] Playing cached audio:', {
          messageId,
          audioLength: cachedAudio.audio.length,
          wordsCount: cachedAudio.words.length,
        })
        setPlayingMessageId(messageId)
        playAudio(cachedAudio.audio, cachedAudio.words)
        return
      }

      // Fetch TTS on-demand
      console.log('[ChatContainer] Fetching TTS on-demand for:', messageId)
      setLoadingTtsIds((prev) => new Set(prev).add(messageId))

      try {
        const response = await synthesizeSpeech({
          text,
          authContext,
        })

        if (response.success && response.audio) {
          // Debug: log what Kokoro returns for word tokens
          console.log('[ChatContainer] TTS words from Kokoro:', response.words?.slice(0, 15).map(w => JSON.stringify(w.text)))

          // Merge standalone quote tokens with adjacent words to fix spacing
          // Opening quote: merge with next word if preceded by sentence-end punct or nothing
          // Closing quote: merge with previous word if it ends with a letter
          const mergedWords: TTSWord[] = []
          const rawWords = response.words ?? []

          for (let i = 0; i < rawWords.length; i++) {
            const word = rawWords[i]
            const text = word.text.trim()

            // Skip empty
            if (!text) continue

            // Check for quote - include straight AND curly quotes using Unicode escapes
            // \u0022 = " (34, straight double)
            // \u0027 = ' (39, straight single)
            // \u201C = " (8220, left double)
            // \u201D = " (8221, right double)
            // \u2018 = ' (8216, left single)
            // \u2019 = ' (8217, right single)
            const isQuote = /^[\u0022\u0027\u201C\u201D\u2018\u2019]+$/.test(text)

            const nextWord = rawWords[i + 1]
            const nextText = nextWord?.text.trim() || ''
            const prevMerged = mergedWords[mergedWords.length - 1]
            const prevText = prevMerged?.text || ''

            // Debug: log char codes for short tokens to identify quote types
            if (text.length <= 2) {
              console.log('[ChatContainer] Short token:', {
                text,
                charCodes: [...text].map(c => c.charCodeAt(0)),
                isQuote,
                prevText: prevText.slice(-5),
                nextText: nextText.slice(0, 5),
              })
            }

            // Determine if this quote is opening or closing based on context
            const prevIsSentenceEnd = !prevText || /[.!?]$/.test(prevText)
            const nextStartsWithLetter = /^[a-zA-Z]/.test(nextText)
            const prevEndsWithLetter = /[a-zA-Z]$/.test(prevText)

            if (isQuote && prevIsSentenceEnd && nextStartsWithLetter) {
              // Opening quote: merge with next word
              console.log('[ChatContainer] Merging opening quote:', text, '+', nextText)
              mergedWords.push({
                ...nextWord,
                text: text + nextText,
                start: word.start,
              })
              i++ // Skip next word since we merged it
            } else if (isQuote && prevEndsWithLetter) {
              // Closing quote after word: merge with previous
              console.log('[ChatContainer] Merging closing quote (after letter):', prevText, '+', text)
              prevMerged.text = prevMerged.text + text
              prevMerged.end = word.end
            } else if (isQuote && prevMerged && /[…,;:]$/.test(prevText)) {
              // Closing quote after punct like ellipsis: merge with previous
              console.log('[ChatContainer] Merging closing quote (after punct):', prevText, '+', text)
              prevMerged.text = prevMerged.text + text
              prevMerged.end = word.end
            } else {
              mergedWords.push({ ...word, text })
            }
          }

          console.log('[ChatContainer] Merged words:', mergedWords.slice(0, 15).map(w => JSON.stringify(w.text)))

          // Cache the audio with merged words
          const audioData: MessageAudioData = {
            audio: response.audio,
            words: mergedWords,
          }
          setAudioDataMap((prev) => {
            const next = new Map(prev)
            next.set(messageId, audioData)
            return next
          })

          // Play it
          setPlayingMessageId(messageId)
          playAudio(response.audio, mergedWords)
        } else {
          console.error('[ChatContainer] TTS failed:', response.error)
        }
      } catch (error) {
        console.error('[ChatContainer] TTS error:', error)
      } finally {
        setLoadingTtsIds((prev) => {
          const next = new Set(prev)
          next.delete(messageId)
          return next
        })
      }
    },
    [authContext, onAuthRequired, loadingTtsIds, isPlaying, stopAudio, audioDataMap, playAudio]
  )

  // Handle stopping audio playback
  const handleStopAudio = useCallback(() => {
    stopAudio()
    setPlayingMessageId(null)
  }, [stopAudio])

  // Convert messages to ChatItem format, with onboarding items for new conversations
  const chatItems: ChatItem[] = useMemo(() => {
    const isNewConversation = messages.length === 0
    const items: ChatItem[] = []

    // Token tracking: estimate ~4 chars per token (same as lit action)
    const MAX_TOKENS = 64000 // GLM 4.5 Air context limit
    let cumulativeTokens = 0

    // Include system prompt in token count (roughly ~500 tokens for personality prompt)
    cumulativeTokens += 500

    console.log('[ChatItems] Building chat items', {
      messagesCount: messages.length,
      isNewConversation,
      currentPersonalityId,
      nextSurveyId: nextSurvey?.id,
      surveysComplete,
      isProcessingSurvey,
    })

    // For brand new conversations, show welcome message
    if (isNewConversation && currentPersonality && currentPersonalityId) {
      const personalityId = currentPersonalityId as PersonalityId

      // Welcome message only (surveys will be saved as messages after answering)
      const welcomeKey = getWelcomeMessageKey(personalityId)
      const welcomeText = t(welcomeKey, { name: currentPersonality.name })

      // Add welcome message tokens
      cumulativeTokens += Math.ceil(welcomeText.length / 4)

      console.log('[ChatItems] Adding welcome message')
      items.push({
        type: 'message',
        id: 'welcome',
        props: {
          content: welcomeText,
          sender: 'ai',
          showTranslate: true,
          translation: translations.get('welcome'),
          isTranslating: translatingIds.has('welcome'),
          onTranslate: () => handleTranslate('welcome', welcomeText),
          tokensUsed: cumulativeTokens,
          maxTokens: MAX_TOKENS,
        },
      })
    }

    // Add actual conversation messages (use for loop to track cumulative tokens)
    console.log('[ChatItems] Adding messages from state:', messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content.substring(0, 30),
      isSurvey: m.metadata?.isSurvey,
      surveyId: m.metadata?.surveyId,
      isWelcome: m.metadata?.isWelcome,
    })))

    for (let index = 0; index < messages.length; index++) {
      const m = messages[index]
      const isAssistant = m.role === 'assistant'
      const audioData = audioDataMap.get(m.id)
      const isThisMessagePlaying = playingMessageId === m.id && isPlaying
      const isLoadingTts = loadingTtsIds.has(m.id)

      // Track cumulative tokens (~4 chars per token)
      cumulativeTokens += Math.ceil(m.content.length / 4)

      // Use stable key 'welcome' for the first message if it has isWelcome metadata
      // This prevents React unmount/mount flash when transitioning from ephemeral to persisted
      const itemKey = (index === 0 && m.metadata?.isWelcome) ? 'welcome' : m.id

      // Build content - use word array with highlighting if this message is playing
      let content: string | Array<{ text: string; isHighlighted: boolean }>
      if (isThisMessagePlaying && audioData?.words) {
        // Map TTS words to ChatWord format with highlighting
        // Trim each word to remove any embedded whitespace from Kokoro
        // Don't filter - preserve index alignment for highlighting
        content = audioData.words.map((word, idx) => ({
          text: word.text.trim(),
          isHighlighted: idx === currentWordIndex,
        }))
      } else {
        content = m.content
      }

      items.push({
        type: 'message' as const,
        id: itemKey,
        props: {
          content,
          sender: m.role === 'user' ? ('user' as const) : ('ai' as const),
          showTranslate: isAssistant,
          translation: translations.get(m.id),
          isTranslating: translatingIds.has(m.id),
          onTranslate: isAssistant ? () => handleTranslate(m.id, m.content) : undefined,
          // All AI messages can have TTS (on-demand)
          hasAudio: isAssistant,
          isPlayingAudio: isThisMessagePlaying,
          isLoadingAudio: isLoadingTts,
          onPlayAudio: isAssistant ? () => handlePlayAudio(m.id, m.content) : undefined,
          onStopAudio: handleStopAudio,
          // Only show context indicator on AI messages
          tokensUsed: isAssistant ? cumulativeTokens : undefined,
          maxTokens: isAssistant ? MAX_TOKENS : undefined,
        },
      })
    }

    // Show next unanswered survey (if any)
    // Survey stays visible during processing but options are disabled
    if (currentPersonalityId && nextSurvey && !surveysComplete) {
      // Translate question and options for display
      const translatedQuestion = t(nextSurvey.questionKey)
      const translatedOptions = nextSurvey.options.map(opt => ({
        id: opt.id,
        label: t(opt.labelKey),
        labelKey: opt.labelKey, // Keep labelKey for saving
      }))

      console.log('[ChatItems] Adding next survey:', nextSurvey.id, { disabled: isProcessingSurvey })
      items.push({
        type: 'survey',
        id: `survey-${nextSurvey.id}`,
        props: {
          question: translatedQuestion,
          options: translatedOptions,
          onSelect: handleSurveySelect,
          disabled: isProcessingSurvey,
        },
      })
    } else {
      console.log('[ChatItems] NOT adding survey:', {
        hasPersonalityId: !!currentPersonalityId,
        hasNextSurvey: !!nextSurvey,
        surveysComplete,
      })
    }

    console.log('[ChatItems] Final items count:', items.length, items.map(i => ({ type: i.type, id: i.id })))
    return items
  }, [messages, currentPersonality, currentPersonalityId, nextSurvey, surveysComplete, isProcessingSurvey, handleSurveySelect, translations, translatingIds, handleTranslate, audioDataMap, playingMessageId, isPlaying, loadingTtsIds, currentWordIndex, handlePlayAudio, handleStopAudio, t])

  // Handle sending a message
  const handleSend = useCallback(
    async (content: string) => {
      if (!currentPersonalityId || !currentPersonality) return

      // Check authentication before sending
      if (!isAuthenticated) {
        onAuthRequired?.()
        return
      }

      // Ensure conversation exists
      await store.getOrCreateConversation(
        currentPersonality.id,
        currentPersonality.name,
        currentPersonality.avatarUrl
      )

      // Add user message
      await addMessage('user', content)

      // If we have an onSendMessage handler, call it for LLM response
      if (onSendMessage) {
        setIsTyping(true)
        try {
          // Build recent messages context
          const recentMessages = messages.slice(-20).map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
          recentMessages.push({ role: 'user', content })

          const { reply } = await onSendMessage(content, {
            personalityId: currentPersonalityId,
            messages: recentMessages,
            userContext,
          })

          // Add assistant response (TTS fetched on-demand when user clicks Play)
          await addMessage('assistant', reply)
        } catch (error) {
          console.error('Failed to get LLM response:', error)
          await addMessage(
            'assistant',
            "Sorry, I'm having trouble responding right now. Please try again."
          )
        } finally {
          setIsTyping(false)
        }
      }

      // Refresh threads to update last message preview
      const allThreads = await store.getThreads()
      const threadMap = new Map<string, Thread>()
      for (const t of allThreads) {
        threadMap.set(t.tutorId, t)
      }
      setThreads(threadMap)
    },
    [
      currentPersonalityId,
      currentPersonality,
      messages,
      addMessage,
      onSendMessage,
      isAuthenticated,
      onAuthRequired,
      userContext,
    ]
  )

  // Go back to list
  const goBack = useCallback(async () => {
    // Navigate via URL if handler provided, otherwise just update state
    if (onBackToList) {
      onBackToList()
    } else {
      setCurrentPersonalityId(null)
      // Reset survey state
      setSurveyAnswers([])
      setIsProcessingSurvey(false)
    }
    // Refresh thread list
    const allThreads = await store.getThreads()
    const threadMap = new Map<string, Thread>()
    for (const t of allThreads) {
      threadMap.set(t.tutorId, t)
    }
    setThreads(threadMap)
  }, [onBackToList])

  // Handle starting voice recording
  const handleStartRecording = useCallback(() => {
    console.log('[ChatContainer] Starting recording...')
    startRecording()
  }, [startRecording])

  // Handle stopping voice recording and transcribing
  const handleStopRecording = useCallback(async () => {
    if (!currentPersonalityId || !currentPersonality || !onSendMessage) {
      console.error('[ChatContainer] Cannot process audio: missing personality or handler')
      return
    }

    // Check authentication before processing
    if (!isAuthenticated) {
      onAuthRequired?.()
      return
    }

    console.log('[ChatContainer] Stopping recording...')
    setIsProcessingAudio(true)

    try {
      const result = await stopRecording()
      if (!result) {
        console.error('[ChatContainer] No recording result')
        return
      }

      console.log('[ChatContainer] Recording stopped, base64 length:', result.base64.length)

      // Ensure conversation exists
      await store.getOrCreateConversation(
        currentPersonality.id,
        currentPersonality.name,
        currentPersonality.avatarUrl
      )

      // Build recent messages context (don't include user message yet - will add transcript)
      const recentMessages = messages.slice(-20).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      // Send audio to STT + LLM via Lit Action
      setIsTyping(true)
      const { reply, transcript } = await onSendMessage('', {
        personalityId: currentPersonalityId,
        messages: recentMessages,
        audioBase64: result.base64,
        userContext,
      })

      console.log('[ChatContainer] Got transcript:', transcript)
      console.log('[ChatContainer] Got reply:', reply.substring(0, 100) + '...')

      // Add user's transcribed message
      if (transcript) {
        await addMessage('user', transcript)
      }

      // Add assistant response (TTS fetched on-demand when user clicks Play)
      await addMessage('assistant', reply)

      // Refresh threads to update last message preview
      const allThreads = await store.getThreads()
      const threadMap = new Map<string, Thread>()
      for (const t of allThreads) {
        threadMap.set(t.tutorId, t)
      }
      setThreads(threadMap)

    } catch (error) {
      console.error('[ChatContainer] Recording/transcription error:', error)
      await addMessage(
        'assistant',
        "Sorry, I couldn't understand the audio. Please try again or type your message."
      )
    } finally {
      setIsProcessingAudio(false)
      setIsTyping(false)
    }
  }, [stopRecording, currentPersonalityId, currentPersonality, onSendMessage, isAuthenticated, onAuthRequired, messages, addMessage, userContext])

  // Determine if input should be disabled (during onboarding survey)
  const isNewConversation = messages.length === 0
  const inputDisabled = isNewConversation && !surveysComplete

  // Handle upgrade button click
  const handleUpgradeClick = useCallback(() => {
    resetUpgrade()
    setUpgradeDialogOpen(true)
  }, [resetUpgrade])

  // Handle upgrade purchase via Unlock Protocol
  const handleUpgrade = useCallback(async () => {
    // Check if lock is deployed
    if (premiumLock.lockAddress === '0x0000000000000000000000000000000000000000') {
      console.warn('[ChatContainer] Premium AI lock not deployed yet')
      return
    }
    await purchasePremium()
  }, [purchasePremium, premiumLock.lockAddress])

  // Handle scenario selection (must be before early return for hooks rules)
  const handleScenarioSelect = useCallback(async (scenario: Scenario) => {
    // Extract personality ID from scenario ID (e.g., 'scarlett-chat' -> 'scarlett')
    const personalityId = scenario.id.split('-')[0]
    const personality = personalities.find(p => p.id === personalityId)

    if (!personality) {
      console.error('[ChatContainer] Personality not found for scenario:', scenario.id)
      return
    }

    // Ensure conversation exists
    await store.getOrCreateConversation(
      personality.id,
      personality.name,
      personality.avatarUrl
    )
    // Mark as read
    await store.markThreadRead(personality.id)

    // Navigate via URL if handler provided, otherwise just update state
    if (onScenarioSelect) {
      onScenarioSelect(scenario.id)
    } else {
      setCurrentPersonalityId(personality.id)
    }
    // TODO: Store scenario.id for roleplay context
  }, [personalities, onScenarioSelect])

  // Translate scenario definitions (must be before early return for hooks rules)
  const scarlettScenarios: Scenario[] = useMemo(() =>
    SCARLETT_SCENARIO_DEFS.map(def => ({
      id: def.id,
      title: t(def.titleKey),
      description: t(def.descriptionKey),
      image: def.image,
      isAdult: def.isAdult,
    })),
    [t]
  )

  const violetScenarios: Scenario[] = useMemo(() =>
    VIOLET_SCENARIO_DEFS.map(def => ({
      id: def.id,
      title: t(def.titleKey),
      description: t(def.descriptionKey),
      image: def.image,
      isAdult: def.isAdult,
    })),
    [t]
  )

  // If we have a current personality, show the chat
  if (currentPersonalityId && currentPersonality) {
    return (
      <>
        <ChatPage
          items={chatItems}
          title={currentPersonality.name}
          aiAvatarUrl={currentPersonality.avatarUrl}
          onBack={goBack}
          isTyping={isTyping}
          showUpgrade={true}
          onUpgrade={handleUpgradeClick}
          inputProps={{
            onSend: handleSend,
            onStartRecording: handleStartRecording,
            onStopRecording: handleStopRecording,
            isRecording,
            recordingDuration,
            isProcessing: isProcessingAudio,
            placeholder: inputDisabled ? t('chatInput.completeSurvey') : t('chatInput.placeholder'),
            disabled: inputDisabled,
          }}
          className={className}
        />
        <PremiumUpgradeDialog
          open={upgradeDialogOpen}
          onOpenChange={setUpgradeDialogOpen}
          currentStep={upgradeStatus}
          statusMessage={upgradeStatusMessage}
          errorMessage={upgradeErrorMessage}
          onUpgrade={handleUpgrade}
          onRetry={resetUpgrade}
        />
      </>
    )
  }

  // Otherwise show the grouped scenario picker
  return (
    <div className={cn('min-h-screen bg-background p-4', className)}>
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scarlett Section */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">Scarlett</h2>
          <div className="space-y-3">
            {scarlettScenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                {...scenario}
                onClick={() => handleScenarioSelect(scenario)}
              />
            ))}
          </div>
        </section>

        {/* Violet Section */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">Violet</h2>
          <div className="space-y-3">
            {violetScenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                {...scenario}
                onClick={() => handleScenarioSelect(scenario)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
