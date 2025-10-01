import { cn } from '@/lib/utils'

// Mock translation function for now
const useTranslation = () => {
  const t = (key: string, fallback?: string) => {
    const translations: Record<string, string> = {
      'home.yourFlashcards': 'Your Flashcards',
      'home.study.new': 'New',
      'home.study.learning': 'Learning',
      'home.study.due': 'Due',
      'home.study.singKaraokeToAdd': 'Sing karaoke to add cards',
      'home.study.allCaughtUp': 'All caught up!',
      'song.studyNow': 'Study'
    }
    return translations[key] || fallback || key
  }
  return { t }
}

interface StudyStatsProps {
  newCount: number
  learningCount: number
  dueCount: number
  onStudy?: () => void
  showButton?: boolean
  showTitle?: boolean
}

export function StudyStats({
  newCount,
  learningCount,
  dueCount,
  onStudy,
  showButton = false,
  showTitle = false
}: StudyStatsProps) {
  const { t } = useTranslation()
  const hasNoCards = newCount === 0 && learningCount === 0 && dueCount === 0
  // In Anki, you can only study NEW cards or cards that are due
  // Learning cards that aren't due yet cannot be studied
  const canStudy = newCount > 0 || dueCount > 0

  return (
    <div className="w-full">
      {/* Title */}
      {showTitle && (
        <h2 className="text-lg font-semibold text-white mb-3">
          {t('home.yourFlashcards')}
        </h2>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4">
        <div className="bg-neutral-900 rounded-lg p-3 md:p-4 text-center border border-neutral-800">
          <div className={cn(
            "text-xl md:text-2xl font-bold",
            newCount > 0 ? 'text-green-400' : 'text-white'
          )}>
            {newCount}
          </div>
          <div className="text-neutral-400 text-xs md:text-sm font-medium mt-1">
            {t('home.study.new')}
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg p-3 md:p-4 text-center border border-neutral-800">
          <div className={cn(
            "text-xl md:text-2xl font-bold",
            learningCount > 0 ? 'text-blue-400' : 'text-white'
          )}>
            {learningCount}
          </div>
          <div className="text-neutral-400 text-xs md:text-sm font-medium mt-1">
            {t('home.study.learning')}
          </div>
        </div>

        <div className="bg-neutral-900 rounded-lg p-3 md:p-4 text-center border border-neutral-800">
          <div className={cn(
            "text-xl md:text-2xl font-bold",
            dueCount > 0 ? 'text-red-400' : 'text-white'
          )}>
            {dueCount}
          </div>
          <div className="text-neutral-400 text-xs md:text-sm font-medium mt-1">
            {t('home.study.due')}
          </div>
        </div>
      </div>

      {/* Study button - only show if showButton is true and onStudy is provided */}
      {showButton && onStudy && (
        <button
          onClick={onStudy}
          disabled={hasNoCards || !canStudy}
          className={cn(
            "w-full px-4 md:px-6 py-3 rounded-lg font-semibold transition-colors text-sm md:text-base",
            hasNoCards || !canStudy
              ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
          )}
        >
          {hasNoCards ? t('home.study.singKaraokeToAdd') :
           !canStudy ? t('home.study.allCaughtUp') :
           t('song.studyNow')}
        </button>
      )}
    </div>
  )
}