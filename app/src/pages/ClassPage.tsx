import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useStudyCards } from '@/hooks/useStudyCards'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { BookOpen, Play, ArrowUpRight } from '@phosphor-icons/react'

/**
 * Study Dashboard (ClassPage)
 *
 * Routes: /study?song=:workId (optional song filter)
 *
 * Shows:
 * - Queue of due cards for the day
 * - Statistics (new/learning/review counts)
 * - Start study session button
 * - Progress toward daily goal
 */
export function ClassPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isPKPReady, pkpAddress } = useAuth()

  const songId = searchParams.get('song') // Optional: filter to specific song

  // Load study cards for this song
  const { data: dueCards = [], isLoading, error } = useStudyCards(songId || undefined)

  // Calculate statistics from due cards
  const stats = {
    new: dueCards.filter(c => c.fsrs.state === 0).length,
    learning: dueCards.filter(c => c.fsrs.state === 1).length,
    review: dueCards.filter(c => c.fsrs.state === 2).length,
    due: dueCards.length,
  }

  // Auth check
  if (!isPKPReady) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
        <h1 className="text-2xl font-bold">Connect Wallet to Study</h1>
        <p className="text-muted-foreground">You need to create a passkey to track your learning progress.</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  const hasCards = dueCards.length > 0
  const progressPercent = hasCards ? Math.min(100, Math.round((5 / 20) * 100)) : 0

  return (
    <div className="min-h-screen bg-background pt-6 pb-20 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
            <BookOpen size={32} weight="duotone" className="text-primary" />
            Study
          </h1>
          <p className="text-muted-foreground">Learn lyrics through spaced repetition</p>
        </div>

        {/* Daily Goal Progress */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ArrowUpRight size={20} className="text-green-500" />
              Today's Goal
            </h2>
            <span className="text-sm text-muted-foreground">5 of 20</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {hasCards ? 'Complete all due cards to maintain your streak' : 'No cards due today. Great job!'}
          </p>
        </Card>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'New', count: stats.new, color: 'text-blue-500' },
            { label: 'Learning', count: stats.learning, color: 'text-yellow-500' },
            { label: 'Review', count: stats.review, color: 'text-purple-500' },
            { label: 'Due Now', count: stats.due, color: 'text-red-500' },
          ].map((stat) => (
            <Card key={stat.label} className="p-4 text-center space-y-2">
              <div className={`text-2xl sm:text-3xl font-bold ${stat.color}`}>{stat.count}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Start Button */}
        {hasCards ? (
          <Button
            size="lg"
            onClick={() => navigate(`/study/session${songId ? `?song=${songId}` : ''}`)}
            className="w-full h-12 text-base"
          >
            <Play size={20} weight="fill" />
            Start Study Session
          </Button>
        ) : (
          <Card className="p-8 text-center space-y-4 bg-muted">
            <div className="text-4xl">🎉</div>
            <h3 className="text-lg font-semibold">All Caught Up!</h3>
            <p className="text-muted-foreground">No cards due today. Come back tomorrow.</p>
            <Button variant="outline" onClick={() => navigate('/')}>
              Browse Songs
            </Button>
          </Card>
        )}

        {/* Card Queue Preview */}
        {hasCards && dueCards.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">Next Cards ({dueCards.length})</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {dueCards.slice(0, 5).map((card, idx) => (
                <Card
                  key={card.id}
                  className="p-3 sm:p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{card.originalText}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {card.fsrs?.state || 'New'} • {card.fsrs?.due ? 'Due now' : 'Review'}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Footer Help Text */}
        <div className="text-center text-xs text-muted-foreground space-y-2 pt-4 border-t">
          <p>📍 Studying: {songId ? 'This song' : 'All songs'}</p>
          <p>🎯 Limit: 15 new + all due/review cards per day</p>
        </div>
      </div>
    </div>
  )
}
