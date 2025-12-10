import { type Component, createMemo } from 'solid-js'
import { useLocation, useNavigate, useSearchParams } from '@solidjs/router'
import { ForYouFeed } from '@/components/feed'

/**
 * FeedPage - TikTok-style video feed page
 *
 * Shows karaoke posts from the global Lens feed.
 * Supports vertical scrolling, keyboard navigation, and infinite scroll.
 *
 * When accessed via /u/:username/video/:id, shows single video mode without mobile footer.
 */
export const FeedPage: Component = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Detect single video mode (no mobile footer when viewing a specific video)
  const isSingleVideoMode = createMemo(() => {
    return !!location.pathname.match(/^\/u\/[^/]+\/video\//)
  })

  // Handle back navigation - go to song page if from=song, otherwise go home
  const handleBack = () => {
    const fromSong = searchParams.song
    if (fromSong) {
      navigate(`/${fromSong}`)
    } else {
      navigate('/')
    }
  }

  return (
    <ForYouFeed
      hasMobileFooter={!isSingleVideoMode()}
      showBackButton={isSingleVideoMode()}
      onBack={handleBack}
    />
  )
}
