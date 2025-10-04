import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface CommentInputProps {
  onSubmit?: (comment: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * CommentInput - Text input for posting comments
 * Textarea with full-width Post button below
 */
export function CommentInput({
  onSubmit,
  placeholder = 'Add a comment...',
  disabled = false,
  className
}: CommentInputProps) {
  const [comment, setComment] = useState('')

  const handleSubmit = () => {
    if (comment.trim()) {
      onSubmit?.(comment)
      setComment('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={cn('p-4 border-t border-border bg-card', className)}>
      <div className="space-y-3">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-3 border border-input bg-background text-foreground text-base rounded-lg resize-none focus:outline-none focus:border-ring placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          rows={3}
          onKeyPress={handleKeyPress}
        />
        <Button
          onClick={handleSubmit}
          disabled={disabled || !comment.trim()}
          variant="default"
          className="w-full px-6 py-3"
        >
          Post
        </Button>
      </div>
    </div>
  )
}
