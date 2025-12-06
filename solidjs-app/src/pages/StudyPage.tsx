import { type Component, Show, For, createMemo } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useAuth } from '@/contexts/AuthContext'
import { useStudyCards } from '@/hooks/useStudyCards'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SongItem } from '@/components/song/SongItem'
import { convertGroveUri } from '@/lib/lens/utils'

/**
 * Skeleton for StudyPage loading state
 */
const StudyPageSkeleton: Component = () => (
  <div class="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-6">
    {/* Stats grid */}
    <div class="grid grid-cols-3 gap-4">
      <For each={[1, 2, 3]}>
        {() => (
          <div class="p-4 bg-card rounded-lg text-center space-y-2">
            <Skeleton class="h-8 w-12 mx-auto" />
            <Skeleton class="h-4 w-16 mx-auto" />
          </div>
        )}
      </For>
    </div>

    {/* Button */}
    <Skeleton class="h-12 w-full rounded-lg" />

    {/* Songs section */}
    <div class="space-y-3">
      <Skeleton class="h-4 w-24" />
      <For each={[1, 2, 3]}>
        {() => (
          <div class="flex items-center gap-3 p-3 bg-card rounded-lg">
            <Skeleton class="w-12 h-12 rounded-full" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-32" />
              <Skeleton class="h-3 w-24" />
            </div>
            <Skeleton class="h-6 w-6" />
          </div>
        )}
      </For>
    </div>
  </div>
)

/**
 * Study Landing Page
 *
 * Shows study stats and a button to start a global study session.
 * For song-specific study, users navigate from the song detail page.
 */
export const StudyPage: Component = () => {
  const navigate = useNavigate()
  const { isPKPReady, isAuthenticating, openAuthDialog } = useAuth()

  // Fetch study cards for stats (no songId = all songs)
  const studyCardsQuery = useStudyCards()

  const dueCards = createMemo(() => studyCardsQuery.data?.cards ?? [])
  const studyStats = createMemo(() => studyCardsQuery.data?.stats)

  // 3-box stats model
  const stats = createMemo(() => {
    const s = studyStats()
    const newCount = s?.new ?? 0
    const learningCount = (s?.learning ?? 0) + (s?.review ?? 0)
    const dueToday = s?.dueToday ?? s?.total ?? 0
    return { new: newCount, learning: learningCount, dueToday }
  })

  // Group cards by song
  const songsList = createMemo(() => {
    const cards = dueCards()
    const bySong: Record<string, {
      spotifyTrackId: string
      title: string
      artist: string
      artworkUrl?: string
      count: number
    }> = {}

    for (const card of cards) {
      const key = card.spotifyTrackId || 'unknown'
      if (!bySong[key]) {
        bySong[key] = {
          spotifyTrackId: key,
          title: card.title || 'Unknown Song',
          artist: card.artist || 'Unknown Artist',
          artworkUrl: card.artworkUrl ? convertGroveUri(card.artworkUrl) : undefined,
          count: 0,
        }
      }
      bySong[key].count++
    }

    return Object.values(bySong).sort((a, b) => b.count - a.count)
  })

  const hasCards = createMemo(() => dueCards().length > 0)
  const isLoading = createMemo(() => (isPKPReady() && studyCardsQuery.isLoading) || isAuthenticating())

  const handleStudyAll = () => {
    if (!isPKPReady()) {
      openAuthDialog?.()
      return
    }
    navigate('/study/session')
  }

  const handleSongClick = (spotifyTrackId: string) => {
    navigate(`/song/${spotifyTrackId}/study`)
  }

  return (
    <>
      <Show when={isLoading()}>
        <StudyPageSkeleton />
      </Show>

      <Show when={!isLoading()}>
        <div class="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-6">
          {/* 3-box Stats */}
          <div class="grid grid-cols-3 gap-4">
            <div class="p-4 bg-card rounded-lg text-center">
              <p class="text-3xl font-bold text-green-500">
                {isPKPReady() ? stats().new : 0}
              </p>
              <p class="text-base text-muted-foreground">New</p>
            </div>
            <div class="p-4 bg-card rounded-lg text-center">
              <p class="text-3xl font-bold text-blue-500">
                {isPKPReady() ? stats().learning : 0}
              </p>
              <p class="text-base text-muted-foreground">Learning</p>
            </div>
            <div class="p-4 bg-card rounded-lg text-center">
              <p class="text-3xl font-bold text-red-500">
                {isPKPReady() ? stats().dueToday : 0}
              </p>
              <p class="text-base text-muted-foreground">Due</p>
            </div>
          </div>

          {/* Study All Button */}
          <Show when={isPKPReady() && hasCards()}>
            <Button size="lg" class="w-full" onClick={handleStudyAll}>
              Study All
            </Button>
          </Show>

          {/* Sign in button (not logged in) */}
          <Show when={!isPKPReady()}>
            <Button size="lg" class="w-full" onClick={handleStudyAll}>
              Sign In to Study
            </Button>
          </Show>

          {/* All caught up (logged in, no cards) */}
          <Show when={isPKPReady() && !hasCards()}>
            <div class="p-6 bg-card rounded-lg text-center space-y-4">
              <div class="text-4xl">🎉</div>
              <h3 class="text-lg font-semibold">All caught up!</h3>
              <p class="text-base text-muted-foreground">No cards due. Great job!</p>
              <Button variant="outline" onClick={() => navigate('/search')}>
                Browse Songs
              </Button>
            </div>
          </Show>

          {/* Songs list */}
          <Show when={isPKPReady() && hasCards() && songsList().length > 0}>
            <div class="space-y-2">
                <For each={songsList()}>
                  {(song) => (
                    <SongItem
                      title={song.title}
                      artist={song.artist}
                      artworkUrl={song.artworkUrl}
                      badge={song.count}
                      onClick={() => handleSongClick(song.spotifyTrackId)}
                    />
                  )}
                </For>
            </div>
          </Show>
        </div>
      </Show>
    </>
  )
}
