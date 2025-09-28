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

// Helper to get available song IDs (you'd implement this based on your song catalog)
export function getAvailableSongs(): string[] {
  // In a real app, this might fetch from an API or manifest file
  return ['song-1']; // Add more as you create them
}