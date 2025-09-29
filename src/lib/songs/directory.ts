import type { SongMetadata } from '../types/song';
import { getRegistrySongs, type RegistrySong } from './grove-registry';
import { resolveLensUri } from '../feed';

/**
 * Get available songs from Grove Storage registry
 * Falls back to local songs if registry fails
 */
export async function getAvailableSongs(): Promise<SongMetadata[]> {
  try {
    // Try to get songs from Grove Storage registry first
    const registrySongs = await getRegistrySongs();
    const songs: SongMetadata[] = [];

    for (const registrySong of registrySongs) {
      try {
        // Fetch timestamps data from Lens URI
        const timestampsUrl = resolveLensUri(registrySong.timestampsUri);
        const timestampsResponse = await fetch(timestampsUrl);

        if (!timestampsResponse.ok) {
          console.warn(`Failed to load timestamps for ${registrySong.id}`);
          continue;
        }

        const timestampsData = await timestampsResponse.json();

        // Convert registry song to SongMetadata format
        const thumbnailUrl = resolveLensUri(registrySong.thumbnailUri);
        console.log(`[getAvailableSongs] Processing song ${registrySong.id}:`, {
          title: registrySong.title,
          artist: registrySong.artist,
          thumbnailUri: registrySong.thumbnailUri,
          thumbnailUrl,
          timestampsStructure: Object.keys(timestampsData)
        });

        // Convert Grove Storage format to expected format
        let lineTimestamps = [];
        if (timestampsData.lines) {
          // New Grove Storage format with "lines" array
          lineTimestamps = timestampsData.lines.map((line: any) => ({
            lineIndex: line.lineIndex,
            originalText: line.originalText,
            translatedText: line.translations?.zh || line.originalText, // Use Chinese translation or fallback to original
            start: line.start,
            end: line.end,
            wordCount: line.words?.length || line.originalText.split(' ').length,
            words: line.words || [] // Include word-level timestamps
          }));
        } else if (timestampsData.lineTimestamps) {
          // Legacy format with "lineTimestamps" array
          lineTimestamps = timestampsData.lineTimestamps;
        }

        const song: SongMetadata = {
          id: registrySong.id,
          title: registrySong.title,
          artist: registrySong.artist,
          duration: registrySong.duration,
          audioUrl: resolveLensUri(registrySong.audioUri),
          thumbnailUrl,
          lineTimestamps,
          totalLines: timestampsData.lineCount || timestampsData.totalLines || lineTimestamps.length
        };

        songs.push(song);
      } catch (error) {
        console.error(`Error processing registry song ${registrySong.id}:`, error);
      }
    }

    console.log(`Loaded ${songs.length} songs from Grove Storage registry`);
    return songs;

  } catch (error) {
    console.warn('Failed to load from Grove Storage registry, falling back to local songs:', error);
    return getLocalSongs();
  }
}

/**
 * Fallback function to load songs from local public/songs directory
 * Used when Grove Storage registry is unavailable
 */
async function getLocalSongs(): Promise<SongMetadata[]> {
  // Static list of local songs as fallback
  const songIds = ['song-1'];
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

  console.log(`Loaded ${songs.length} songs from local fallback`);
  return songs;
}

/**
 * Calculate song duration from line timestamps
 */
function calculateSongDuration(lineTimestamps: Array<{ end?: number }>): number {
  if (!lineTimestamps || lineTimestamps.length === 0) {
    return 0;
  }

  // Find the end time of the last line
  const lastLine = lineTimestamps[lineTimestamps.length - 1];
  return Math.ceil(lastLine.end || 0);
}

/**
 * Get a specific song by ID from Grove Storage registry
 * Falls back to searching all songs if direct lookup fails
 */
export async function getSongById(songId: string): Promise<SongMetadata | null> {
  try {
    // Try to get the specific song from registry first
    const { getRegistrySongById } = await import('./grove-registry');
    const registrySong = await getRegistrySongById(songId);

    if (registrySong) {
      // Fetch timestamps data from Lens URI
      const timestampsUrl = resolveLensUri(registrySong.timestampsUri);
      const timestampsResponse = await fetch(timestampsUrl);

      if (timestampsResponse.ok) {
        const timestampsData = await timestampsResponse.json();

        // Convert Grove Storage format to expected format
        let lineTimestamps = [];
        if (timestampsData.lines) {
          // New Grove Storage format with "lines" array
          lineTimestamps = timestampsData.lines.map((line: any) => ({
            lineIndex: line.lineIndex,
            originalText: line.originalText,
            translatedText: line.translations?.zh || line.originalText,
            start: line.start,
            end: line.end,
            wordCount: line.words?.length || line.originalText.split(' ').length,
            words: line.words || [] // Include word-level timestamps
          }));
        } else if (timestampsData.lineTimestamps) {
          // Legacy format with "lineTimestamps" array
          lineTimestamps = timestampsData.lineTimestamps;
        }

        return {
          id: registrySong.id,
          title: registrySong.title,
          artist: registrySong.artist,
          duration: registrySong.duration,
          audioUrl: resolveLensUri(registrySong.audioUri),
          thumbnailUrl: resolveLensUri(registrySong.thumbnailUri),
          lineTimestamps,
          totalLines: timestampsData.lineCount || timestampsData.totalLines || lineTimestamps.length
        };
      }
    }
  } catch (error) {
    console.warn(`Failed to get song ${songId} from registry, searching all songs:`, error);
  }

  // Fallback to searching all available songs
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