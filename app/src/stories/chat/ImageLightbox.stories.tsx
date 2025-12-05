import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ImageLightbox } from '@/components/chat/ImageLightbox'

const SAMPLE_IMAGES = {
  landscape: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1024&h=768&fit=crop',
  portrait: 'https://images.unsplash.com/photo-1516541196182-6bdb0516ed27?w=768&h=1024&fit=crop',
  square: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=512&h=512&fit=crop',
}

const meta = {
  title: 'Chat/ImageLightbox',
  component: ImageLightbox,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ImageLightbox>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default lightbox with landscape image
 */
export const Default: Story = {
  args: {
    imageUrl: SAMPLE_IMAGES.landscape,
    alt: 'Beautiful landscape',
    onClose: () => console.log('Close clicked'),
  },
}

/**
 * Lightbox with portrait image
 */
export const PortraitImage: Story = {
  args: {
    imageUrl: SAMPLE_IMAGES.portrait,
    alt: 'Portrait image',
    onClose: () => console.log('Close clicked'),
  },
}

/**
 * Lightbox with square image
 */
export const SquareImage: Story = {
  args: {
    imageUrl: SAMPLE_IMAGES.square,
    alt: 'Square image',
    onClose: () => console.log('Close clicked'),
  },
}

/**
 * Lightbox with regenerate button
 */
export const WithRegenerate: Story = {
  args: {
    imageUrl: SAMPLE_IMAGES.landscape,
    alt: 'Generated visualization',
    onClose: () => console.log('Close clicked'),
    onRegenerate: () => console.log('Regenerate clicked'),
  },
}

/**
 * Lightbox while regenerating
 */
export const Regenerating: Story = {
  args: {
    imageUrl: SAMPLE_IMAGES.landscape,
    alt: 'Generated visualization',
    onClose: () => console.log('Close clicked'),
    onRegenerate: () => console.log('Regenerate clicked'),
    isRegenerating: true,
  },
}

/**
 * Interactive demo - click thumbnail to open lightbox
 */
export const InteractiveDemo: Story = {
  render: function InteractiveDemoStory() {
    const [isOpen, setIsOpen] = useState(false)
    const [isRegenerating, setIsRegenerating] = useState(false)
    const [currentImage, setCurrentImage] = useState(SAMPLE_IMAGES.landscape)

    const handleRegenerate = () => {
      setIsRegenerating(true)
      setTimeout(() => {
        // Cycle through images
        const images = Object.values(SAMPLE_IMAGES)
        const currentIndex = images.indexOf(currentImage)
        const nextIndex = (currentIndex + 1) % images.length
        setCurrentImage(images[nextIndex])
        setIsRegenerating(false)
      }, 1500)
    }

    return (
      <div className="p-8 flex flex-col items-center gap-4">
        <p className="text-muted-foreground">Click the thumbnail to open the lightbox</p>
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-xl overflow-hidden border border-border/50 hover:border-border transition-colors cursor-pointer"
        >
          <img
            src={currentImage}
            alt="Click to open"
            className="w-48 h-48 object-cover hover:scale-105 transition-transform duration-200"
          />
        </button>

        {isOpen && (
          <ImageLightbox
            imageUrl={currentImage}
            alt="Generated image"
            onClose={() => setIsOpen(false)}
            onRegenerate={handleRegenerate}
            isRegenerating={isRegenerating}
          />
        )}
      </div>
    )
  },
}
