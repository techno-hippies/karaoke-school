import { type Component, Show, For, createMemo } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { useArtist } from '@/hooks/useArtist'
import { useArtistLeaderboard } from '@/hooks/useArtistLeaderboard'
import { Leaderboard } from '@/components/leaderboard/Leaderboard'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Icon } from '@/components/icons'
import { buildManifest, getBestUrl } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

/**
 * Skeleton loading state for ArtistPage
 * Matches the layout to prevent content jump
 */
export const ArtistPageSkeleton: Component<{ class?: string }> = (props) => {
  return (
    <div class={cn('relative w-full h-screen bg-background flex items-center justify-center', props.class)}>
      <div class="relative w-full h-full md:max-w-4xl flex flex-col">
        {/* Header skeleton */}
        <div class="absolute top-0 left-0 right-0 z-50">
          <div class="flex items-center justify-between h-12 px-4">
            <Skeleton class="w-10 h-10 rounded-full" />
            <div class="w-10 h-10" /> {/* Spacer for hidden button */}
          </div>
        </div>

        {/* Main content */}
        <div class="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Artist Hero skeleton */}
          <div class="relative w-full" style={{ height: 'min(384px, 40vh)' }}>
            <Skeleton class="w-full h-full" />
            <div
              class="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.95) 100%)'
              }}
            />
            <div class="absolute bottom-0 left-0 right-0 p-6">
              <Skeleton class="h-8 w-48 md:h-10 md:w-64 rounded-lg" />
            </div>
          </div>

          <div class="px-4 mt-4 space-y-4 pb-8">
            {/* Tabs skeleton */}
            <div class="w-full">
              <Skeleton class="w-full h-10 rounded-lg" />

              {/* Songs list skeleton - matches song item layout */}
              <div class="mt-4 space-y-2">
                <For each={[1, 2, 3, 4, 5]}>
                  {() => (
                    <div class="flex items-center gap-4 p-3 rounded-xl">
                      <Skeleton class="w-14 h-14 rounded-lg flex-shrink-0" />
                      <Skeleton class="flex-1 h-5 rounded-lg" />
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Artist Page (SolidJS)
 *
 * Route: /:artistSlug (e.g., /queen, /eminem, /britney-spears)
 *
 * Displays artist info and their songs.
 */
export const ArtistPage: Component = () => {
  const params = useParams<{ artistSlug: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const artist = useArtist(() => params.artistSlug)

  // Extract spotify track IDs for leaderboard query
  const spotifyTrackIds = createMemo(() =>
    artist.data?.songs?.map(s => s.spotifyTrackId) ?? []
  )

  // Lazy-loaded leaderboard
  const { leaderboard, isLoading: isLoadingLeaderboard, hasLoaded, refetch: fetchLeaderboard } = useArtistLeaderboard(spotifyTrackIds)

  // Handle Rankings tab click - lazy load
  const handleRankingsTabClick = () => {
    if (!hasLoaded() && !isLoadingLeaderboard() && spotifyTrackIds().length > 0) {
      fetchLeaderboard()
    }
  }

  // Transform songs for display
  const songs = createMemo(() => {
    if (!artist.data?.songs) return []

    return artist.data.songs.map((song) => {
      let coverUrl: string | undefined
      if (song.coverUri) {
        if (song.coverUri.startsWith('https://')) {
          coverUrl = song.coverUri
        } else {
          const manifest = buildManifest(song.coverUri)
          coverUrl = getBestUrl(manifest) ?? undefined
        }
      }

      return {
        id: song.spotifyTrackId,
        title: song.title,
        coverUrl,
        artistSlug: song.artistSlug,
        songSlug: song.songSlug,
      }
    })
  })

  const handleBack = () => navigate(-1)

  const handleSongClick = (song: { artistSlug: string; songSlug: string }) => {
    navigate(`/${song.artistSlug}/${song.songSlug}`)
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
      <Show when={artist.isLoading}>
        <ArtistPageSkeleton />
      </Show>

      {/* Error / Not found */}
      <Show when={!artist.isLoading && (artist.error || !artist.data)}>
        <div class="flex flex-col items-center justify-center h-screen gap-4 px-4">
          <h1 class="text-xl sm:text-2xl font-bold text-center">Artist not found</h1>
          <p class="text-muted-foreground text-center">
            No artist found for "{params.artistSlug}"
          </p>
          <button onClick={() => navigate('/')} class="text-primary hover:underline">
            Go home
          </button>
        </div>
      </Show>

      {/* Artist Page */}
      <Show when={!artist.isLoading && artist.data}>
        <div class="relative w-full h-screen bg-background flex items-center justify-center">
          <div class="relative w-full h-full md:max-w-4xl flex flex-col">
            {/* Header */}
            <div class="absolute top-0 left-0 right-0 z-50 pt-safe">
              <div class="flex items-center justify-between p-4">
                <button
                  onClick={handleBack}
                  class="w-10 h-10 rounded-full flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                >
                  <Icon name="caret-left" class="text-2xl text-white" />
                </button>
                {/* Placeholder for symmetry */}
                <div class="w-10 h-10" />
              </div>
            </div>

            {/* Main content */}
            <div class="flex-1 overflow-y-auto overflow-x-hidden">
              {/* Artist Hero */}
              <div class="relative w-full" style={{ height: 'min(384px, 40vh)' }}>
                <Show
                  when={artist.data!.imageUrl}
                  fallback={
                    <div class="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                      <Icon name="music-note" class="text-8xl text-primary/40" />
                    </div>
                  }
                >
                  <img
                    src={artist.data!.imageUrl}
                    alt={artist.data!.name}
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
                      <h1 class="text-foreground text-2xl md:text-4xl font-bold">
                        {artist.data!.name}
                      </h1>
                    </div>
                  </div>
                </div>
              </div>

              <div class="px-4 mt-4 space-y-4 pb-8">
                {/* Tabs: Songs | Rankings */}
                <Tabs defaultValue="songs" class="w-full" onChange={(val) => val === 'rankings' && handleRankingsTabClick()}>
                  <TabsList class="w-full grid grid-cols-2 bg-muted/50">
                    <TabsTrigger value="songs">{t('nav.songs')}</TabsTrigger>
                    <TabsTrigger value="rankings">{t('leaderboard.rankings')}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="songs" class="mt-4">
                    <Show
                      when={songs().length > 0}
                      fallback={
                        <div class="text-center py-12 text-muted-foreground">
                          No songs available
                        </div>
                      }
                    >
                      <div class="space-y-2">
                        <For each={songs()}>
                          {(song) => (
                            <button
                              onClick={() => handleSongClick(song)}
                              class="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                            >
                              {/* Song Cover */}
                              <div class="w-14 h-14 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                                <Show
                                  when={song.coverUrl}
                                  fallback={
                                    <div class="w-full h-full flex items-center justify-center">
                                      <Icon name="music-note" class="text-xl text-muted-foreground" />
                                    </div>
                                  }
                                >
                                  <img
                                    src={song.coverUrl}
                                    alt={song.title}
                                    class="w-full h-full object-cover"
                                  />
                                </Show>
                              </div>

                              {/* Song Info */}
                              <div class="flex-1 min-w-0">
                                <p class="font-medium truncate">{song.title}</p>
                              </div>
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </TabsContent>

                  <TabsContent value="rankings" class="mt-4">
                    <Leaderboard
                      entries={leaderboard().map(e => ({
                        rank: e.rank,
                        username: e.username,
                        score: e.totalPoints,
                      }))}
                      isLoading={isLoadingLeaderboard()}
                      showTitle={false}
                      emptyMessage="No students yet. Be the first to practice!"
                      onUserClick={handleUserClick}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </>
  )
}
