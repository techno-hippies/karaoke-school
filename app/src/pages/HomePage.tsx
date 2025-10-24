import { FeedPage } from '@/components/feed/FeedPage'

/**
 * HomePage - Main feed with For You and Following tabs
 *
 * Route: /
 * Shows global karaoke feed (For You) and personalized feed (Following)
 */
export function HomePage() {
  return <FeedPage defaultTab="for-you" />
}
