/**
 * Song Identification Service
 *
 * Identifies songs from TikTok video metadata and fetches licensing data
 * Handles BOTH copyrighted and copyright-free content
 */

import { BaseService, ServiceConfig } from './base.js';
import type { MLCData } from '../lib/schemas/index.js';

export interface TikTokMusicMetadata {
  title: string;
  artist?: string;
  spotifyUrl?: string | null;
  spotifyTrackId?: string | null;
}

export interface SongIdentificationResult {
  // Required fields (present for ALL videos)
  title: string;
  artist: string;
  copyrightType: 'copyrighted' | 'copyright-free';

  // Optional fields (only for copyrighted content)
  spotifyId?: string;
  spotifyUrl?: string;
  isrc?: string;
  album?: string;
  geniusId?: number;
  mlcData?: MLCData;
  storyMintable: boolean;
}

export interface SpotifyConfig extends ServiceConfig {
  clientId: string;
  clientSecret: string;
}

export interface GeniusConfig {
  apiKey: string;
}

export class SongIdentificationService extends BaseService {
  private spotifyConfig: SpotifyConfig;
  private geniusConfig?: GeniusConfig;
  private spotifyToken?: { token: string; expiresAt: number };

  constructor(spotifyConfig: SpotifyConfig, geniusConfig?: GeniusConfig) {
    super('SongIdentification', spotifyConfig);
    this.spotifyConfig = spotifyConfig;
    this.geniusConfig = geniusConfig;
  }

  /**
   * Main entry point: Identify song from TikTok music metadata
   */
  async identifyFromTikTok(metadata: TikTokMusicMetadata): Promise<SongIdentificationResult> {
    this.log(`Identifying: "${metadata.title}" by ${metadata.artist || 'Unknown'}`);

    // Check if video has Spotify link (copyrighted content)
    const hasSpotifyLink = !!(metadata.spotifyUrl || metadata.spotifyTrackId);

    if (!hasSpotifyLink) {
      // Copyright-free content (e.g., original sound, royalty-free music)
      this.log('Copyright-free content detected (no Spotify link)');
      return {
        title: metadata.title,
        artist: metadata.artist || 'Original Sound',
        copyrightType: 'copyright-free',
        storyMintable: true, // Can mint without licensing
      };
    }

    // Copyrighted content - fetch full licensing data
    this.log('Copyrighted content detected (has Spotify link)');

    // Extract Spotify ID
    const spotifyId = this.extractSpotifyId(metadata);
    if (!spotifyId) {
      throw new Error('Invalid Spotify URL/ID');
    }

    // Fetch Spotify track data
    const spotifyData = await this.fetchSpotifyTrack(spotifyId);
    this.log(`✓ Spotify: ${spotifyData.name} by ${spotifyData.artists.join(', ')}`);
    this.log(`✓ ISRC: ${spotifyData.isrc}`);

    // Optional: Try to find on Genius for lyrics
    let geniusId: number | undefined;
    if (this.geniusConfig) {
      geniusId = await this.findInGenius(spotifyData.name, spotifyData.artists[0]);
      if (geniusId) {
        this.log(`✓ Genius ID: ${geniusId}`);
      }
    }

    // Fetch MLC licensing data
    let mlcData: MLCData | undefined;
    let storyMintable = false;

    if (spotifyData.isrc) {
      mlcData = await this.fetchMLCData(spotifyData.isrc, spotifyData.name, spotifyData.artists[0]);
      if (mlcData) {
        this.log(`✓ MLC Song Code: ${mlcData.mlcSongCode}`);
        this.log(`✓ Publisher Share: ${mlcData.totalPublisherShare}%`);
        storyMintable = mlcData.storyMintable;
      } else {
        this.log('⚠️  MLC data not found (song may be too new)');
      }
    }

    return {
      title: spotifyData.name,
      artist: spotifyData.artists.join(' & '),
      copyrightType: 'copyrighted',
      spotifyId,
      spotifyUrl: `https://open.spotify.com/track/${spotifyId}`,
      isrc: spotifyData.isrc,
      album: spotifyData.album,
      geniusId,
      mlcData,
      storyMintable,
    };
  }

  /**
   * Extract Spotify track ID from URL or use direct ID
   */
  private extractSpotifyId(metadata: TikTokMusicMetadata): string | null {
    // Direct ID
    if (metadata.spotifyTrackId) {
      return metadata.spotifyTrackId;
    }

    // Extract from URL
    if (metadata.spotifyUrl) {
      const match = metadata.spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
      return match ? match[1] : null;
    }

    return null;
  }

  /**
   * Get Spotify access token (cached)
   */
  private async getSpotifyToken(): Promise<string> {
    // Return cached token if still valid
    if (this.spotifyToken && Date.now() < this.spotifyToken.expiresAt) {
      return this.spotifyToken.token;
    }

    // Fetch new token
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(
          `${this.spotifyConfig.clientId}:${this.spotifyConfig.clientSecret}`
        ).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Spotify Auth Debug]', {
        status: response.status,
        clientId: this.spotifyConfig.clientId?.substring(0, 10) + '...',
        hasSecret: !!this.spotifyConfig.clientSecret,
        secretLength: this.spotifyConfig.clientSecret?.length,
        errorBody,
      });
      throw new Error(`Spotify auth failed: ${response.status} - ${errorBody}`);
    }

    const data = (await response.json()) as any;
    this.spotifyToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000) - 60000, // Refresh 1min early
    };

    return this.spotifyToken.token;
  }

  /**
   * Fetch Spotify track metadata
   */
  private async fetchSpotifyTrack(trackId: string): Promise<{
    name: string;
    artists: string[];
    album: string;
    isrc: string;
    releaseDate: string;
    durationMs: number;
  }> {
    const token = await this.getSpotifyToken();

    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const track = (await response.json()) as any;

    return {
      name: track.name,
      artists: track.artists.map((a: any) => a.name),
      album: track.album.name,
      isrc: track.external_ids?.isrc || '',
      releaseDate: track.album.release_date,
      durationMs: track.duration_ms,
    };
  }

  /**
   * Search for song on Genius (optional - for lyrics)
   */
  private async findInGenius(title: string, artist: string): Promise<number | null> {
    if (!this.geniusConfig) {
      return null;
    }

    try {
      // Clean title: remove version suffixes that confuse Genius search
      // Examples: "- Remastered 2009", "- Live", "- Acoustic", "- Radio Edit", etc.
      const cleanTitle = title
        .replace(/\s*-\s*(Remastered|Live|Acoustic|Radio Edit|Extended|Remix|Version|Album Version|Single Version|Explicit|Clean).*$/i, '')
        .trim();

      const query = `${cleanTitle} ${artist}`;
      const response = await fetch(
        `https://api.genius.com/search?q=${encodeURIComponent(query)}&access_token=${this.geniusConfig.apiKey}`
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as any;
      const hits = data.response?.hits || [];

      if (hits.length === 0) {
        return null;
      }

      // Validate: find first hit where artist name matches (case-insensitive, partial match)
      const normalizeArtist = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const expectedArtist = normalizeArtist(artist);

      for (const hit of hits) {
        const resultArtist = normalizeArtist(hit.result.primary_artist?.name || '');

        // Check if artist names match (either direction for partial matches)
        if (resultArtist.includes(expectedArtist) || expectedArtist.includes(resultArtist)) {
          this.log(`✓ Validated Genius match: "${hit.result.title}" by ${hit.result.primary_artist?.name}`);
          return hit.result.id;
        }
      }

      // No validated match found
      this.log(`⚠️  No artist-validated Genius match found for: ${cleanTitle} by ${artist}`);
      return null;
    } catch (error: any) {
      this.log(`⚠️  Genius search error: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch MLC licensing data by ISRC
   * Reuses logic from modules/songs/02-fetch-mlc-data.ts
   */
  private async fetchMLCData(isrc: string, title: string, artist: string): Promise<MLCData | null> {
    try {
      const searchUrl = 'https://api.ptl.themlc.com/api2v/public/search/works';

      // Search by title (MLC doesn't support direct ISRC search)
      let page = 0;
      const maxPages = 10;

      while (page < maxPages) {
        const response = await fetch(`${searchUrl}?page=${page}&size=50`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title }),
        });

        if (!response.ok) {
          break;
        }

        const data = (await response.json()) as any;
        const works = data.content || [];

        // Check each work's recordings for ISRC match
        for (const work of works) {
          const hasMatch = await this.workHasISRC(work.songCode, isrc);
          if (hasMatch) {
            return this.convertMLCWork(work, isrc);
          }
        }

        if (page + 1 >= data.totalPages || works.length === 0) {
          break;
        }

        page++;
      }

      return null;
    } catch (error: any) {
      this.log(`⚠️  MLC fetch error: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if a work's recordings include the target ISRC
   */
  private async workHasISRC(songCode: string, targetIsrc: string): Promise<boolean> {
    try {
      const url = `https://api.ptl.themlc.com/api/dsp-recording/matched/${songCode}?page=1&limit=10&order=matchedAmount&direction=desc`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Origin': 'https://portal.themlc.com',
          'Referer': 'https://portal.themlc.com/',
        },
      });

      if (!response.ok) return false;

      const data = (await response.json()) as any;
      const recordings = data.recordings || [];

      return recordings.some((r: any) => r.isrc === targetIsrc);
    } catch {
      return false;
    }
  }

  /**
   * Convert MLC API work response to our schema
   */
  private convertMLCWork(work: any, isrc: string): MLCData {
    // Calculate total publisher shares (direct + administrator)
    let directShare = 0;
    let adminShare = 0;

    for (const pub of work.originalPublishers || []) {
      directShare += pub.publisherShare || 0;
      for (const admin of pub.administratorPublishers || []) {
        adminShare += admin.publisherShare || 0;
      }
    }

    const totalShare = directShare + adminShare;
    const storyMintable = totalShare >= 98 && work.writers.length > 0;

    return {
      isrc,
      mlcSongCode: work.songCode,
      iswc: work.iswc || '',
      writers: work.writers.map((w: any) => ({
        name: `${w.firstName || ''} ${w.lastName || ''}`.trim() || 'Unknown',
        ipi: w.ipiNumber || null,
        role: w.roleCode === 11 ? 'Composer' : 'Writer',
        share: w.writerShare || 0,
      })),
      publishers: work.originalPublishers.map((p: any) => ({
        name: p.publisherName,
        ipi: p.ipiNumber || '',
        share: p.publisherShare || 0,
        administrators: (p.administratorPublishers || []).map((a: any) => ({
          name: a.publisherName,
          ipi: a.ipiNumber || '',
          share: a.publisherShare || 0,
        })),
      })),
      totalPublisherShare: totalShare,
      storyMintable,
    };
  }
}
