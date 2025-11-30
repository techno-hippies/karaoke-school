/**
 * ChatPage - Main chat page with AI personalities
 *
 * Shows list of AI tutors (Scarlett, Violet) or active conversation
 */

import { ChatContainer } from '@/components/chat/ChatContainer'
import { sendChatMessage, type PersonalityId, type UserContext } from '@/lib/chat'
import { useAuth } from '@/contexts/AuthContext'

export interface ChatPageProps {
  /** Called when entering/leaving a conversation (for hiding mobile footer) */
  onConversationChange?: (inConversation: boolean) => void
}

export function ChatPage({ onConversationChange }: ChatPageProps) {
  const { pkpAuthContext, isPKPReady, openAuthDialog } = useAuth()

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

  return (
    <ChatContainer
      onSendMessage={handleSendMessage}
      className="h-full"
      isAuthenticated={isPKPReady}
      authContext={pkpAuthContext}
      onAuthRequired={openAuthDialog}
      onConversationChange={onConversationChange}
    />
  )
}
