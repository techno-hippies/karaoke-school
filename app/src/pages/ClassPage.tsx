import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useStudyCards } from '@/hooks/useStudyCards'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { SongItem } from '@/components/ui/SongItem'
import { ItemGroup } from '@/components/ui/item'
import { ArrowUpRight, BookOpen } from '@phosphor-icons/react'

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
export function ClassPage({ onConnectWallet }: { onConnectWallet?: () => void }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isPKPReady } = useAuth()

  const songId = searchParams.get('song') // Optional: filter to specific song

  // Load study cards for this song
  const studyCardsQuery = useStudyCards(songId || undefined)
  const { data, isLoading } = studyCardsQuery
  const dueCards = data?.cards || []
  const studyStats = data?.stats

  // Simple 3-box model
  const stats = {
    new: studyStats?.new || 0, // Never touched (green = seed/plant)
    learning: (studyStats?.learning || 0) + (studyStats?.review || 0), // In progress (blue = water)
    due: studyStats?.total || 0, // Ready to study now (red = urgency)
  }

  // Group cards by song for display
  const cardsBySong = dueCards.reduce((acc, card) => {
    const key = card.grc20WorkId || 'unknown'
    if (!acc[key]) {
      acc[key] = {
        grc20WorkId: key,
        spotifyTrackId: card.spotifyTrackId,
        title: card.title || 'Unknown Song',
        artist: card.artist || 'Unknown Artist',
        artworkUrl: card.artworkUrl,
        cards: []
      }
    }
    acc[key].cards.push(card)
    return acc
  }, {} as Record<string, { grc20WorkId: string; spotifyTrackId?: string; title: string; artist: string; artworkUrl?: string; cards: typeof dueCards }>)

  const songsList = Object.values(cardsBySong).sort((a, b) => b.cards.length - a.cards.length)

  // Auth check - show preview of study page with zero stats
  if (!isPKPReady) {
    return (
      <div className="min-h-screen bg-background pt-6 pb-20 px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Statistics Grid - 3 Box Model (Preview with zeros) */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'New', count: 0, color: 'text-green-500', tooltip: 'Never studied 🌱' },
              { label: 'Learning', count: 0, color: 'text-blue-500', tooltip: 'In progress 💧' },
              { label: 'Due', count: 0, color: 'text-red-500', tooltip: 'Study now ⚡' },
            ].map((stat) => (
              <Card key={stat.label} className="p-4 text-center space-y-2">
                <div className={`text-2xl sm:text-3xl font-bold ${stat.color}`}>{stat.count}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
              </Card>
            ))}
          </div>

          {/* Disabled Study Button */}
          <Button
            size="lg"
            disabled
            className="w-full h-12 text-base"
          >
            Study
          </Button>

          {/* Sign Up Call-to-Action */}
          <Card className="p-8 text-center space-y-4 bg-muted">
            <h2 className="text-2xl font-bold">Sign Up</h2>
            <p className="text-muted-foreground">Karaoke to your favorite songs for free!</p>
            <Button onClick={onConnectWallet || (() => navigate('/'))}>
              Sign Up
            </Button>
          </Card>
        </div>
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
  // const progressPercent = hasCards ? Math.min(100, Math.round((5 / 20) * 100)) : 0

  return (
    <div className="min-h-screen bg-background pt-6 pb-20 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Daily Goal Progress - Commented out for future implementation */}
        {/* <Card className="p-6 space-y-4">
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
        </Card> */}

        {/* Statistics Grid - 3 Box Model */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'New', count: stats.new, color: 'text-green-500', tooltip: 'Never studied 🌱' },
            { label: 'Learning', count: stats.learning, color: 'text-blue-500', tooltip: 'In progress 💧' },
            { label: 'Due', count: stats.due, color: 'text-red-500', tooltip: 'Study now ⚡' },
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
            Study
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

        {/* Songs Due */}
        {hasCards && songsList.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">Songs ({songsList.length})</h3>
            <ItemGroup className="gap-2">
              {songsList.map((song) => (
                <SongItem
                  key={song.grc20WorkId}
                  title={song.title}
                  artist={song.artist}
                  artworkUrl={song.artworkUrl}
                  badge={song.cards.length}
                  onClick={() => navigate(`/song/${song.grc20WorkId}/study`)}
                />
              ))}
            </ItemGroup>
          </div>
        )}
      </div>
    </div>
  )
}
