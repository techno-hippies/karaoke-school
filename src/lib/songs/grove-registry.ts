/**
 * Grove Storage song registry client
 * Fetches song metadata from the decentralized registry
 */

export interface RegistrySong {
  id: string;
  title: string;
  artist: string;
  duration: number;
  audioUri: string;      // lens:// URI
  timestampsUri: string; // lens:// URI
  thumbnailUri: string;  // lens:// URI
  addedAt: string;
}

export interface SongRegistry {
  version: number;
  lastUpdated: string;
  songs: RegistrySong[];
}

const GROVE_REGISTRY_URL = 'https://api.grove.storage/24cdef29730ca5e8fe18c1a39f5ce65225c8558d414810e88ad344ced296a87b';

/**
 * Fetch the song registry from Grove Storage
 */
export async function fetchSongRegistry(): Promise<SongRegistry> {
  try {
    const response = await fetch(GROVE_REGISTRY_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch song registry: ${response.statusText}`);
    }

    const registry: SongRegistry = await response.json();

    // Validate registry structure
    if (!registry.songs || !Array.isArray(registry.songs)) {
      throw new Error('Invalid registry format: missing songs array');
    }

    return registry;
  } catch (error) {
    console.error('Error fetching song registry:', error);
    throw error;
  }
}

/**
 * Get all songs from the registry
 */
export async function getRegistrySongs(): Promise<RegistrySong[]> {
  const registry = await fetchSongRegistry();
  return registry.songs;
}

/**
 * Get a specific song by ID from the registry
 */
export async function getRegistrySongById(songId: string): Promise<RegistrySong | null> {
  const songs = await getRegistrySongs();
  return songs.find(song => song.id === songId) || null;
}

/**
 * Get available song IDs from the registry
 */
export async function getRegistrySongIds(): Promise<string[]> {
  const songs = await getRegistrySongs();
  return songs.map(song => song.id);
}