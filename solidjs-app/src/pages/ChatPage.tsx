/**
 * ChatPage - Route wrapper for ChatContainer
 *
 * Handles:
 * - URL-based scenario navigation (/chat, /chat/scarlett-surfing)
 * - Auth integration
 * - Lit Action message sending
 */

import { Component, createMemo } from 'solid-js'
import { useParams, useNavigate, useLocation } from '@solidjs/router'
import { ChatContainer } from '@/components/chat'
import { ChatProvider, sendChatMessage, type UserContext } from '@/lib/chat'
import { useAuth } from '@/contexts/AuthContext'

export const ChatPage: Component = () => {
  const params = useParams<{ scenarioId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()

  // Get scenario ID from URL (e.g., /chat/scarlett-surfing)
  const scenarioId = createMemo(() => {
    // Check URL path
    if (params.scenarioId) {
      return params.scenarioId
    }
    // Check query param as fallback
    const search = new URLSearchParams(location.search)
    return search.get('scenario') || undefined
  })

  // Handle scenario selection - update URL
  const handleScenarioSelect = (newScenarioId: string) => {
    navigate(`/chat/${newScenarioId}`)
  }

  // Handle back to list
  const handleBackToList = () => {
    navigate('/chat')
  }

  // Handle conversation view change (for analytics, etc.)
  const handleConversationChange = (inConversation: boolean) => {
    console.log('[ChatPage] In conversation:', inConversation)
  }

  // Handle auth required
  const handleAuthRequired = () => {
    auth.openAuthDialog()
  }

  // Handle sending messages via Lit Action
  const handleSendMessage = async (
    message: string,
    context: {
      personalityId: string
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      audioBase64?: string
      userContext?: UserContext | null
      scenarioId?: string
    }
  ): Promise<{ reply: string; transcript?: string }> => {
    const authContext = auth.pkpAuthContext()

    if (!authContext) {
      throw new Error('Not authenticated')
    }

    // Call Lit Action for chat response
    const response = await sendChatMessage(
      {
        personalityId: context.personalityId as 'scarlett' | 'violet',
        message,
        audioBase64: context.audioBase64,
        conversationHistory: context.messages,
        userContext: context.userContext,
        scenarioId: context.scenarioId,
      },
      authContext
    )

    if (!response.success) {
      throw new Error(response.error || 'Failed to get response')
    }

    return {
      reply: response.reply || "Sorry, I couldn't generate a response.",
      transcript: response.transcript,
    }
  }

  return (
    <ChatProvider>
      <ChatContainer
        initialScenarioId={scenarioId()}
        onScenarioSelect={handleScenarioSelect}
        onBackToList={handleBackToList}
        onConversationChange={handleConversationChange}
        onSendMessage={handleSendMessage}
        isAuthenticated={auth.isPKPReady()}
        authContext={auth.pkpAuthContext()}
        onAuthRequired={handleAuthRequired}
      />
    </ChatProvider>
  )
}
