import { cn } from '@/lib/utils'

export interface ScenarioCardProps {
  /** Scenario ID */
  id: string
  /** Scene title (e.g., "Beach Bar", "Default") */
  title: string
  /** Character name (e.g., "Scarlett") */
  character?: string
  /** Short description */
  description: string
  /** Scene image URL (optional - shows gradient placeholder if missing) */
  image?: string
  /** Gradient colors for placeholder [from, to] */
  gradient?: [string, string]
  /** Is this 18+ content */
  isAdult?: boolean
  /** Called when card is clicked */
  onClick?: () => void
  className?: string
}

/**
 * ScenarioCard - Display a chat scenario (default or roleplay)
 */
export function ScenarioCard({
  title,
  character,
  description,
  image,
  gradient = ['#6366f1', '#8b5cf6'],
  isAdult,
  onClick,
  className,
}: ScenarioCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-2xl border bg-card overflow-hidden transition-all cursor-pointer',
        'hover:shadow-lg hover:border-white/30',
        'focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-background',
        className
      )}
    >
      {/* Image or gradient placeholder */}
      <div className="aspect-[16/9] overflow-hidden relative">
        {image ? (
          <img src={image} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
          />
        )}
        {/* Title overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-xl font-semibold text-white">
            {title}
            {character && <span className="font-normal"> with {character}</span>}
            {isAdult && <span className="text-orange-400"> (18+)</span>}
          </h3>
        </div>
      </div>

      {/* Description */}
      <div className="p-4">
        <p className="text-base text-foreground/70 leading-relaxed">{description}</p>
      </div>
    </button>
  )
}
