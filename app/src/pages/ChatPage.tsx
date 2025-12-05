/**
 * ChatPage - Main chat page with AI personalities
 *
 * Shows list of AI tutors (Scarlett, Violet) or active conversation
 *
 * URL structure:
 * - /chat - Scenario picker
 * - /chat/:personalityId - Default "chat" scenario for a personality
 * - /chat/:personalityId/:scenarioSlug - Specific scenario (e.g., /chat/scarlett/surfing)
 */

import { useParams, useNavigate } from 'react-router-dom'
import { useCallback } from 'react'
import { ChatContainer } from '@/components/chat/ChatContainer'
import { sendChatMessage, type PersonalityId, type UserContext } from '@/lib/chat'
import { useAuth } from '@/contexts/AuthContext'

export interface ChatPageProps {
  /** Called when entering/leaving a conversation (for hiding mobile footer) */
  onConversationChange?: (inConversation: boolean) => void
}

export function ChatPage({ onConversationChange }: ChatPageProps) {
  const { personalityId, scenarioSlug } = useParams<{ personalityId?: string; scenarioSlug?: string }>()
  const navigate = useNavigate()
  const { pkpAuthContext, isPKPReady, openAuthDialog } = useAuth()

  // Navigate to a specific scenario
  const handleScenarioNavigate = useCallback((scenarioId: string) => {
    // scenarioId format: "scarlett-surfing" -> navigate to /chat/scarlett/surfing
    // For default "chat" scenario, just use /chat/scarlett (no extra slug)
    const parts = scenarioId.split('-')
    const personality = parts[0]
    const scenario = parts.slice(1).join('-')

    if (scenario === 'chat' || !scenario) {
      // Default scenario - cleaner URL without redundant "chat"
      navigate(`/chat/${personality}`)
    } else {
      navigate(`/chat/${personality}/${scenario}`)
    }
  }, [navigate])

  // Navigate back to scenario picker
  const handleBackToList = useCallback(() => {
    navigate('/chat')
  }, [navigate])

  const handleSendMessage = async (
    message: string,
    context: {
      personalityId: string
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      audioBase64?: string
      userContext?: UserContext | null
    }
  ): Promise<{ reply: string; transcript?: string }> => {
    if (!pkpAuthContext) {
      openAuthDialog()
      throw new Error('Please sign in to chat')
    }

    console.log('[ChatPage] Sending message:', {
      hasMessage: !!message,
      hasAudio: !!context.audioBase64,
      audioLength: context.audioBase64?.length,
      hasUserContext: !!context.userContext,
    })

    const response = await sendChatMessage({
      personalityId: context.personalityId as PersonalityId,
      message: message || undefined,
      audioBase64: context.audioBase64,
      conversationHistory: context.messages,
      userContext: context.userContext,
      // TTS is now on-demand via separate action (user clicks Play)
      returnAudio: false,
      authContext: pkpAuthContext,
    })

    if (!response.success) {
      throw new Error(response.error || 'Failed to get response')
    }

    return {
      reply: response.reply,
      transcript: response.transcript,
    }
  }

  // Build scenario ID from URL params
  // /chat/scarlett -> "scarlett-chat" (default)
  // /chat/scarlett/surfing -> "scarlett-surfing"
  const urlScenarioId = personalityId
    ? `${personalityId}-${scenarioSlug || 'chat'}`
    : undefined

  return (
    <ChatContainer
      onSendMessage={handleSendMessage}
      className="h-full"
      isAuthenticated={isPKPReady}
      authContext={pkpAuthContext}
      onAuthRequired={openAuthDialog}
      onConversationChange={onConversationChange}
      initialScenarioId={urlScenarioId}
      onScenarioSelect={handleScenarioNavigate}
      onBackToList={handleBackToList}
    />
  )
}
