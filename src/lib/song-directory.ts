import type { SongMetadata } from '../types/song';

/**
 * Get available songs by scanning the public/songs directory structure
 * For now, this is a static list since we can't actually scan directories in the browser
 * In a real app, this would be an API call to get available songs
 */
export async function getAvailableSongs(): Promise<SongMetadata[]> {
  // Static list of available songs
  // In production, this would come from an API endpoint
  const songIds = ['song-1']; // Add more as we create them

  const songs: SongMetadata[] = [];

  for (const songId of songIds) {
    try {
      // Fetch the song metadata from the JSON file
      const response = await fetch(`/songs/${songId}/karaoke-line-timestamps.json`);

      if (!response.ok) {
        console.warn(`Failed to load metadata for ${songId}`);
        continue;
      }

      const metadata = await response.json();

      // Create song object with computed duration
      const song: SongMetadata = {
        id: songId,
        title: metadata.title || 'Unknown Title',
        artist: metadata.artist || 'Unknown Artist',
        duration: calculateSongDuration(metadata.lineTimestamps),
        audioUrl: `/songs/${songId}/${songId}.mp3`,
        thumbnailUrl: `/songs/${songId}/thumbnail.jpg`, // Optional thumbnail
        lineTimestamps: metadata.lineTimestamps,
        totalLines: metadata.totalLines
      };

      songs.push(song);
    } catch (error) {
      console.error(`Error loading song ${songId}:`, error);
    }
  }

  return songs;
}

/**
 * Calculate song duration from line timestamps
 */
function calculateSongDuration(lineTimestamps: any[]): number {
  if (!lineTimestamps || lineTimestamps.length === 0) {
    return 0;
  }

  // Find the end time of the last line
  const lastLine = lineTimestamps[lineTimestamps.length - 1];
  return Math.ceil(lastLine.end || 0);
}

/**
 * Get a specific song by ID
 */
export async function getSongById(songId: string): Promise<SongMetadata | null> {
  const songs = await getAvailableSongs();
  return songs.find(song => song.id === songId) || null;
}

/**
 * Check if audio file exists for a song
 */
export async function checkAudioExists(songId: string): Promise<boolean> {
  try {
    const response = await fetch(`/songs/${songId}/${songId}.mp3`, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * For development: Add new songs to the available list
 * In production, this would be handled by a backend API
 */
export function registerSong(songId: string) {
  // This would typically update a database
  console.log(`Would register new song: ${songId}`);
}