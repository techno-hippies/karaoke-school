import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useStudyCards } from '@/hooks/useStudyCards'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SongItem } from '@/components/ui/SongItem'
import { ItemGroup } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'

function ClassPageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background pt-6 pb-20 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={`stat-skeleton-${index}`} className="p-4 text-center space-y-3">
              <Skeleton className="mx-auto h-10 w-16" />
              <Skeleton className="mx-auto h-4 w-24" />
            </Card>
          ))}
        </div>

        <Skeleton className="h-12 w-full rounded-lg" />

        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`song-skeleton-${index}`}
                className="flex items-center justify-between rounded-xl bg-muted p-4"
              >
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isPKPReady, isAuthenticating } = useAuth()

  const songId = searchParams.get('song') // Optional: filter to specific song

  // Load study cards for this song
  const studyCardsQuery = useStudyCards(songId || undefined)
  const { data, isLoading, isInitialLoading } = studyCardsQuery
  const [hasHydratedData, setHasHydratedData] = useState(false)
  const dueCards = useMemo(() => data?.cards ?? [], [data?.cards])
  const studyStats = data?.stats

  // Simple 3-box model
  const stats = useMemo(() => {
    const newCount = studyStats?.new || 0
    const learningCount = (studyStats?.learning || 0) + (studyStats?.review || 0)
    const dueToday = studyStats?.dueToday ?? studyStats?.total ?? 0
    const totalCount = studyStats?.total || 0

    return {
      new: newCount, // Never touched (green = seed/plant)
      learning: learningCount, // In progress (blue = water)
      dueToday, // Ready to study now (after daily limits)
      total: totalCount, // Total cards outstanding (before limits)
    }
  }, [studyStats])

  const hasCards = dueCards.length > 0
  const studyButtonLabel = songId ? t('study.studySong') : t('study.studyAllDue')

  const handleStudyClick = () => {
    if (songId) {
      navigate(`/song/${songId}/study`)
    } else {
      navigate('/study/session')
    }
  }

  // Group cards by song for display
  const cardsBySong = dueCards.reduce((acc, card) => {
    const key = card.grc20WorkId || 'unknown'
    if (!acc[key]) {
      acc[key] = {
        grc20WorkId: key,
        spotifyTrackId: card.spotifyTrackId,
        title: card.title || t('study.unknownSong'),
        artist: card.artist || t('study.unknownArtist'),
        artworkUrl: card.artworkUrl,
        cards: []
      }
    }
    acc[key].cards.push(card)
    return acc
  }, {} as Record<string, { grc20WorkId: string; spotifyTrackId?: string; title: string; artist: string; artworkUrl?: string; cards: typeof dueCards }>)

  const songsList = Object.values(cardsBySong).sort((a, b) => b.cards.length - a.cards.length)

  const dueCardsSample = useMemo(() => dueCards.slice(0, 3).map((card) => ({
    lineId: card.lineId,
    grc20WorkId: card.grc20WorkId,
    state: card.fsrs.state,
  })), [dueCards])

  useEffect(() => {
    if (!data || isInitialLoading) return

    const rawStats = {
      new: studyStats?.new ?? 0,
      learning: studyStats?.learning ?? 0,
      review: studyStats?.review ?? 0,
      total: studyStats?.total ?? 0,
    }

    const mismatch = stats.dueToday > 0 && dueCards.length === 0

    console.info('[ClassPage] Study stats snapshot', {
      rawStats,
      computedStats: stats,
      dueCardsCount: dueCards.length,
      hasCards,
      sampleCards: dueCardsSample,
    })

    if (mismatch) {
      console.warn('[ClassPage] Stats show due cards but queue is empty', {
        rawStats,
        computedStats: stats,
        dueCardsCount: dueCards.length,
      })
    }
  }, [
    data,
    studyStats,
    stats,
    stats.new,
    stats.learning,
    stats.dueToday,
    stats.total,
    dueCards.length,
    hasCards,
    dueCardsSample,
    isInitialLoading,
  ])

  useEffect(() => setHasHydratedData(false), [songId])

  useEffect(() => {
    if (!isPKPReady) {
      setHasHydratedData(false)
    }
  }, [isPKPReady])

  useEffect(() => {
    if (!isInitialLoading && data) {
      setHasHydratedData(true)
    }
  }, [isInitialLoading, data])

  const showLoadingSkeleton =
    !hasHydratedData && (isInitialLoading || isLoading || isAuthenticating)

  if (showLoadingSkeleton) {
    return <ClassPageLoadingSkeleton />
  }

  // Auth check - show preview of study page with zero stats
  if (!isPKPReady) {
    return (
      <div className="min-h-screen bg-background pt-6 pb-20 px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Statistics Grid - 3 Box Model (Preview with zeros) */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: t('study.new'), count: 0, color: 'text-green-500' },
              { label: t('study.learning'), count: 0, color: 'text-blue-500' },
              { label: t('study.dueToday'), count: 0, color: 'text-red-500' },
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
            {t('study.studyButton')}
          </Button>

          {/* Sign Up Call-to-Action */}
          <Card className="p-8 text-center space-y-4 bg-muted">
            <h2 className="text-2xl font-bold">{t('study.signUp')}</h2>
            <p className="text-muted-foreground">{t('study.signUpDescription')}</p>
            <Button onClick={onConnectWallet || (() => navigate('/'))}>
              {t('study.signUp')}
            </Button>
          </Card>
        </div>
      </div>
    )
  }

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
            { label: t('study.new'), count: stats.new, color: 'text-green-500' },
            { label: t('study.learning'), count: stats.learning, color: 'text-blue-500' },
            { label: t('study.dueToday'), count: stats.dueToday, color: 'text-red-500' },
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
            onClick={handleStudyClick}
            className="w-full h-12 text-base"
          >
            {studyButtonLabel}
          </Button>
        ) : (
          <Card className="p-8 text-center space-y-4 bg-muted">
            <div className="text-4xl">🎉</div>
            <h3 className="text-lg font-semibold">{t('study.allCaughtUp')}</h3>
            <p className="text-muted-foreground">{t('study.noCardsDueToday')}</p>
            <Button variant="outline" onClick={() => navigate('/')}>
              {t('study.browseSongs')}
            </Button>
          </Card>
        )}

        {/* Songs Due */}
        {hasCards && songsList.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">{t('study.songsCount', { count: songsList.length })}</h3>
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
