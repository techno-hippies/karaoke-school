import { cn } from '@/lib/utils'
import { ChatList, type ChatConversation } from './ChatList'

export interface ChatListPageProps {
  /** List of conversations */
  conversations: ChatConversation[]
  /** Called when a conversation is tapped */
  onSelectConversation?: (conversation: ChatConversation) => void
  className?: string
}

/**
 * ChatListPage - Full page chat list (no header, accessed via mobile footer)
 */
export function ChatListPage({
  conversations,
  onSelectConversation,
  className,
}: ChatListPageProps) {
  return (
    <div className={cn('min-h-screen bg-background flex flex-col', className)}>
      <div className="flex-1 flex flex-col min-h-0 p-4 max-w-3xl mx-auto w-full">
        <div className="flex-1 overflow-y-auto">
          <ChatList
            conversations={conversations}
            onSelectConversation={onSelectConversation}
          />
        </div>
      </div>
    </div>
  )
}
