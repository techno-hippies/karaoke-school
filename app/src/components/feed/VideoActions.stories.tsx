import type { Meta, StoryObj } from 'storybook-solidjs'
import { createSignal } from 'solid-js'
import { VideoActions } from './VideoActions'

const meta: Meta<typeof VideoActions> = {
  title: 'Feed/VideoActions',
  component: VideoActions,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div class="p-8 bg-black/80 rounded-lg">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof VideoActions>

const SAMPLE_AVATAR = 'https://picsum.photos/seed/user1/100/100'
const SAMPLE_MUSIC_IMAGE = 'https://picsum.photos/seed/album1/100/100'

/**
 * Interactive wrapper with state
 */
function InteractiveActions(props: {
  hasAvatar?: boolean
  hasMusicImage?: boolean
  canStudy?: boolean
  initialLiked?: boolean
  initialMuted?: boolean
}) {
  const [isLiked, setIsLiked] = createSignal(props.initialLiked ?? false)
  const [isMuted, setIsMuted] = createSignal(props.initialMuted ?? true)

  return (
    <VideoActions
      username="scarlett"
      userAvatar={props.hasAvatar ? SAMPLE_AVATAR : undefined}
      onProfileClick={() => console.log('Profile clicked')}
      isLiked={isLiked()}
      onLikeClick={() => setIsLiked(!isLiked())}
      onShareClick={() => console.log('Share clicked')}
      canStudy={props.canStudy}
      onStudyClick={() => console.log('Study clicked')}
      musicTitle="Toxic"
      musicAuthor="Britney Spears"
      musicImageUrl={props.hasMusicImage ? SAMPLE_MUSIC_IMAGE : undefined}
      onAudioClick={() => console.log('Audio clicked')}
      isMuted={isMuted()}
      onToggleMute={() => setIsMuted(!isMuted())}
    />
  )
}

/**
 * Default state with all features
 */
export const Default: Story = {
  render: () => (
    <InteractiveActions
      hasAvatar={true}
      hasMusicImage={true}
      canStudy={true}
    />
  ),
}

/**
 * Without avatar (shows initial)
 */
export const NoAvatar: Story = {
  render: () => (
    <InteractiveActions
      hasAvatar={false}
      hasMusicImage={true}
      canStudy={true}
    />
  ),
}

/**
 * Already liked
 */
export const Liked: Story = {
  render: () => (
    <InteractiveActions
      hasAvatar={true}
      hasMusicImage={true}
      canStudy={true}
      initialLiked={true}
    />
  ),
}

/**
 * Without study button (no song data)
 */
export const NoStudy: Story = {
  render: () => (
    <InteractiveActions
      hasAvatar={true}
      hasMusicImage={true}
      canStudy={false}
    />
  ),
}

/**
 * Without music image (shows icon)
 */
export const NoMusicImage: Story = {
  render: () => (
    <InteractiveActions
      hasAvatar={true}
      hasMusicImage={false}
      canStudy={true}
    />
  ),
}

/**
 * Unmuted state
 */
export const Unmuted: Story = {
  render: () => (
    <InteractiveActions
      hasAvatar={true}
      hasMusicImage={true}
      canStudy={true}
      initialMuted={false}
    />
  ),
}

/**
 * Minimal - just mute, avatar, like, share
 */
export const Minimal: Story = {
  render: () => {
    const [isLiked, setIsLiked] = createSignal(false)
    const [isMuted, setIsMuted] = createSignal(true)

    return (
      <VideoActions
        username="user"
        userAvatar={undefined}
        onProfileClick={() => console.log('Profile')}
        isLiked={isLiked()}
        onLikeClick={() => setIsLiked(!isLiked())}
        onShareClick={() => console.log('Share')}
        isMuted={isMuted()}
        onToggleMute={() => setIsMuted(!isMuted())}
      />
    )
  },
}
