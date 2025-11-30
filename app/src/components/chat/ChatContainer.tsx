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
import { ChatListPage } from './ChatListPage'
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
import { getWelcomeMessage, getSurveyFollowUp, PERSONALITY_SURVEYS } from '@/lib/chat/surveys'
import * as store from '@/lib/chat/store'
import type { ChatConversation } from './ChatList'
import type { Thread, PersonalityId, UserContext } from '@/lib/chat/types'
import type { SurveyOption } from './ChatSurveyMessage'
import type { PKPAuthContext } from '@/lib/lit/types'

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
}: ChatContainerProps) {
  const { i18n } = useTranslation()
  const [currentPersonalityId, setCurrentPersonalityId] = useState<string | null>(null)
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

  // Track if user just answered (to show next survey after a brief moment)
  const [justAnswered, setJustAnswered] = useState(false)

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
    refresh: refreshThread,
  } = useThread(currentPersonalityId)

  // Load existing threads for all personalities
  useEffect(() => {
    async function loadThreads() {
      const allThreads = await store.getThreads()
      const threadMap = new Map<string, Thread>()
      for (const t of allThreads) {
        threadMap.set(t.tutorId, t)
      }
      setThreads(threadMap)
    }
    loadThreads()
  }, [])

  // Notify parent when conversation view changes
  useEffect(() => {
    onConversationChange?.(currentPersonalityId !== null)
  }, [currentPersonalityId, onConversationChange])

  // Convert personalities to ChatConversation format
  const conversations: ChatConversation[] = useMemo(
    () =>
      personalities.map((p) => {
        const thread = threads.get(p.id)
        return {
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl,
          lastMessage: thread?.lastMessagePreview ?? p.description,
          unreadCount: thread?.unreadCount ?? 0,
        }
      }),
    [threads, personalities]
  )

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
    if (!nextSurvey) return

    // Save response to IDB
    await saveSurveyResponse(nextSurvey.id, opt.id, opt.label)

    // Add to answered surveys list
    setSurveyAnswers(prev => [...prev, { surveyId: nextSurvey.id, option: opt }])

    // Brief pause before showing next survey
    setJustAnswered(true)
    setTimeout(() => setJustAnswered(false), 300)
  }, [nextSurvey, saveSurveyResponse])

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

    // For new conversations, show welcome message and surveys as sequential chat
    if (isNewConversation && currentPersonality && currentPersonalityId) {
      const personalityId = currentPersonalityId as PersonalityId
      const surveys = PERSONALITY_SURVEYS[personalityId] || []

      // 1. Welcome message
      const welcomeText = getWelcomeMessage(personalityId, currentPersonality.name)
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
        },
      })

      // 2. Show completed surveys as conversation history
      for (const answer of surveyAnswers) {
        const survey = surveys.find(s => s.id === answer.surveyId)
        if (!survey) continue

        // AI asks the survey question (as a message, not interactive survey)
        items.push({
          type: 'message',
          id: `survey-q-${answer.surveyId}`,
          props: {
            content: survey.question,
            sender: 'ai',
            showTranslate: true,
            translation: translations.get(`survey-q-${answer.surveyId}`),
            isTranslating: translatingIds.has(`survey-q-${answer.surveyId}`),
            onTranslate: () => handleTranslate(`survey-q-${answer.surveyId}`, survey.question),
          },
        })

        // User's answer (as a user message)
        items.push({
          type: 'message',
          id: `survey-a-${answer.surveyId}`,
          props: {
            content: answer.option.label,
            sender: 'user',
          },
        })

        // AI's follow-up response
        const responseText = getSurveyFollowUp(personalityId, answer.surveyId, answer.option)
        items.push({
          type: 'message',
          id: `survey-response-${answer.surveyId}`,
          props: {
            content: responseText,
            sender: 'ai',
            showTranslate: true,
            translation: translations.get(`survey-response-${answer.surveyId}`),
            isTranslating: translatingIds.has(`survey-response-${answer.surveyId}`),
            onTranslate: () => handleTranslate(`survey-response-${answer.surveyId}`, responseText),
          },
        })
      }

      // 3. Show next unanswered survey (if any and not in brief pause after answering)
      if (nextSurvey && !justAnswered) {
        items.push({
          type: 'survey',
          id: `survey-${nextSurvey.id}`,
          props: {
            question: nextSurvey.question,
            options: nextSurvey.options,
            onSelect: handleSurveySelect,
          },
        })
      }
    }

    // Add actual conversation messages
    items.push(
      ...messages.map((m) => {
        const isAssistant = m.role === 'assistant'
        const audioData = audioDataMap.get(m.id)
        const isThisMessagePlaying = playingMessageId === m.id && isPlaying
        const isLoadingTts = loadingTtsIds.has(m.id)

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

        return {
          type: 'message' as const,
          id: m.id,
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
          },
        }
      })
    )

    return items
  }, [messages, currentPersonality, currentPersonalityId, nextSurvey, surveysComplete, surveyAnswers, justAnswered, handleSurveySelect, translations, translatingIds, handleTranslate, audioDataMap, playingMessageId, isPlaying, loadingTtsIds, currentWordIndex, handlePlayAudio, handleStopAudio])

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

  // Handle selecting a personality to chat with
  const handleSelectConversation = useCallback(
    async (conv: ChatConversation) => {
      const personality = personalities.find((p) => p.id === conv.id)
      if (!personality) return

      // Ensure conversation exists
      await store.getOrCreateConversation(
        personality.id,
        personality.name,
        personality.avatarUrl
      )

      // Mark as read
      await store.markThreadRead(personality.id)

      setCurrentPersonalityId(personality.id)
    },
    [personalities]
  )

  // Go back to list
  const goBack = useCallback(async () => {
    setCurrentPersonalityId(null)
    // Reset survey state
    setSurveyAnswers([])
    setJustAnswered(false)
    // Refresh thread list
    const allThreads = await store.getThreads()
    const threadMap = new Map<string, Thread>()
    for (const t of allThreads) {
      threadMap.set(t.tutorId, t)
    }
    setThreads(threadMap)
  }, [])

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
            placeholder: inputDisabled ? 'Complete the survey above...' : 'Type a message...',
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

  // Otherwise show the personality list
  return (
    <ChatListPage
      conversations={conversations}
      onSelectConversation={handleSelectConversation}
      className={className}
    />
  )
}
