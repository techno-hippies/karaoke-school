import type { Meta, StoryObj } from '@storybook/react'
import { VideoRecorder } from '../../components/karaoke/VideoRecorder'

const meta: Meta<typeof VideoRecorder> = {
  title: 'Karaoke/VideoRecorder',
  component: VideoRecorder,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'dark', value: '#000000' }
      }
    },
    docs: {
      description: {
        component: `
VideoRecorder component for karaoke recording with real-time camera, audio mixing, and lyrics synchronization.

**Features:**
- Real camera preview with permissions
- Web Audio API mixing (mic + instrumental)
- Countdown timer (optional)
- Lyrics highlighting in real-time
- Video toggle (audio-only mode)
- Flip camera (mobile with multiple cameras)
- Auto-stop at segment end

**Note:** Stories require camera/microphone permissions to function properly.
        `
      }
    }
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof VideoRecorder>

// Sample karaoke lines
const sampleKaraokeLines = [
  {
    text: "The club isn't the best place to find a lover",
    start: 0,
    end: 4,
    words: [
      { text: "The", start: 0, end: 0.3 },
      { text: "club", start: 0.3, end: 0.8 },
      { text: "isn't", start: 0.8, end: 1.2 },
      { text: "the", start: 1.2, end: 1.4 },
      { text: "best", start: 1.4, end: 1.8 },
      { text: "place", start: 1.8, end: 2.3 },
      { text: "to", start: 2.3, end: 2.5 },
      { text: "find", start: 2.5, end: 2.9 },
      { text: "a", start: 2.9, end: 3.0 },
      { text: "lover", start: 3.0, end: 4.0 }
    ]
  },
  {
    text: "So the bar is where I go",
    start: 4.5,
    end: 7.5,
    words: [
      { text: "So", start: 4.5, end: 4.8 },
      { text: "the", start: 4.8, end: 5.0 },
      { text: "bar", start: 5.0, end: 5.5 },
      { text: "is", start: 5.5, end: 5.8 },
      { text: "where", start: 5.8, end: 6.3 },
      { text: "I", start: 6.3, end: 6.5 },
      { text: "go", start: 6.5, end: 7.5 }
    ]
  },
  {
    text: "Me and my friends at the table doing shots",
    start: 8,
    end: 11.5,
    words: [
      { text: "Me", start: 8, end: 8.3 },
      { text: "and", start: 8.3, end: 8.5 },
      { text: "my", start: 8.5, end: 8.7 },
      { text: "friends", start: 8.7, end: 9.2 },
      { text: "at", start: 9.2, end: 9.4 },
      { text: "the", start: 9.4, end: 9.6 },
      { text: "table", start: 9.6, end: 10.0 },
      { text: "doing", start: 10.0, end: 10.5 },
      { text: "shots", start: 10.5, end: 11.5 }
    ]
  },
  {
    text: "Drinking fast and then we talk slow",
    start: 12,
    end: 15,
    words: [
      { text: "Drinking", start: 12, end: 12.6 },
      { text: "fast", start: 12.6, end: 13.0 },
      { text: "and", start: 13.0, end: 13.2 },
      { text: "then", start: 13.2, end: 13.5 },
      { text: "we", start: 13.5, end: 13.7 },
      { text: "talk", start: 13.7, end: 14.2 },
      { text: "slow", start: 14.2, end: 15.0 }
    ]
  }
]

/**
 * Default state - Ready to record with lyrics
 *
 * This is the standard karaoke recording experience:
 * - Camera preview active
 * - Lyrics will sync with instrumental playback
 * - 30-second segment from song beginning
 * - All controls available
 */
export const Default: Story = {
  args: {
    selectedSong: {
      id: '1',
      title: 'Shape of You',
      artist: 'Ed Sheeran',
      coverUrl: 'https://placebear.com/200/200',
    },
    instrumentalUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    segmentStartTime: 0,
    segmentEndTime: 30,
    karaokeLines: sampleKaraokeLines,
    onRecordingComplete: (blob) => console.log('Recording complete, blob size:', blob.size),
    onClose: () => console.log('Close clicked'),
    onSelectSong: () => console.log('Select song clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Standard karaoke recording with camera, microphone, and synced lyrics.'
      }
    }
  }
}

/**
 * Song Without Lyrics
 *
 * Demonstrates recording when lyrics aren't available for the song.
 * The instrumental backing track plays, but there's no on-screen text guide.
 *
 * **What's happening:**
 * - ✅ Instrumental track (backing music) plays normally
 * - ✅ User can still record vocals over it
 * - ❌ No lyrics text guide showing when/what to sing
 * - ❌ Lyrics toggle button hidden from sidebar
 *
 * **Use cases:**
 * - Lyrics haven't been processed/synced yet
 * - Lyrics detection failed for this song
 * - Free tier users (lyrics as premium feature)
 * - User recording from memory
 *
 * **UX Impact:**
 * - User must know the song by heart
 * - No timing guidance for when to sing
 * - More challenging than with lyrics
 */
export const SongWithoutLyrics: Story = {
  args: {
    selectedSong: {
      id: '3',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      coverUrl: 'https://placebear.com/202/202',
    },
    instrumentalUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    segmentStartTime: 0,
    segmentEndTime: 30,
    karaokeLines: undefined, // No lyrics guide available
    onRecordingComplete: (blob) => console.log('Recording complete, blob size:', blob.size),
    onClose: () => console.log('Close clicked'),
    onSelectSong: () => console.log('Select song clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Recording with instrumental track but no lyrics guide. The lyrics toggle button is hidden since there are no lyrics to display.'
      }
    }
  }
}

/**
 * Segment From Middle (Offset Playback)
 *
 * This story demonstrates a critical feature: recording a segment that doesn't start
 * at the beginning of the song.
 *
 * **Why this matters:**
 * Most songs are split into segments like:
 * - Intro (0:00-0:30)
 * - Verse 1 (0:30-1:00)
 * - Chorus (1:00-1:30) ← User selects this
 * - Verse 2 (1:30-2:00)
 *
 * When the user selects "Chorus", we need to:
 * 1. Load the FULL instrumental track
 * 2. Seek to 1:00 (segmentStartTime)
 * 3. Start recording from that point
 * 4. Show lyrics that correspond to 1:00-1:30 in the song
 * 5. Auto-stop at 1:30 (segmentEndTime)
 *
 * **Technical details:**
 * - The audio element's currentTime is set to segmentStartTime
 * - Lyrics have absolute timings (not relative to segment)
 * - Recording captures only the 30-second segment
 *
 * **Use cases:**
 * - User selected "Chorus" segment (starts at 1:15)
 * - User selected "Bridge" segment (starts at 2:30)
 * - Any non-intro segment
 */
export const SegmentFromMiddle: Story = {
  args: {
    selectedSong: {
      id: '5',
      title: 'Shape of You (Chorus)',
      artist: 'Ed Sheeran',
      coverUrl: 'https://placebear.com/204/204',
    },
    instrumentalUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    segmentStartTime: 15, // Starts 15 seconds into the song
    segmentEndTime: 45,   // Ends at 45 seconds
    // Note: In real app, lyrics would have actual timings from the song at 15-45s
    // For demo, we're shifting the sample lyrics
    karaokeLines: sampleKaraokeLines.map(line => ({
      ...line,
      start: line.start + 15,
      end: line.end + 15,
      words: line.words?.map(word => ({
        ...word,
        start: word.start + 15,
        end: word.end + 15
      }))
    })),
    onRecordingComplete: (blob) => console.log('Recording complete, blob size:', blob.size),
    onClose: () => console.log('Close clicked'),
    onSelectSong: () => console.log('Select song clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Recording a segment that starts at 15 seconds into the song. The instrumental will seek to that timestamp before starting.'
      }
    }
  }
}

/**
 * Long Segment (60 seconds)
 *
 * Tests recording with longer duration to ensure:
 * - Auto-stop works at correct time
 * - Audio/video stay in sync
 * - No memory issues
 */
export const LongSegment: Story = {
  args: {
    selectedSong: {
      id: '4',
      title: 'Bohemian Rhapsody (Opera Section)',
      artist: 'Queen',
      coverUrl: 'https://placebear.com/203/203',
    },
    instrumentalUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    segmentStartTime: 0,
    segmentEndTime: 60, // Full minute
    karaokeLines: sampleKaraokeLines,
    onRecordingComplete: (blob) => console.log('Recording complete, blob size:', blob.size),
    onClose: () => console.log('Close clicked'),
    onSelectSong: () => console.log('Select song clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Recording a full minute segment. Tests longer recording duration handling.'
      }
    }
  }
}

/**
 * Different Song
 *
 * Simply demonstrates with a different song to show multiple use cases.
 */
export const DifferentSong: Story = {
  args: {
    selectedSong: {
      id: '2',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      coverUrl: 'https://placebear.com/201/201',
    },
    instrumentalUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    segmentStartTime: 0,
    segmentEndTime: 30,
    karaokeLines: sampleKaraokeLines,
    onRecordingComplete: (blob) => console.log('Recording complete, blob size:', blob.size),
    onClose: () => console.log('Close clicked'),
    onSelectSong: () => console.log('Select song clicked'),
  },
}

/**
 * ⚠️ Error States Documentation
 *
 * The VideoRecorder component has sophisticated error handling with 3 main categories.
 * These states are managed by the useCamera, useInstrumental, and useKaraokeRecorder hooks.
 */

/**
 * ERROR STATE 1: Permission Required
 *
 * **Triggers:**
 * - User clicks "Block" on permission prompt
 * - User previously denied permissions
 * - SecurityError (HTTPS required)
 *
 * **UI Display:**
 * - 🔒 Yellow lock icon
 * - Title: "Permission Required"
 * - Message: "Click the camera icon in your browser address bar to allow access"
 * - Action: [Use Audio Only] button
 *
 * **Testing in Browser:**
 * 1. Open the Default story
 * 2. Click "Block" when prompted for camera/mic access
 * 3. You'll see the Permission Required state
 *
 * **Recovery:**
 * - User must manually allow permissions via browser UI
 * - Can switch to audio-only mode as workaround
 */

/**
 * ERROR STATE 2: Camera Unavailable
 *
 * **Triggers:**
 * - No camera hardware connected (NotFoundError)
 * - Camera in use by another app (NotReadableError)
 * - Camera hardware failure (TrackStartError)
 * - Camera doesn't support settings (OverconstrainedError)
 *
 * **UI Display:**
 * - 📷 Orange camera-slash icon
 * - Title: "Camera Unavailable"
 * - Message varies by specific error:
 *   - "No camera found. Please connect a camera or try audio-only mode."
 *   - "Camera is in use by another app. Close other apps and try again."
 *   - "Your camera doesn't support the required settings."
 * - Actions: [Try Again] [Use Audio Only] buttons
 *
 * **Testing in Browser:**
 * 1. Open the Default story
 * 2. Open another app that uses your camera (Zoom, Skype, etc.)
 * 3. Refresh the story - you'll see Camera Unavailable
 * OR
 * 1. Physically disconnect your webcam (if external)
 * 2. Open the story
 *
 * **Recovery:**
 * - Close other apps using camera
 * - Connect camera hardware
 * - Click "Try Again" to retry
 * - Use "Audio Only" mode as fallback
 */

/**
 * ERROR STATE 3: Something Went Wrong
 *
 * **Triggers:**
 * - AbortError (browser cancelled request)
 * - TypeError (invalid constraints - our bug)
 * - Unknown/unexpected errors
 * - Timeout during initialization
 *
 * **UI Display:**
 * - ⚠️ Red warning icon
 * - Title: "Something Went Wrong"
 * - Message: "Unable to access camera. This may be temporary."
 * - Action: [Try Again] button
 *
 * **Testing in Browser:**
 * - Difficult to trigger intentionally
 * - Usually indicates transient issue or browser bug
 *
 * **Recovery:**
 * - Click "Try Again" - often resolves itself
 * - Refresh the page
 * - Try different browser
 */

/**
 * ADDITIONAL STATES:
 *
 * **Loading State:**
 * - Shown during getUserMedia request
 * - Display: "Loading camera..."
 * - No error - just waiting for hardware initialization
 *
 * **Instrumental Error:**
 * - Shown when audio track fails to load
 * - Display: "Audio Error" overlay
 * - Check network connection or URL validity
 *
 * **Recording Error:**
 * - Shown when MediaRecorder fails
 * - Display: "Recording Error" overlay
 * - Usually due to codec support or browser limitations
 *
 * **Audio-Only Mode:**
 * - User chooses to hide video
 * - Display: "Video hidden - Audio-only mode"
 * - This is NOT an error state - it's intentional
 */

/**
 * HOW TO TEST ALL ERROR STATES:
 *
 * 1. Permission Required:
 *    - Open story, click "Block" on permission prompt
 *
 * 2. Camera Unavailable (No Device):
 *    - Disconnect webcam, open story
 *
 * 3. Camera Unavailable (In Use):
 *    - Open Zoom/Skype, then open story
 *
 * 4. Something Went Wrong:
 *    - Hard to trigger - usually indicates browser issue
 *
 * 5. Audio-Only Mode:
 *    - Open Default story
 *    - Click "Audio Only" button in error states
 *    OR click video toggle button in sidebar
 */
