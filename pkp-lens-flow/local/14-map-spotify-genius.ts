#!/usr/bin/env bun
/**
 * Step 8: Map Spotify Tracks to Genius IDs
 *
 * Matches Spotify tracks to Genius songs using two-phase approach:
 * 1. Direct Spotify ID match from Genius media array (100% confidence)
 * 2. Fuzzy metadata matching (title/artist/album with weighted scoring)
 *
 * Prerequisites:
 * - Manifest with Spotify metadata (data/videos/{handle}/manifest.json)
 *
 * Usage:
 *   bun run map-spotify-genius --creator @charlidamelio
 *   bun run map-spotify-genius --creator @charlidamelio --min-confidence 0.85
 *
 * Output:
 *   Updated manifest with Genius IDs and match confidence scores
 */

import { readFile, writeFile } from 'fs/promises';
import { parseArgs } from 'util';
import path from 'path';
import { compareTwoStrings } from 'string-similarity';

// Parse CLI args
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    creator: { type: 'string', short: 'c' },
    minConfidence: { type: 'string', default: '0.70' },
  },
});

interface SpotifyMetadata {
  name: string;
  artists: string[];
  album: string;
  releaseDate: string;
}

interface GeniusSearchResult {
  genius_id: number;
  title: string;
  title_with_featured: string;
  artist: string;
  artist_id?: number;
  genius_slug: string | null;
  url: string;
  artwork_thumbnail: string | null;
  lyrics_state: string;
  _score: number;
}

interface GeniusSongData {
  id: number;
  title: string;
  title_with_featured: string;
  artist: string;
  artist_id?: number;
  path: string;
  url: string;
  song_art_image_url: string;
  song_art_image_thumbnail_url: string;
  release_date_for_display: string;
  spotify_uuid?: string | null;
  media: Array<{
    provider: string;
    url: string;
    type: string;
    native_uri?: string;
  }>;
  featured_artists: Array<{ id: number; name: string; url: string }>;
  producer_artists: Array<{ id: number; name: string; url: string }>;
  writer_artists: Array<{ id: number; name: string; url: string }>;
}

interface MatchResult {
  geniusId: number;
  confidence: number;
  matchType: 'spotify_id' | 'fuzzy_metadata';
  matchDetails: {
    titleScore?: number;
    artistScore?: number;
    albumScore?: number;
    spotifyIdMatched?: boolean;
  };
  geniusData: {
    title: string;
    artist: string;
    url: string;
    slug: string;
    artwork?: string;
  };
}

interface VideoData {
  postId: string;
  music: {
    title: string;
    spotifyTrackId: string | null;
    spotify?: {
      isrc?: string;
      metadata?: SpotifyMetadata;
      fetchedAt?: string;
    };
    genius?: {
      id: number;
      url: string;
      slug: string;
      title: string;
      artist: string;
      matchConfidence: number;
      matchType: string;
      matchDetails: any;
      fetchedAt: string;
    };
  };
  [key: string]: any;
}

interface Manifest {
  videos: VideoData[];
  [key: string]: any;
}

class GeniusMatcher {
  private geniusApiKey = 'z0-uHScJhlvY7rB_HwThSEZhjpmSzlWMnBhaby3tPtqJpfOeQwZ1cc5OG1bdegV7';

  /**
   * Normalize string for fuzzy matching
   * - Lowercase
   * - Remove parentheses and brackets content
   * - Remove featuring artists
   * - Remove special characters
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, '') // Remove (anything)
      .replace(/\s+(feat\.|ft\.|featuring)\s+.*/i, '') // Remove feat. ...
      .replace(/[^\w\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Extract Spotify track ID from Genius media array
   */
  private extractSpotifyIdFromMedia(media: GeniusSongData['media']): string | null {
    const spotifyMedia = media.find(
      m => m.provider === 'spotify' && m.type === 'audio'
    );

    if (!spotifyMedia) return null;

    // Try native_uri first (format: "spotify:track:TRACK_ID")
    if (spotifyMedia.native_uri) {
      const match = spotifyMedia.native_uri.match(/spotify:track:([A-Za-z0-9]+)/);
      if (match) return match[1];
    }

    // Try URL format (format: "https://open.spotify.com/track/TRACK_ID")
    if (spotifyMedia.url) {
      const match = spotifyMedia.url.match(/track\/([A-Za-z0-9]+)/);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Search Genius API for songs
   */
  async searchGenius(query: string, limit: number = 10): Promise<GeniusSearchResult[]> {
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}&per_page=${limit}`;

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': 'Bearer ' + this.geniusApiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Genius search failed: ${response.status}`);
    }

    const data: any = await response.json();

    if (!data.response?.hits) return [];

    return data.response.hits.map((hit: any) => {
      const result = hit.result;
      let artwork_thumbnail = null;
      if (result.song_art_image_thumbnail_url) {
        artwork_thumbnail = result.song_art_image_thumbnail_url;
      } else if (result.header_image_thumbnail_url) {
        artwork_thumbnail = result.header_image_thumbnail_url;
      }

      return {
        genius_id: result.id,
        title: result.title,
        title_with_featured: result.title_with_featured,
        artist: result.primary_artist_names || result.artist_names,
        artist_id: result.primary_artist?.id,
        genius_slug: result.path ? result.path.replace(/^\//, '') : null,
        url: result.url,
        artwork_thumbnail,
        lyrics_state: result.lyrics_state,
        _score: hit.highlights?.length || 0
      };
    });
  }

  /**
   * Fetch full song metadata from Genius
   */
  async getSongMetadata(songId: number): Promise<GeniusSongData | null> {
    const songUrl = `https://api.genius.com/songs/${songId}?text_format=plain`;

    const response = await fetch(songUrl, {
      headers: {
        'Authorization': 'Bearer ' + this.geniusApiKey
      }
    });

    if (!response.ok) {
      console.error(`   ⚠️  Failed to fetch song ${songId}: ${response.status}`);
      return null;
    }

    const data: any = await response.json();
    if (!data.response?.song) return null;

    const song = data.response.song;
    return {
      id: song.id,
      title: song.title,
      title_with_featured: song.title_with_featured,
      artist: song.primary_artist?.name || song.artist_names,
      artist_id: song.primary_artist?.id,
      path: song.path,
      url: song.url,
      song_art_image_url: song.song_art_image_url,
      song_art_image_thumbnail_url: song.song_art_image_thumbnail_url,
      release_date_for_display: song.release_date_for_display,
      spotify_uuid: song.spotify_uuid || null,
      media: (song.media || []).map((m: any) => ({
        provider: m.provider,
        url: m.url,
        type: m.type,
        native_uri: m.native_uri
      })),
      featured_artists: (song.featured_artists || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        url: a.url
      })),
      producer_artists: (song.producer_artists || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        url: a.url
      })),
      writer_artists: (song.writer_artists || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        url: a.url
      }))
    };
  }

  /**
   * Phase 1: Try to match via Spotify ID in Genius media array
   */
  async matchBySpotifyId(
    spotifyTrackId: string,
    searchResults: GeniusSearchResult[]
  ): Promise<MatchResult | null> {
    console.log(`   🔍 Phase 1: Checking for direct Spotify ID match...`);

    // Fetch full metadata for top results and check media array
    for (const result of searchResults.slice(0, 5)) {
      const songData = await this.getSongMetadata(result.genius_id);
      if (!songData) continue;

      const geniusSpotifyId = this.extractSpotifyIdFromMedia(songData.media);

      if (geniusSpotifyId === spotifyTrackId) {
        console.log(`   ✅ Found exact Spotify ID match in Genius song ${result.genius_id}`);
        return {
          geniusId: songData.id,
          confidence: 1.0,
          matchType: 'spotify_id',
          matchDetails: {
            spotifyIdMatched: true
          },
          geniusData: {
            title: songData.title,
            artist: songData.artist,
            url: songData.url,
            slug: songData.path.replace(/^\//, ''),
            artwork: songData.song_art_image_thumbnail_url
          }
        };
      }

      // Small delay between API calls
      await this.sleep(300);
    }

    console.log(`   ℹ️  No direct Spotify ID match found`);
    return null;
  }

  /**
   * Phase 2: Fuzzy metadata matching with weighted scoring
   */
  async matchByMetadata(
    spotifyMetadata: SpotifyMetadata,
    searchResults: GeniusSearchResult[]
  ): Promise<MatchResult | null> {
    console.log(`   🔍 Phase 2: Fuzzy metadata matching...`);

    const normalizedSpotifyTitle = this.normalizeString(spotifyMetadata.name);
    const normalizedSpotifyArtists = spotifyMetadata.artists.map(a => this.normalizeString(a));

    let bestMatch: MatchResult | null = null;
    let bestScore = 0;

    for (const result of searchResults) {
      const normalizedGeniusTitle = this.normalizeString(result.title);
      const normalizedGeniusArtist = this.normalizeString(result.artist);

      // Calculate title similarity
      const titleScore = compareTwoStrings(normalizedSpotifyTitle, normalizedGeniusTitle);

      // Calculate artist similarity (max score across all Spotify artists)
      const artistScore = Math.max(
        ...normalizedSpotifyArtists.map(spotifyArtist =>
          compareTwoStrings(spotifyArtist, normalizedGeniusArtist)
        )
      );

      // Weighted total score (title 45%, artist 40%, base 15%)
      const totalScore = (0.45 * titleScore) + (0.40 * artistScore) + 0.15;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestMatch = {
          geniusId: result.genius_id,
          confidence: totalScore,
          matchType: 'fuzzy_metadata',
          matchDetails: {
            titleScore,
            artistScore
          },
          geniusData: {
            title: result.title,
            artist: result.artist,
            url: result.url,
            slug: result.genius_slug || '',
            artwork: result.artwork_thumbnail || undefined
          }
        };
      }
    }

    if (bestMatch) {
      console.log(`   📊 Best fuzzy match: ${bestMatch.geniusData.title} by ${bestMatch.geniusData.artist}`);
      console.log(`      Confidence: ${(bestMatch.confidence * 100).toFixed(1)}% (title: ${((bestMatch.matchDetails.titleScore || 0) * 100).toFixed(1)}%, artist: ${((bestMatch.matchDetails.artistScore || 0) * 100).toFixed(1)}%)`);
    }

    return bestMatch;
  }

  /**
   * Main matching logic with two-phase approach
   */
  async matchSpotifyToGenius(
    spotifyTrackId: string,
    spotifyMetadata: SpotifyMetadata,
    minConfidence: number = 0.70
  ): Promise<MatchResult | null> {
    // Build search query
    const query = `${spotifyMetadata.artists[0]} ${spotifyMetadata.name}`;
    console.log(`   🔎 Searching Genius: "${query}"`);

    // Search Genius
    const searchResults = await this.searchGenius(query, 10);

    if (searchResults.length === 0) {
      console.log(`   ❌ No Genius search results found`);
      return null;
    }

    console.log(`   ℹ️  Found ${searchResults.length} Genius results`);

    // Phase 1: Try Spotify ID match
    const spotifyIdMatch = await this.matchBySpotifyId(spotifyTrackId, searchResults);
    if (spotifyIdMatch) {
      return spotifyIdMatch;
    }

    // Phase 2: Fuzzy metadata match
    const metadataMatch = await this.matchByMetadata(spotifyMetadata, searchResults);

    if (!metadataMatch) {
      console.log(`   ❌ No match found`);
      return null;
    }

    if (metadataMatch.confidence < minConfidence) {
      console.log(`   ⚠️  Match confidence ${(metadataMatch.confidence * 100).toFixed(1)}% below threshold ${(minConfidence * 100).toFixed(1)}%`);
      return null;
    }

    return metadataMatch;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function mapSpotifyToGenius(tiktokHandle: string, minConfidence: number): Promise<void> {
  console.log('\n🎵 Step 8: Map Spotify Tracks to Genius IDs');
  console.log('═══════════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // Load manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  console.log(`📂 Loading manifest: ${manifestPath}`);

  const manifestRaw = await readFile(manifestPath, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestRaw);

  const videos = manifest.videos;
  console.log(`   Found ${videos.length} videos\n`);

  // Create matcher
  const matcher = new GeniusMatcher();

  // Process videos
  console.log('🔍 Matching Spotify tracks to Genius...\n');

  let matchedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const trackId = video.music.spotifyTrackId;
    const spotifyMetadata = video.music.spotify?.metadata;

    console.log(`\n📹 Video ${i + 1}/${videos.length}: ${video.music.title}`);

    if (!trackId || !spotifyMetadata) {
      console.log(`   ⚠️  Skipping: No Spotify data`);
      skippedCount++;
      continue;
    }

    console.log(`   • Spotify: ${spotifyMetadata.name} by ${spotifyMetadata.artists.join(', ')}`);

    try {
      // Match to Genius
      const match = await matcher.matchSpotifyToGenius(trackId, spotifyMetadata, minConfidence);

      if (match) {
        // Update manifest
        video.music.genius = {
          id: match.geniusId,
          url: match.geniusData.url,
          slug: match.geniusData.slug,
          title: match.geniusData.title,
          artist: match.geniusData.artist,
          artwork: match.geniusData.artwork,
          matchConfidence: match.confidence,
          matchType: match.matchType,
          matchDetails: match.matchDetails,
          fetchedAt: new Date().toISOString()
        };

        console.log(`   ✅ Matched to Genius ID ${match.geniusId}`);
        console.log(`      ${match.geniusData.title} by ${match.geniusData.artist}`);
        console.log(`      Confidence: ${(match.confidence * 100).toFixed(1)}% (${match.matchType})`);
        matchedCount++;
      } else {
        console.log(`   ❌ No suitable match found`);
        failedCount++;
      }

      // Rate limit protection
      await matcher['sleep'](500);

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      failedCount++;
    }
  }

  // Save updated manifest
  console.log('\n💾 Saving updated manifest...');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   ✅ Manifest updated: ${manifestPath}\n`);

  // Summary
  console.log('═══════════════════════════════════════════');
  console.log('✨ Spotify → Genius Mapping Complete!');
  console.log(`\n📊 Summary:`);
  console.log(`   Matched:  ${matchedCount}/${videos.length}`);
  console.log(`   Skipped:  ${skippedCount}/${videos.length}`);
  console.log(`   Failed:   ${failedCount}/${videos.length}`);

  if (matchedCount > 0) {
    const highConfidenceCount = videos.filter(v =>
      v.music.genius && v.music.genius.matchConfidence >= 0.85
    ).length;

    console.log(`\n   High confidence (≥85%): ${highConfidenceCount}`);
    console.log(`   Medium confidence (70-84%): ${matchedCount - highConfidenceCount}`);
  }

  console.log('');
}

async function main() {
  try {
    const creator = values.creator;
    const minConfidence = parseFloat(values.minConfidence || '0.70');

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run map-spotify-genius --creator @charlidamelio\n');
      console.log('Options:');
      console.log('  --min-confidence   Minimum match confidence (default: 0.70)\n');
      process.exit(1);
    }

    if (minConfidence < 0 || minConfidence > 1) {
      console.error('\n❌ Error: --min-confidence must be between 0 and 1\n');
      process.exit(1);
    }

    await mapSpotifyToGenius(creator, minConfidence);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
