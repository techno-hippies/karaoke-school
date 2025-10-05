import { cn } from '@/lib/utils'

export interface FormFieldProps {
  label: string
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  maxLength?: number
  multiline?: boolean
  rows?: number
  disabled?: boolean
  readOnly?: boolean
  onTap?: () => void
  showCharCount?: boolean
  className?: string
}

/**
 * FormField - Labeled input field for forms
 * Supports single-line input and multiline textarea
 * Optional character counter for textarea
 */
export function FormField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  multiline = false,
  rows = 3,
  disabled = false,
  readOnly = false,
  onTap,
  showCharCount = false,
  className
}: FormFieldProps) {
  const handleClick = () => {
    if (readOnly && onTap) {
      onTap()
    }
  }

  const inputClassName = cn(
    'w-full px-3 py-2 bg-background text-foreground text-base rounded-md border border-input',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'placeholder:text-muted-foreground',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    readOnly && 'cursor-pointer'
  )

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <label className="block text-foreground text-base font-medium">
        {label}
      </label>

      {/* Input or Textarea */}
      {multiline ? (
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={rows}
            disabled={disabled}
            readOnly={readOnly}
            onClick={handleClick}
            className={cn(inputClassName, 'resize-none')}
          />
          {showCharCount && maxLength && (
            <div className="text-right text-muted-foreground text-base mt-1">
              {value.length}/{maxLength}
            </div>
          )}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          readOnly={readOnly}
          onClick={handleClick}
          className={inputClassName}
        />
      )}
    </div>
  )
}
