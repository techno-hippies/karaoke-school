import { cn } from '@/lib/utils'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { AvatarWithSkeleton } from '@/components/ui/avatar-with-skeleton'

export interface ChatConversation {
  id: string
  /** Display name */
  name: string
  /** Avatar URL */
  avatarUrl?: string
  /** Last message preview */
  lastMessage?: string
  /** Unread message count */
  unreadCount?: number
}

export interface ChatListProps {
  /** List of conversations */
  conversations: ChatConversation[]
  /** Called when a conversation is tapped */
  onSelectConversation?: (conversation: ChatConversation) => void
  /** Currently selected conversation ID */
  selectedId?: string
  className?: string
}

/**
 * ChatList - List of chat conversations using Item primitives
 */
export function ChatList({
  conversations,
  onSelectConversation,
  selectedId,
  className,
}: ChatListProps) {
  if (conversations.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 px-4', className)}>
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
          <span className="text-2xl text-muted-foreground">💬</span>
        </div>
        <p className="text-muted-foreground text-center">No conversations yet</p>
        <p className="text-sm text-muted-foreground/70 text-center mt-1">
          Start a chat with your AI tutor
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col space-y-1', className)}>
      {conversations.map((conversation) => {
        const isSelected = selectedId === conversation.id
        const hasUnread = (conversation.unreadCount ?? 0) > 0

        return (
          <Item
            key={conversation.id}
            variant="default"
            asChild
            className={cn(
              'gap-3 px-0 py-3',
              isSelected && 'bg-secondary'
            )}
          >
            <button
              onClick={() => onSelectConversation?.(conversation)}
              className="w-full cursor-pointer"
            >
              {/* Avatar */}
              <ItemMedia variant="image" className="size-12 self-center translate-y-0">
                <AvatarWithSkeleton
                  src={conversation.avatarUrl}
                  alt={conversation.name}
                  size="md"
                />
              </ItemMedia>

              {/* Name and message preview */}
              <ItemContent className="min-w-0 gap-0.5 flex-1">
                <ItemTitle className="w-full truncate text-left">{conversation.name}</ItemTitle>
                {conversation.lastMessage && (
                  <ItemDescription
                    className={cn(
                      'w-full truncate text-left line-clamp-1',
                      hasUnread && 'text-foreground font-medium'
                    )}
                  >
                    {conversation.lastMessage}
                  </ItemDescription>
                )}
              </ItemContent>

              {/* Unread badge */}
              {hasUnread && (
                <div className="flex items-center justify-center flex-shrink-0 pr-2">
                  <div className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-xs font-medium text-primary-foreground">
                      {conversation.unreadCount! > 99 ? '99+' : conversation.unreadCount}
                    </span>
                  </div>
                </div>
              )}
            </button>
          </Item>
        )
      })}
    </div>
  )
}
