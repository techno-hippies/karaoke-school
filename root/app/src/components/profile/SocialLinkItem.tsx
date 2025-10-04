import { X, XLogo, InstagramLogo, Link as LinkIcon, Plus } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export type SocialPlatform = 'twitter' | 'instagram' | 'website'

export interface SocialLinkItemProps {
  platform: SocialPlatform
  url?: string
  onAdd?: () => void
  onRemove?: () => void
  onChange?: (url: string) => void
  className?: string
}

const platformConfig = {
  twitter: {
    icon: XLogo,
    label: 'Twitter',
    placeholder: 'https://twitter.com/username',
  },
  instagram: {
    icon: InstagramLogo,
    label: 'Instagram',
    placeholder: 'https://instagram.com/username',
  },
  website: {
    icon: LinkIcon,
    label: 'Website',
    placeholder: 'https://yourwebsite.com',
  },
}

/**
 * SocialLinkItem - Social link input with add/remove
 * Shows empty state with "Add" button or filled state with input + remove
 */
export function SocialLinkItem({
  platform,
  url,
  onAdd,
  onRemove,
  onChange,
  className
}: SocialLinkItemProps) {
  const config = platformConfig[platform]
  const Icon = config.icon
  const isEmpty = !url

  if (isEmpty) {
    // Empty state - show "Add" button
    return (
      <button
        onClick={onAdd}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 bg-neutral-800 rounded-lg border border-neutral-700 hover:border-neutral-600 transition-colors',
          className
        )}
      >
        <Icon className="w-5 h-5 text-neutral-400" />
        <span className="text-neutral-400 text-base">Add {config.label}</span>
        <Plus className="w-5 h-5 text-neutral-400 ml-auto" />
      </button>
    )
  }

  // Filled state - show input with remove button
  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center gap-3 px-4 py-3 bg-neutral-800 rounded-lg border border-neutral-700">
        <Icon className="w-5 h-5 text-white flex-shrink-0" />
        <input
          type="url"
          value={url}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={config.placeholder}
          className="flex-1 bg-transparent text-white text-base focus:outline-none placeholder:text-neutral-400"
        />
        <button
          onClick={onRemove}
          className="p-1 hover:bg-neutral-700 rounded transition-colors"
        >
          <X className="w-5 h-5 text-neutral-400" />
        </button>
      </div>
    </div>
  )
}
