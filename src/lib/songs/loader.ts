interface LineTimestamp {
  lineIndex: number;
  originalText: string;
  translatedText: string;
  start: number;
  end: number;
  wordCount: number;
}

interface SongData {
  title: string;
  artist: string;
  audioUrl: string;
  lineTimestamps: LineTimestamp[];
  totalLines: number;
  exportedAt: string;
  format: string;
}

export async function loadSongData(songId: string): Promise<SongData> {
  try {
    // Try to load from Grove Storage registry first
    const { getRegistrySongById } = await import('./grove-registry');
    const { resolveLensUri } = await import('../feed');

    const registrySong = await getRegistrySongById(songId);

    if (registrySong) {
      // Fetch timestamps data from Lens URI
      const timestampsUrl = resolveLensUri(registrySong.timestampsUri);
      const response = await fetch(timestampsUrl);

      if (response.ok) {
        const songData = await response.json();

        console.log(`[loadSongData] Grove Storage data for ${songId}:`, {
          hasLines: !!songData.lines,
          linesCount: songData.lines?.length || 0,
          firstLineWords: songData.lines?.[0]?.words?.slice(0, 3) || 'No words',
          structure: Object.keys(songData)
        });

        // Convert Grove Storage format to expected format
        let lineTimestamps = [];
        if (songData.lines) {
          // New Grove Storage format with "lines" array
          lineTimestamps = songData.lines.map((line: any) => ({
            lineIndex: line.lineIndex,
            originalText: line.originalText,
            translatedText: line.translations?.zh || line.originalText,
            start: line.start,
            end: line.end,
            wordCount: line.words?.length || line.originalText.split(' ').length,
            words: line.words || [] // Include word-level timestamps
          }));
        } else if (songData.lineTimestamps) {
          // Legacy format with "lineTimestamps" array
          lineTimestamps = songData.lineTimestamps;
        }

        if (!lineTimestamps || !Array.isArray(lineTimestamps) || lineTimestamps.length === 0) {
          throw new Error(`Invalid song data structure for ${songId}: missing or invalid line timestamps`);
        }

        // Filter out structure tags like (Pre-Chorus), [Verse], etc.
        const filteredLineTimestamps = lineTimestamps.filter((line: any) => {
          const text = line.originalText || line.text || '';
          // Remove lines that are just structure markers
          return !text.match(/^\s*[\(\[].*[\)\]]\s*$/);
        });

        console.log(`[loadSongData] Returning ${filteredLineTimestamps.length} lines (filtered from ${lineTimestamps.length})`);

        // Return in the expected format
        return {
          title: registrySong.title,
          artist: registrySong.artist,
          audioUrl: resolveLensUri(registrySong.audioUri),
          lineTimestamps: filteredLineTimestamps,
          totalLines: filteredLineTimestamps.length,
          exportedAt: songData.generatedAt || songData.exportedAt || new Date().toISOString(),
          format: songData.format || 'karaoke'
        };
      }
    }
  } catch (error) {
    console.warn(`Failed to load song ${songId} from registry, falling back to local:`, error);
  }

  // Fallback to local file system
  const response = await fetch(`/songs/${songId}/karaoke-line-timestamps.json`);

  if (!response.ok) {
    throw new Error(`Failed to load song data for ${songId}: ${response.statusText}`);
  }

  const songData = await response.json();

  // Validate the song data structure
  if (!songData.lineTimestamps || !Array.isArray(songData.lineTimestamps)) {
    throw new Error(`Invalid song data structure for ${songId}: missing or invalid lineTimestamps`);
  }

  return songData;
}

export function getSongAudioPath(songId: string): string {
  return `/songs/${songId}/${songId}.mp3`;
}

// Helper to get available song IDs from Grove Storage registry
export async function getAvailableSongs(): Promise<string[]> {
  try {
    const { getRegistrySongIds } = await import('./grove-registry');
    return await getRegistrySongIds();
  } catch (error) {
    console.warn('Failed to get song IDs from registry, using fallback:', error);
    // Fallback to local songs
    return ['song-1'];
  }
}