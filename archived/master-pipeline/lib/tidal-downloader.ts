/**
 * Tidal Downloader
 * Downloads lossless FLAC audio from Tidal via squid.wtf API
 *
 * Advantages over spotdl/YouTube:
 * - LOSSLESS FLAC quality (16-bit/44.1kHz)
 * - Direct studio recordings (not music videos)
 * - Consistent timing for audio fingerprinting
 * - ISRC matching for accuracy
 */

import { writeFileSync } from 'fs';

// ============================================================================
// Types
// ============================================================================

export interface TidalTrack {
  id: number;
  title: string;
  duration: number;
  isrc: string;
  artist: {
    id: number;
    name: string;
  };
  artists: Array<{
    id: number;
    name: string;
  }>;
  album: {
    id: number;
    title: string;
  };
  audioQuality: string;
  bpm?: number;
}

export interface TidalDownloadInfo {
  trackId: number;
  audioQuality: string;
  bitDepth: number;
  sampleRate: number;
  OriginalTrackUrl: string;
}

export interface TidalSearchResult {
  track: TidalTrack;
  downloadInfo: TidalDownloadInfo;
}

// ============================================================================
// Tidal Client
// ============================================================================

export class TidalDownloader {
  private readonly searchBaseUrl = 'https://aether.squid.wtf/search/';
  private readonly downloadBaseUrl = 'https://triton.squid.wtf/track/';

  /**
   * Search Tidal for tracks by artist and title
   */
  async search(query: string, limit: number = 25): Promise<TidalTrack[]> {
    const url = `${this.searchBaseUrl}?s=${encodeURIComponent(query)}&limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'accept': '*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`Tidal search failed: ${response.status}`);
    }

    const data: any = await response.json();
    return data.items || [];
  }

  /**
   * Search by ISRC code (most accurate)
   */
  async searchByIsrc(isrc: string): Promise<TidalTrack | null> {
    const tracks = await this.search(isrc, 5);

    // Find exact ISRC match
    const match = tracks.find(t => t.isrc === isrc);
    return match || null;
  }

  /**
   * Search by artist and title with fuzzy matching
   */
  async searchByMetadata(artist: string, title: string): Promise<TidalTrack[]> {
    const query = `${artist} ${title}`;
    return await this.search(query, 10);
  }

  /**
   * Get download info for a track
   */
  async getDownloadInfo(trackId: number, quality: 'LOSSLESS' | 'HIGH' | 'LOW' = 'LOSSLESS'): Promise<TidalDownloadInfo> {
    const url = `${this.downloadBaseUrl}?id=${trackId}&quality=${quality}`;

    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'accept': '*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`Tidal download info failed: ${response.status}`);
    }

    const data: any[] = await response.json();

    // Response is array: [metadata, streamInfo, directUrl]
    if (data.length < 3) {
      throw new Error('Invalid Tidal download response format');
    }

    const streamInfo = data[1];
    const urlInfo = data[2];

    return {
      trackId: streamInfo.trackId,
      audioQuality: streamInfo.audioQuality,
      bitDepth: streamInfo.bitDepth,
      sampleRate: streamInfo.sampleRate,
      OriginalTrackUrl: urlInfo.OriginalTrackUrl,
    };
  }

  /**
   * Download track audio to file
   */
  async downloadTrack(trackId: number, outputPath: string, quality: 'LOSSLESS' | 'HIGH' | 'LOW' = 'LOSSLESS'): Promise<void> {
    console.log(`  Fetching Tidal download URL for track ${trackId}...`);
    const downloadInfo = await this.getDownloadInfo(trackId, quality);

    console.log(`  Quality: ${downloadInfo.audioQuality} (${downloadInfo.bitDepth}-bit/${downloadInfo.sampleRate}Hz)`);
    console.log(`  Downloading FLAC...`);

    const audioResponse = await fetch(downloadInfo.OriginalTrackUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      },
    });

    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    writeFileSync(outputPath, Buffer.from(audioBuffer));

    console.log(`  ✓ Downloaded: ${outputPath}`);
  }

  /**
   * Find and download track by ISRC
   */
  async downloadByIsrc(isrc: string, outputPath: string): Promise<TidalTrack> {
    console.log(`  Searching Tidal by ISRC: ${isrc}...`);

    const track = await this.searchByIsrc(isrc);
    if (!track) {
      throw new Error(`No Tidal track found for ISRC: ${isrc}`);
    }

    console.log(`  ✓ Found: ${track.title} by ${track.artist.name}`);

    await this.downloadTrack(track.id, outputPath);

    return track;
  }

  /**
   * Find and download track by metadata
   */
  async downloadByMetadata(artist: string, title: string, outputPath: string): Promise<TidalTrack> {
    console.log(`  Searching Tidal: ${artist} - ${title}...`);

    const tracks = await this.searchByMetadata(artist, title);
    if (tracks.length === 0) {
      throw new Error(`No Tidal tracks found for: ${artist} - ${title}`);
    }

    const track = tracks[0]; // Use first result
    console.log(`  ✓ Found: ${track.title} by ${track.artist.name} (${track.audioQuality})`);

    await this.downloadTrack(track.id, outputPath);

    return track;
  }
}

// ============================================================================
// CLI Usage
// ============================================================================

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage:');
    console.error('  bun lib/tidal-downloader.ts <artist> <title> <output.flac>');
    console.error('  bun lib/tidal-downloader.ts --isrc <ISRC> <output.flac>');
    console.error('\nExample:');
    console.error('  bun lib/tidal-downloader.ts "Chic" "Le Freak" output.flac');
    console.error('  bun lib/tidal-downloader.ts --isrc USAT20108541 output.flac');
    process.exit(1);
  }

  const downloader = new TidalDownloader();

  try {
    if (args[0] === '--isrc') {
      const isrc = args[1];
      const output = args[2];
      await downloader.downloadByIsrc(isrc, output);
    } else {
      const artist = args[0];
      const title = args[1];
      const output = args[2];
      await downloader.downloadByMetadata(artist, title, output);
    }

    console.log('\n✅ Download complete!');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}
