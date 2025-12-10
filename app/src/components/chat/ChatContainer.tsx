/**
 * ChatContainer - Main chat orchestrator
 *
 * Handles:
 * - Scenario list view (personality selection)
 * - Individual chat view
 * - Navigation between them
 * - Message persistence (IDB for default, signal state for roleplay)
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
  splitProps,
} from 'solid-js'
import { ChatPage, type ChatItem } from './ChatPage'
import { ScenarioPicker, type PersonalityGroup, type ScenarioItem } from './ScenarioPicker'
import {
  SCARLETT_SCENARIOS,
  VIOLET_SCENARIOS,
  getScenarioDef,
  getPersonalityIdFromScenario,
} from './scenarios'
import {
  useChatContext,
  getThread,
  getOrCreateConversation,
  addMessage as addStoredMessage,
  addMessagesBatch,
  markThreadRead,
  getWelcomeMessageKey,
  type Message,
  type PersonalityId,
  type UserContext,
  AI_PERSONALITIES,
} from '@/lib/chat'
import type { PKPAuthContext } from '@/lib/lit/types'
import { useChatAudio } from '@/hooks/useChatAudio'
import { useChatTranslation } from '@/hooks/useChatTranslation'
import { useUnlockSubscription } from '@/hooks/useUnlockSubscription'
import { useTranslation } from '@/lib/i18n'
import { PremiumUpgradeDialog } from '@/components/purchase/PremiumUpgradeDialog'
import { PREMIUM_AI_LOCK } from '@/lib/contracts/addresses'

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

  // Persisted messages (from IDB)
  const [persistedMessages, setPersistedMessages] = createSignal<Message[]>([])

  // Roleplay messages (ephemeral, signal state only)
  const [roleplayMessages, setRoleplayMessages] = createSignal<Message[]>([])

  // Survey state
  const [isProcessingSurvey, setIsProcessingSurvey] = createSignal(false)

  // Premium upgrade dialog state
  const [upgradeDialogOpen, setUpgradeDialogOpen] = createSignal(false)

  // ============================================================
  // Extracted Hooks
  // ============================================================

  // Audio/TTS hook
  const chatAudio = useChatAudio({
    authContext: () => local.authContext,
    onAuthRequired: local.onAuthRequired,
  })

  // Translation hook
  const chatTranslation = useChatTranslation({
    authContext: () => local.authContext,
    onAuthRequired: local.onAuthRequired,
  })

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

  // Sync context's scenario ID with local state
  createEffect(() => {
    chatContext.setCurrentScenarioId(currentScenarioId())
  })

  // Determine if input should be disabled
  const isNewConversation = createMemo(() => messages().length === 0)
  const inputDisabled = createMemo(() => {
    if (isRoleplay()) return false
    return isNewConversation() && !chatContext.surveysComplete()
  })

  // ============================================================
  // Scenario Groups for Picker
  // ============================================================

  const scenarioGroups = createMemo<PersonalityGroup[]>(() => [
    {
      id: 'scarlett',
      name: 'Scarlett',
      scenarios: SCARLETT_SCENARIOS.map((def) => ({
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
      scenarios: VIOLET_SCENARIOS.map((def) => ({
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
      setRoleplayMessages([])
      const thread = await getThread(scenarioId)
      if (thread) {
        const { getMessages } = await import('@/lib/chat/store')
        const msgs = await getMessages(thread.id)
        setPersistedMessages(msgs)
      } else {
        setPersistedMessages([])
      }
    }
  })

  // Close upgrade dialog on success
  createEffect(() => {
    if (unlockSubscription.status() === 'complete') {
      setTimeout(() => {
        setUpgradeDialogOpen(false)
        unlockSubscription.reset()
      }, 2000)
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
      await addStoredMessage(scenarioId, role, content, metadata)
      setPersistedMessages((prev) => [...prev, newMessage])
    }
  }

  const handleSend = async (content: string) => {
    const scenarioId = currentScenarioId()
    const personalityId = currentPersonalityId()
    const personality = currentPersonality()

    if (!scenarioId || !personalityId || !personality) return

    if (!local.isAuthenticated) {
      local.onAuthRequired?.()
      return
    }

    if (!isRoleplay()) {
      await getOrCreateConversation(scenarioId, personality.name, personality.avatarUrl)
    }

    await addMessage('user', content)

    if (local.onSendMessage) {
      setIsTyping(true)
      try {
        const recentMessages = messages()
          .slice(-20)
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
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
    if (!local.isAuthenticated) {
      local.onAuthRequired?.()
      return
    }
    await chatAudio.startRecording()
  }

  const handleStopRecording = async () => {
    const result = await chatAudio.stopRecording()
    if (!result) return

    const scenarioId = currentScenarioId()
    const personalityId = currentPersonalityId()
    const personality = currentPersonality()

    if (!scenarioId || !personalityId || !personality) return

    if (!isRoleplay()) {
      await getOrCreateConversation(scenarioId, personality.name, personality.avatarUrl)
    }

    if (local.onSendMessage) {
      setIsTyping(true)
      try {
        const recentMessages = messages()
          .slice(-20)
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

        const { reply, transcript } = await local.onSendMessage('', {
          personalityId,
          messages: recentMessages,
          audioBase64: result.base64,
          userContext: chatContext.userContext(),
          scenarioId,
        })

        if (transcript) {
          await addMessage('user', transcript)
        }
        await addMessage('assistant', reply)
      } catch (error) {
        console.error('Failed to get LLM response:', error)
        await addMessage('assistant', "Sorry, I couldn't understand your voice message. Please try again.")
      } finally {
        setIsTyping(false)
      }
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
    const optionText = opt.label

    try {
      const thread = await getOrCreateConversation(scenarioId, personality.name, personality.avatarUrl)

      const messagesToSave: Array<{
        role: 'user' | 'assistant'
        content: string
        metadata?: Record<string, unknown>
      }> = []

      if (thread.messageCount === 0) {
        const welcomeKey = getWelcomeMessageKey(personality.id as PersonalityId)
        messagesToSave.push({
          role: 'assistant',
          content: t(welcomeKey),
          metadata: { isWelcome: true },
        })
      }

      messagesToSave.push({
        role: 'assistant',
        content: t(survey.questionKey),
        metadata: { isSurvey: true, surveyId: survey.id },
      })

      messagesToSave.push({
        role: 'user',
        content: optionText,
        metadata: { isSurvey: true, surveyId: survey.id, optionId: opt.id },
      })

      await addMessagesBatch(scenarioId, messagesToSave)
      await chatContext.saveSurveyResponse(survey.id, opt.id, optionText)

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
  // Navigation Handlers
  // ============================================================

  const handleScenarioSelect = async (scenario: ScenarioItem) => {
    const personalityId = scenario.id.split('-')[0]
    const personality = AI_PERSONALITIES.find((p) => p.id === personalityId)

    if (!personality) return

    if (!scenario.isRoleplay) {
      await getOrCreateConversation(scenario.id, personality.name, personality.avatarUrl)
      await markThreadRead(scenario.id)
    }

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

    if (isRoleplay()) {
      setRoleplayMessages([])
    }
  }

  // ============================================================
  // Premium Upgrade Handlers
  // ============================================================

  const handleUpgradeClick = () => {
    if (!local.isAuthenticated) {
      local.onAuthRequired?.()
      return
    }

    if (premiumLock.lockAddress === '0x0000000000000000000000000000000000000000') {
      console.warn('[ChatContainer] Premium AI lock not deployed yet')
      return
    }

    setUpgradeDialogOpen(true)
  }

  const showUpgradeButton = createMemo(() => !unlockSubscription.hasValidKey())

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
    let cumulativeTokens = 500

    // Welcome message for new default chats
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
          translation: chatTranslation.getTranslation('welcome'),
          isTranslating: chatTranslation.isTranslating('welcome'),
          onTranslate: () => chatTranslation.translate('welcome', welcomeText),
          tokensUsed: cumulativeTokens,
          maxTokens: MAX_TOKENS,
        },
      })
    }

    // Conversation messages
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i]
      const isAssistant = m.role === 'assistant'

      cumulativeTokens += Math.ceil(m.content.length / 4)

      const itemKey = i === 0 && m.metadata?.isWelcome ? 'welcome' : m.id
      const content = chatAudio.getHighlightedContent(m.id, m.content)

      items.push({
        type: 'message',
        id: itemKey,
        props: {
          content,
          sender: m.role === 'user' ? 'user' : 'ai',
          showTranslate: isAssistant,
          translation: chatTranslation.getTranslation(m.id),
          isTranslating: chatTranslation.isTranslating(m.id),
          onTranslate: isAssistant ? () => chatTranslation.translate(m.id, m.content) : undefined,
          hasAudio: isAssistant,
          isPlayingAudio: chatAudio.isPlaying(m.id),
          isLoadingAudio: chatAudio.isLoadingTts(m.id),
          onPlayAudio: isAssistant ? () => chatAudio.playAudio(m.id, m.content) : undefined,
          onStopAudio: chatAudio.stopAudio,
          tokensUsed: isAssistant ? cumulativeTokens : undefined,
          maxTokens: isAssistant ? MAX_TOKENS : undefined,
        },
      })
    }

    // Survey for default chats
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
  // Render
  // ============================================================

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
            isRecording: chatAudio.isRecording(),
            recordingDuration: chatAudio.recordingDuration(),
            isProcessing: chatAudio.isProcessingAudio(),
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

      <PremiumUpgradeDialog
        open={upgradeDialogOpen()}
        onOpenChange={setUpgradeDialogOpen}
        currentStep={unlockSubscription.status()}
        statusMessage={unlockSubscription.statusMessage()}
        errorMessage={unlockSubscription.errorMessage()}
        priceEth={0.001}
        onUpgrade={() => unlockSubscription.subscribe()}
        onRetry={() => unlockSubscription.reset()}
      />
    </>
  )
}

export default ChatContainer
