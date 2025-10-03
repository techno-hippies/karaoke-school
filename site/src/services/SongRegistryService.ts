import { createPublicClient, http, type Abi } from 'viem';
import { chains } from '@lens-chain/sdk/viem';
import { SongRegistryV4ABI } from '../abi/SongRegistryV4';

const CONTRACT_ADDRESS = '0xC874eAAf142dB37a9B19202E07757E89da00351B' as const;

const publicClient = createPublicClient({
  chain: chains.testnet,
  transport: http('https://rpc.testnet.lens.xyz')
});

// Contract types matching SongRegistryV4.sol
export interface RegistrySong {
  id: string;
  title: string;
  artist: string;
  duration: number;
  audioUri: string;
  metadataUri: string;
  coverUri: string;
  thumbnailUri: string;
  musicVideoUri: string;
  clipIds: string;
  languages: string;
  enabled: boolean;
  addedAt: bigint;
}

export interface SongMetadataV4 {
  version: number;
  id: string;
  title: string;
  artist: string;
  duration: number;
  format: string;
  lines: LineWithWords[];
  availableLanguages: string[];
  generatedAt: string;
  elevenLabsProcessed: boolean;
  wordCount: number;
  lineCount: number;
  sectionIndex: SectionMarker[];
  clips?: ClipMetadataV4[];
}

export interface ClipMetadataV4 {
  id: string;
  title: string;
  artist: string;
  sectionType: string;
  sectionIndex: number;
  duration: number;
  audioUri: string;
  instrumentalUri: string;
  timestampsUri: string;
  thumbnailUri: string;
  languages: string[];
  difficultyLevel: number;
  wordsPerSecond: number;
  lines: LineWithWords[];
}

export interface LineWithWords {
  lineIndex: number;
  originalText: string;
  translations?: {
    cn?: string;
    vi?: string;
    es?: string;
    [key: string]: string | undefined;
  };
  start: number;
  end: number;
  words: Array<{
    text: string;
    start: number;
    end: number;
  }>;
  sectionMarker?: boolean;
}

export interface SectionMarker {
  type: string;
  lineIndex: number;
  timestamp: number;
}

// Helper to read contract
async function readSongRegistry(functionName: string, args?: any[]) {
  return publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: SongRegistryV4ABI as Abi,
    functionName,
    args
  });
}

// Parse raw song from contract
function parseSong(rawSong: any): RegistrySong {
  return {
    id: rawSong.id,
    title: rawSong.title,
    artist: rawSong.artist,
    duration: Number(rawSong.duration),
    audioUri: rawSong.audioUri,
    metadataUri: rawSong.metadataUri,
    coverUri: rawSong.coverUri,
    thumbnailUri: rawSong.thumbnailUri,
    musicVideoUri: rawSong.musicVideoUri,
    clipIds: rawSong.clipIds,
    languages: rawSong.languages,
    enabled: rawSong.enabled,
    addedAt: rawSong.addedAt
  };
}

/**
 * Get all enabled songs from contract
 */
export async function getContractSongs(): Promise<RegistrySong[]> {
  try {
    const songs = await readSongRegistry('getEnabledSongs') as any[];
    return songs.map(parseSong);
  } catch (error) {
    console.error('[SongRegistryService] Failed to get songs:', error);
    throw error;
  }
}

/**
 * Get specific song by ID
 */
export async function getContractSongById(songId: string): Promise<RegistrySong | null> {
  try {
    const song = await readSongRegistry('getSong', [songId]) as any;
    return parseSong(song);
  } catch (error) {
    console.error(`[SongRegistryService] Failed to get song ${songId}:`, error);
    return null;
  }
}

/**
 * Fetch full song metadata from Grove
 */
export async function fetchSongMetadata(metadataUri: string): Promise<SongMetadataV4> {
  const groveUrl = metadataUri.replace('lens://', 'https://api.grove.storage/');
  const response = await fetch(groveUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch metadata: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Resolve lens:// URI to Grove gateway URL
 */
export function resolveLensUri(uri: string): string {
  return uri.replace('lens://', 'https://api.grove.storage/');
}
