import type { Meta, StoryObj } from 'storybook-solidjs'
import { createSignal } from 'solid-js'
import { VideoPost } from './VideoPost'
import type { VideoPostData } from './types'

const meta: Meta<typeof VideoPost> = {
  title: 'Feed/VideoPost',
  component: VideoPost,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
}

export default meta
type Story = StoryObj<typeof VideoPost>

// Sample data
const SAMPLE_VIDEO = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
const SAMPLE_THUMBNAIL = 'https://picsum.photos/seed/video1/360/640'
const SAMPLE_AVATAR = 'https://picsum.photos/seed/user1/100/100'
const SAMPLE_MUSIC_IMAGE = 'https://picsum.photos/seed/album1/100/100'

const basePost: VideoPostData = {
  id: 'post-1',
  videoUrl: SAMPLE_VIDEO,
  thumbnailUrl: SAMPLE_THUMBNAIL,
  username: 'scarlett',
  userAvatar: SAMPLE_AVATAR,
  musicTitle: 'Toxic',
  musicAuthor: 'Britney Spears',
  musicImageUrl: SAMPLE_MUSIC_IMAGE,
  artistSlug: 'britney-spears',
  songSlug: 'toxic',
  spotifyTrackId: '6I9VzXrHxO9rA9A5euc8Ak',
  likes: 1234,
  shares: 56,
  description: 'Learning this classic! 🎤',
  isLiked: false,
  isFollowing: false,
  canInteract: true,
}

/**
 * Interactive wrapper with state management
 */
function InteractivePost(props: { post: VideoPostData; autoplay?: boolean }) {
  const [isLiked, setIsLiked] = createSignal(props.post.isLiked ?? false)
  const [isFollowing, setIsFollowing] = createSignal(props.post.isFollowing ?? false)
  const [isFollowLoading, setIsFollowLoading] = createSignal(false)
  const [likes, setLikes] = createSignal(props.post.likes)

  const handleLike = () => {
    const newLiked = !isLiked()
    setIsLiked(newLiked)
    setLikes(l => newLiked ? l + 1 : l - 1)
  }

  const handleFollow = async () => {
    setIsFollowLoading(true)
    await new Promise(r => setTimeout(r, 500))
    setIsFollowing(!isFollowing())
    setIsFollowLoading(false)
  }

  return (
    <VideoPost
      {...props.post}
      likes={likes()}
      isLiked={isLiked()}
      isFollowing={isFollowing()}
      isFollowLoading={isFollowLoading()}
      onLikeClick={handleLike}
      onFollowClick={handleFollow}
      onProfileClick={() => console.log('Profile clicked')}
      onShareClick={() => console.log('Share clicked')}
      onAudioClick={() => console.log('Audio clicked')}
      autoplay={props.autoplay}
    />
  )
}

/**
 * Default post with all features
 */
export const Default: Story = {
  render: () => <InteractivePost post={basePost} />,
}

/**
 * Post with autoplay enabled
 */
export const Autoplay: Story = {
  render: () => <InteractivePost post={basePost} autoplay={true} />,
}

/**
 * Already liked and following
 */
export const LikedAndFollowing: Story = {
  render: () => (
    <InteractivePost
      post={{
        ...basePost,
        isLiked: true,
        isFollowing: true,
        likes: 1235,
      }}
    />
  ),
}

/**
 * Without avatar (shows initial)
 */
export const NoAvatar: Story = {
  render: () => (
    <InteractivePost
      post={{
        ...basePost,
        userAvatar: undefined,
      }}
    />
  ),
}

/**
 * Without music info
 */
export const NoMusicInfo: Story = {
  render: () => (
    <InteractivePost
      post={{
        ...basePost,
        musicTitle: undefined,
        musicAuthor: undefined,
        musicImageUrl: undefined,
        artistSlug: undefined,
        songSlug: undefined,
      }}
    />
  ),
}

/**
 * Long description
 */
export const LongDescription: Story = {
  render: () => (
    <InteractivePost
      post={{
        ...basePost,
        description: 'This is a really long description that should be truncated after two lines. It contains a lot of text to demonstrate how the component handles overflow and text clamping in the video overlay.',
      }}
    />
  ),
}

/**
 * Thumbnail only (no video)
 */
export const ThumbnailOnly: Story = {
  render: () => (
    <InteractivePost
      post={{
        ...basePost,
        videoUrl: undefined,
      }}
    />
  ),
}

/**
 * High engagement post
 */
export const HighEngagement: Story = {
  render: () => (
    <InteractivePost
      post={{
        ...basePost,
        likes: 123456,
        shares: 7890,
      }}
    />
  ),
}

/**
 * Cannot interact (not logged in or own post)
 */
export const CannotInteract: Story = {
  render: () => (
    <InteractivePost
      post={{
        ...basePost,
        canInteract: false,
      }}
    />
  ),
}
