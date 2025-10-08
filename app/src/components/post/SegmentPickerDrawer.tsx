import { useState, useRef, useEffect } from 'react'
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from '@/components/ui/item'
import { AudioButton } from '@/components/media/audio-button'
import { Coin } from '@phosphor-icons/react'

export interface SongSegment {
  id: string
  displayName: string
  startTime: number
  endTime: number
  duration: number
  audioUrl?: string
  isOwned?: boolean
}

interface SegmentPickerDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  songTitle: string
  songArtist: string
  songArtwork?: string
  segments: SongSegment[]
  onSelectSegment: (segment: SongSegment) => void
}

/**
 * SegmentPickerDrawer - Select a song segment for karaoke
 * Action button per row: "Start" (owned) or "Unlock" (locked)
 */
export function SegmentPickerDrawer({
  open,
  onOpenChange,
  songTitle,
  songArtist,
  songArtwork,
  segments,
  onSelectSegment,
}: SegmentPickerDrawerProps) {
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const handlePlayPause = (segment: SongSegment) => {
    if (!segment.audioUrl) return

    if (playingSegmentId === segment.id) {
      // Pause current segment
      audioRef.current?.pause()
      setPlayingSegmentId(null)
    } else {
      // Play new segment
      if (audioRef.current) {
        audioRef.current.src = segment.audioUrl
        setIsLoading(true)
        audioRef.current.play().catch((error) => {
          console.error('Failed to play audio:', error)
          setIsLoading(false)
        })
        setPlayingSegmentId(segment.id)
      }
    }
  }

  // Stop playback when drawer closes
  useEffect(() => {
    if (!open) {
      audioRef.current?.pause()
      setPlayingSegmentId(null)
    }
  }, [open])

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handlePlaying = () => setIsLoading(false)
    const handleEnded = () => setPlayingSegmentId(null)
    const handleError = () => {
      setIsLoading(false)
      setPlayingSegmentId(null)
    }

    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col overflow-hidden">
        {/* Hidden audio element */}
        <audio ref={audioRef} />

        {/* Song info with background - flush edges */}
        <div className="w-full text-center relative overflow-hidden">
          {/* Background image with overlay */}
          {songArtwork && (
            <div className="absolute inset-0">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${songArtwork})`,
                  backgroundPosition: 'center center'
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/60" />
            </div>
          )}

          {/* Content */}
          <div className="relative z-10 py-8 px-4">
            <h2 className="text-2xl font-bold text-foreground">{songTitle}</h2>
            <p className="text-lg text-muted-foreground mt-1">{songArtist}</p>
          </div>
        </div>

        {/* Segment list container with padding */}
        <div className="pt-4 flex flex-col gap-1">
          {segments.map((segment) => (
            <Item key={segment.id} variant="default" className="gap-3 px-4 py-2">
              {segment.audioUrl && (
                <ItemMedia>
                  <AudioButton
                    size="sm"
                    isPlaying={playingSegmentId === segment.id}
                    isLoading={isLoading && playingSegmentId === segment.id}
                    onClick={() => handlePlayPause(segment)}
                    aria-label={playingSegmentId === segment.id ? 'Pause segment' : 'Play segment'}
                  />
                </ItemMedia>
              )}
              <ItemContent>
                <ItemTitle>{segment.displayName}</ItemTitle>
                <ItemDescription>
                  {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  size="sm"
                  variant={segment.isOwned ? "default" : "secondary"}
                  onClick={() => onSelectSegment(segment)}
                  className="w-20"
                >
                  {segment.isOwned ? "Start" : "1 Credit"}
                </Button>
              </ItemActions>
            </Item>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
