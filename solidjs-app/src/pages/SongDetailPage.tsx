import { type Component, Show, createMemo, For } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { useSongClips } from '@/hooks/useSongClips'
import { useSongSlug } from '@/hooks/useSongSlug'
import { useSongLeaderboard, type LeaderboardEntry } from '@/hooks/useSongLeaderboard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Leaderboard } from '@/components/leaderboard/Leaderboard'
import { Icon } from '@/components/icons'
import { useAuth } from '@/contexts/AuthContext'
import { convertGroveUri } from '@/lib/lens/utils'
import { cn } from '@/lib/utils'

/**
 * Skeleton loading state for SongDetailPage
 */
export const SongDetailPageSkeleton: Component<{ class?: string }> = (props) => {
  return (
    <div class={cn('relative w-full h-screen bg-background flex items-center justify-center', props.class)}>
      <div class="relative w-full h-full md:max-w-4xl flex flex-col">
        {/* Header skeleton */}
        <div class="absolute top-0 left-0 right-0 z-50 pt-safe">
          <div class="flex items-center justify-between p-4">
            <Skeleton class="w-10 h-10 rounded-full" />
            <Skeleton class="w-10 h-10 rounded-full" />
          </div>
        </div>

        {/* Main content */}
        <div class="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Album Art Hero skeleton */}
          <div class="relative w-full" style={{ height: 'min(384px, 40vh)' }}>
            <Skeleton class="w-full h-full" />
            <div
              class="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.95) 100%)'
              }}
            />
            <div class="absolute bottom-0 left-0 right-0 p-6">
              <div class="flex items-center gap-3">
                <div class="flex-1 min-w-0 space-y-2">
                  <Skeleton class="h-8 w-48 md:h-10 md:w-64 rounded-lg" />
                  <Skeleton class="h-6 w-32 md:h-7 md:w-40 rounded-lg" />
                </div>
                <Skeleton class="w-14 h-14 rounded-full flex-shrink-0" />
              </div>
            </div>
          </div>

          <div class="px-4 mt-4 space-y-4 pb-8">
            {/* Leaderboard skeleton */}
            <div class="w-full">
              {/* Title skeleton */}
              <div class="flex items-center gap-2 mb-4">
                <Skeleton class="w-6 h-6 rounded" />
                <Skeleton class="w-24 h-6 rounded-lg" />
              </div>

              {/* Leaderboard skeleton entries - matches actual leaderboard layout */}
              <div class="space-y-2">
                <For each={[1, 2, 3, 4, 5]}>
                  {() => (
                    <div class="flex items-center gap-4 px-5 py-4 rounded-2xl bg-muted/30">
                      <Skeleton class="w-10 h-6 rounded-lg" />
                      <Skeleton class="w-12 h-12 rounded-full" />
                      <Skeleton class="flex-1 h-5 rounded-lg" />
                      <Skeleton class="w-16 h-5 rounded-lg" />
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>

        {/* Footer skeleton */}
        <div class="flex-shrink-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4">
          <div class="flex gap-3">
            <Skeleton class="flex-1 h-12 rounded-lg" />
            <Skeleton class="flex-1 h-12 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Song Detail Page - Shows song info with Play/Study/Karaoke buttons (SolidJS)
 *
 * Routes:
 * - /song/:spotifyTrackId (legacy)
 * - /:artistSlug/:songSlug (primary)
 */
export const SongDetailPage: Component = () => {
  const params = useParams<{ spotifyTrackId?: string; artistSlug?: string; songSlug?: string }>()
  const navigate = useNavigate()
  const auth = useAuth()

  // Resolve slug to Spotify track ID if using slug-based route
  const slugData = useSongSlug(
    () => params.artistSlug,
    () => params.songSlug
  )

  // Determine spotifyTrackId: direct param or resolved from slug
  const spotifyTrackId = createMemo(() => params.spotifyTrackId || slugData.data?.spotifyTrackId)

  // Fetch clips with metadata
  const workData = useSongClips(spotifyTrackId)

  // Fetch leaderboard data
  const { leaderboard: leaderboardData, isLoading: isLoadingLeaderboard } = useSongLeaderboard(spotifyTrackId)

  // Get first clip from work
  const firstClip = createMemo(() => workData.data?.clips?.[0])

  // Extract metadata
  const metadata = createMemo(() => firstClip()?.metadata)
  const songTitle = createMemo(() => metadata()?.title || params.songSlug?.replace(/-/g, ' ') || 'Unknown')
  const artist = createMemo(() => metadata()?.artist || params.artistSlug?.replace(/-/g, ' ') || 'Unknown')
  const artworkUrl = createMemo(() => {
    const cover = metadata()?.coverUri
    return cover ? convertGroveUri(cover) : undefined
  })

  // Loading state
  const isLoading = createMemo(() => slugData.isLoading || workData.isLoading)

  // Base path for navigation
  const basePath = createMemo(() => {
    if (params.artistSlug && params.songSlug) {
      return `/${params.artistSlug}/${params.songSlug}`
    }
    return `/song/${params.spotifyTrackId}`
  })

  // Song links (Spotify)
  const songLinks = createMemo(() => {
    const links: Array<{ label: string; url: string }> = []
    const trackId = spotifyTrackId()
    if (trackId) {
      links.push({
        label: 'Spotify',
        url: `https://open.spotify.com/track/${trackId}`,
      })
    }
    return links
  })

  // Transform leaderboard for Leaderboard component
  const currentUserAddress = createMemo(() => auth.pkpAddress()?.toLowerCase())
  const leaderboardEntries = createMemo(() => {
    return leaderboardData().map((entry: LeaderboardEntry) => ({
      rank: entry.rank,
      username: entry.username,
      score: entry.totalPoints,
      isCurrentUser: currentUserAddress() ? entry.address === currentUserAddress() : false,
    }))
  })

  // Handlers
  const handleBack = () => navigate(-1)
  const handlePlay = () => navigate(`${basePath()}/play`)
  const handleStudy = () => navigate(`${basePath()}/study`)
  const handleKaraoke = () => navigate(`${basePath()}/karaoke`)
  const handleArtistClick = () => {
    if (params.artistSlug) {
      navigate(`/${params.artistSlug}`)
    }
  }
  const handleUserClick = (entry: { username: string; handle?: string }) => {
    // Navigate to user profile - prefer handle if available, otherwise use username
    const profileHandle = entry.handle || entry.username
    if (profileHandle) {
      navigate(`/u/${profileHandle}`)
    }
  }

  return (
    <>
      {/* Loading */}
      <Show when={isLoading()}>
        <SongDetailPageSkeleton />
      </Show>

      {/* Error: Slug not found */}
      <Show when={!isLoading() && !spotifyTrackId()}>
        <div class="flex flex-col items-center justify-center h-screen gap-4 px-4">
          <h1 class="text-xl sm:text-2xl font-bold text-center">Song not found</h1>
          <p class="text-muted-foreground text-center">
            {params.artistSlug && params.songSlug
              ? `No song found for "${params.artistSlug}/${params.songSlug}"`
              : 'Invalid song URL'}
          </p>
          <button onClick={() => navigate('/')} class="text-primary hover:underline">
            Go home
          </button>
        </div>
      </Show>

      {/* Error: No clips */}
      <Show when={!isLoading() && spotifyTrackId() && !workData.data}>
        <div class="flex flex-col items-center justify-center h-screen gap-4 px-4">
          <h1 class="text-xl sm:text-2xl font-bold text-center">Content not available</h1>
          <p class="text-muted-foreground text-center">
            No karaoke content found for this song yet.
          </p>
          <button onClick={() => navigate('/')} class="text-primary hover:underline">
            Go home
          </button>
        </div>
      </Show>

      {/* Song Page */}
      <Show when={!isLoading() && workData.data}>
        <div class="relative w-full h-screen bg-background flex items-center justify-center">
          <div class="relative w-full h-full md:max-w-4xl flex flex-col">
            {/* Header */}
            <div class="absolute top-0 left-0 right-0 z-50 pt-safe">
              <div class="flex items-center justify-between p-4">
                {/* Back button */}
                <button
                  onClick={handleBack}
                  class="w-10 h-10 rounded-full flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                >
                  <Icon name="caret-left" class="text-2xl text-white" />
                </button>
                {/* More options (external links) */}
                <Show when={songLinks().length > 0}>
                  <a
                    href={songLinks()[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="w-10 h-10 rounded-full flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                  >
                    <Icon name="link" class="text-2xl text-white" />
                  </a>
                </Show>
              </div>
            </div>

            {/* Main content */}
            <div class="flex-1 overflow-y-auto overflow-x-hidden">
              {/* Album Art Hero */}
              <div class="relative w-full" style={{ height: 'min(384px, 40vh)' }}>
                <Show when={artworkUrl()}>
                  <img
                    src={artworkUrl()}
                    alt={songTitle()}
                    class="w-full h-full object-cover"
                  />
                </Show>
                <div
                  class="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.95) 100%)'
                  }}
                />
                <div class="absolute bottom-0 left-0 right-0 p-6">
                  <div class="flex items-center gap-3">
                    <div class="flex-1 min-w-0">
                      <h1 class="text-foreground text-2xl md:text-4xl font-bold mb-1">
                        {songTitle()}
                      </h1>
                      <Show
                        when={params.artistSlug}
                        fallback={
                          <p class="text-muted-foreground text-xl md:text-2xl font-semibold">
                            {artist()}
                          </p>
                        }
                      >
                        <button
                          onClick={handleArtistClick}
                          class="text-muted-foreground text-xl md:text-2xl font-semibold hover:text-foreground transition-colors cursor-pointer text-left"
                        >
                          {artist()}
                        </button>
                      </Show>
                    </div>
                    {/* Play button */}
                    <button
                      onClick={handlePlay}
                      class="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer bg-primary hover:opacity-90"
                    >
                      <Icon name="play" weight="fill" class="text-3xl text-foreground" />
                    </button>
                  </div>
                </div>
              </div>

              <div class="px-4 mt-4 space-y-4 pb-8">
                <Leaderboard
                  entries={leaderboardEntries()}
                  isLoading={isLoadingLeaderboard()}
                  onUserClick={handleUserClick}
                />
              </div>
            </div>

            {/* Sticky Footer with Study and Karaoke buttons */}
            <div class="flex-shrink-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4">
              <div class="flex gap-3">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleStudy}
                  class="flex-1"
                >
                  Study
                </Button>
                <Button
                  size="lg"
                  variant="default"
                  onClick={handleKaraoke}
                  class="flex-1"
                >
                  Karaoke
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </>
  )
}
