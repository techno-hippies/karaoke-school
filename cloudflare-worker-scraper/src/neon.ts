/**
 * Neon Database Service
 * Unified interface to all domain-specific database operations
 */

import { neon } from '@neondatabase/serverless';
import { TikTokDB } from './db/tiktok';
import { SpotifyDB } from './db/spotify';
import { GeniusDB } from './db/genius';
import { MusicBrainzDB } from './db/musicbrainz';
import { QuansicDB } from './db/quansic';
import { KaraokeDB } from './db/karaoke';

/**
 * Unified database class that provides access to all domain operations
 * Uses composition pattern to combine domain-specific DB classes
 */
export class NeonDB {
  private sql: ReturnType<typeof neon>;

  // Domain-specific DB instances
  private tiktok: TikTokDB;
  private spotify: SpotifyDB;
  private genius: GeniusDB;
  private musicbrainz: MusicBrainzDB;
  private quansic: QuansicDB;
  private karaoke: KaraokeDB;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);

    // Initialize all domain instances with the same connection
    this.tiktok = new TikTokDB(databaseUrl);
    this.spotify = new SpotifyDB(databaseUrl);
    this.genius = new GeniusDB(databaseUrl);
    this.musicbrainz = new MusicBrainzDB(databaseUrl);
    this.quansic = new QuansicDB(databaseUrl);
    this.karaoke = new KaraokeDB(databaseUrl);
  }

  // ===== TikTok Domain =====
  upsertCreator = this.tiktok.upsertCreator.bind(this.tiktok);
  upsertVideo = this.tiktok.upsertVideo.bind(this.tiktok);
  batchUpsertVideos = this.tiktok.batchUpsertVideos.bind(this.tiktok);
  getCreatorStats = this.tiktok.getCreatorStats.bind(this.tiktok);
  getTopTrackVideos = this.tiktok.getTopTrackVideos.bind(this.tiktok);

  // ===== Spotify Domain =====
  upsertSpotifyTrack = this.spotify.upsertSpotifyTrack.bind(this.spotify);
  batchUpsertSpotifyTracks = this.spotify.batchUpsertSpotifyTracks.bind(this.spotify);
  getUnenrichedSpotifyTracks = this.spotify.getUnenrichedSpotifyTracks.bind(this.spotify);
  getUnenrichedSpotifyArtists = this.spotify.getUnenrichedSpotifyArtists.bind(this.spotify);
  upsertSpotifyArtist = this.spotify.upsertSpotifyArtist.bind(this.spotify);
  batchUpsertSpotifyArtists = this.spotify.batchUpsertSpotifyArtists.bind(this.spotify);

  // ===== Genius Domain =====
  upsertGeniusSong = this.genius.upsertGeniusSong.bind(this.genius);
  batchUpsertGeniusSongs = this.genius.batchUpsertGeniusSongs.bind(this.genius);
  getUnenrichedGeniusTracks = this.genius.getUnenrichedGeniusTracks.bind(this.genius);

  // ===== MusicBrainz Domain =====
  getUnenrichedMusicBrainzArtists = this.musicbrainz.getUnenrichedMusicBrainzArtists.bind(this.musicbrainz);
  upsertMusicBrainzArtist = this.musicbrainz.upsertMusicBrainzArtist.bind(this.musicbrainz);
  batchUpsertMusicBrainzArtists = this.musicbrainz.batchUpsertMusicBrainzArtists.bind(this.musicbrainz);
  getUnenrichedMusicBrainzRecordings = this.musicbrainz.getUnenrichedMusicBrainzRecordings.bind(this.musicbrainz);
  upsertMusicBrainzRecording = this.musicbrainz.upsertMusicBrainzRecording.bind(this.musicbrainz);
  batchUpsertMusicBrainzRecordings = this.musicbrainz.batchUpsertMusicBrainzRecordings.bind(this.musicbrainz);
  upsertMusicBrainzWork = this.musicbrainz.upsertMusicBrainzWork.bind(this.musicbrainz);
  linkWorkToRecording = this.musicbrainz.linkWorkToRecording.bind(this.musicbrainz);

  // ===== Quansic Domain =====
  getUnenrichedQuansicArtists = this.quansic.getUnenrichedQuansicArtists.bind(this.quansic);
  upsertQuansicArtist = this.quansic.upsertQuansicArtist.bind(this.quansic);
  batchUpsertQuansicArtists = this.quansic.batchUpsertQuansicArtists.bind(this.quansic);

  // ===== Karaoke Domain =====
  upsertLyrics = this.karaoke.upsertLyrics.bind(this.karaoke);
  upsertElevenLabsAlignment = this.karaoke.upsertElevenLabsAlignment.bind(this.karaoke);
  upsertKaraokeSegment = this.karaoke.upsertKaraokeSegment.bind(this.karaoke);
  updateKaraokeSegmentGrove = this.karaoke.updateKaraokeSegmentGrove.bind(this.karaoke);
  getTracksNeedingSegmentSelection = this.karaoke.getTracksNeedingSegmentSelection.bind(this.karaoke);
  getTracksNeedingWordAlignment = this.karaoke.getTracksNeedingWordAlignment.bind(this.karaoke);
}
