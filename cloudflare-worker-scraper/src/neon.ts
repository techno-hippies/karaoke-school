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

  // Method declarations (will be bound in constructor)
  upsertCreator!: TikTokDB['upsertCreator'];
  upsertVideo!: TikTokDB['upsertVideo'];
  batchUpsertVideos!: TikTokDB['batchUpsertVideos'];
  getCreatorStats!: TikTokDB['getCreatorStats'];
  getTopTrackVideos!: TikTokDB['getTopTrackVideos'];

  upsertSpotifyTrack!: SpotifyDB['upsertSpotifyTrack'];
  batchUpsertSpotifyTracks!: SpotifyDB['batchUpsertSpotifyTracks'];
  getUnenrichedSpotifyTracks!: SpotifyDB['getUnenrichedSpotifyTracks'];
  getUnenrichedSpotifyArtists!: SpotifyDB['getUnenrichedSpotifyArtists'];
  upsertSpotifyArtist!: SpotifyDB['upsertSpotifyArtist'];
  batchUpsertSpotifyArtists!: SpotifyDB['batchUpsertSpotifyArtists'];

  upsertGeniusSong!: GeniusDB['upsertGeniusSong'];
  batchUpsertGeniusSongs!: GeniusDB['batchUpsertGeniusSongs'];
  getUnenrichedGeniusTracks!: GeniusDB['getUnenrichedGeniusTracks'];

  getUnenrichedMusicBrainzArtists!: MusicBrainzDB['getUnenrichedMusicBrainzArtists'];
  upsertMusicBrainzArtist!: MusicBrainzDB['upsertMusicBrainzArtist'];
  batchUpsertMusicBrainzArtists!: MusicBrainzDB['batchUpsertMusicBrainzArtists'];
  getUnenrichedMusicBrainzRecordings!: MusicBrainzDB['getUnenrichedMusicBrainzRecordings'];
  upsertMusicBrainzRecording!: MusicBrainzDB['upsertMusicBrainzRecording'];
  batchUpsertMusicBrainzRecordings!: MusicBrainzDB['batchUpsertMusicBrainzRecordings'];
  upsertMusicBrainzWork!: MusicBrainzDB['upsertMusicBrainzWork'];
  linkWorkToRecording!: MusicBrainzDB['linkWorkToRecording'];

  getUnenrichedQuansicArtists!: QuansicDB['getUnenrichedQuansicArtists'];
  upsertQuansicArtist!: QuansicDB['upsertQuansicArtist'];
  batchUpsertQuansicArtists!: QuansicDB['batchUpsertQuansicArtists'];

  upsertLyrics!: KaraokeDB['upsertLyrics'];
  upsertElevenLabsAlignment!: KaraokeDB['upsertElevenLabsAlignment'];
  upsertKaraokeSegment!: KaraokeDB['upsertKaraokeSegment'];
  updateKaraokeSegmentGrove!: KaraokeDB['updateKaraokeSegmentGrove'];
  getTracksNeedingSegmentSelection!: KaraokeDB['getTracksNeedingSegmentSelection'];
  getTracksNeedingWordAlignment!: KaraokeDB['getTracksNeedingWordAlignment'];

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);

    // Initialize all domain instances with the same connection
    this.tiktok = new TikTokDB(databaseUrl);
    this.spotify = new SpotifyDB(databaseUrl);
    this.genius = new GeniusDB(databaseUrl);
    this.musicbrainz = new MusicBrainzDB(databaseUrl);
    this.quansic = new QuansicDB(databaseUrl);
    this.karaoke = new KaraokeDB(databaseUrl);

    // Bind all methods after domain instances are created
    // TikTok Domain
    this.upsertCreator = this.tiktok.upsertCreator.bind(this.tiktok);
    this.upsertVideo = this.tiktok.upsertVideo.bind(this.tiktok);
    this.batchUpsertVideos = this.tiktok.batchUpsertVideos.bind(this.tiktok);
    this.getCreatorStats = this.tiktok.getCreatorStats.bind(this.tiktok);
    this.getTopTrackVideos = this.tiktok.getTopTrackVideos.bind(this.tiktok);

    // Spotify Domain
    this.upsertSpotifyTrack = this.spotify.upsertSpotifyTrack.bind(this.spotify);
    this.batchUpsertSpotifyTracks = this.spotify.batchUpsertSpotifyTracks.bind(this.spotify);
    this.getUnenrichedSpotifyTracks = this.spotify.getUnenrichedSpotifyTracks.bind(this.spotify);
    this.getUnenrichedSpotifyArtists = this.spotify.getUnenrichedSpotifyArtists.bind(this.spotify);
    this.upsertSpotifyArtist = this.spotify.upsertSpotifyArtist.bind(this.spotify);
    this.batchUpsertSpotifyArtists = this.spotify.batchUpsertSpotifyArtists.bind(this.spotify);

    // Genius Domain
    this.upsertGeniusSong = this.genius.upsertGeniusSong.bind(this.genius);
    this.batchUpsertGeniusSongs = this.genius.batchUpsertGeniusSongs.bind(this.genius);
    this.getUnenrichedGeniusTracks = this.genius.getUnenrichedGeniusTracks.bind(this.genius);

    // MusicBrainz Domain
    this.getUnenrichedMusicBrainzArtists = this.musicbrainz.getUnenrichedMusicBrainzArtists.bind(this.musicbrainz);
    this.upsertMusicBrainzArtist = this.musicbrainz.upsertMusicBrainzArtist.bind(this.musicbrainz);
    this.batchUpsertMusicBrainzArtists = this.musicbrainz.batchUpsertMusicBrainzArtists.bind(this.musicbrainz);
    this.getUnenrichedMusicBrainzRecordings = this.musicbrainz.getUnenrichedMusicBrainzRecordings.bind(this.musicbrainz);
    this.upsertMusicBrainzRecording = this.musicbrainz.upsertMusicBrainzRecording.bind(this.musicbrainz);
    this.batchUpsertMusicBrainzRecordings = this.musicbrainz.batchUpsertMusicBrainzRecordings.bind(this.musicbrainz);
    this.upsertMusicBrainzWork = this.musicbrainz.upsertMusicBrainzWork.bind(this.musicbrainz);
    this.linkWorkToRecording = this.musicbrainz.linkWorkToRecording.bind(this.musicbrainz);

    // Quansic Domain
    this.getUnenrichedQuansicArtists = this.quansic.getUnenrichedQuansicArtists.bind(this.quansic);
    this.upsertQuansicArtist = this.quansic.upsertQuansicArtist.bind(this.quansic);
    this.batchUpsertQuansicArtists = this.quansic.batchUpsertQuansicArtists.bind(this.quansic);

    // Karaoke Domain
    this.upsertLyrics = this.karaoke.upsertLyrics.bind(this.karaoke);
    this.upsertElevenLabsAlignment = this.karaoke.upsertElevenLabsAlignment.bind(this.karaoke);
    this.upsertKaraokeSegment = this.karaoke.upsertKaraokeSegment.bind(this.karaoke);
    this.updateKaraokeSegmentGrove = this.karaoke.updateKaraokeSegmentGrove.bind(this.karaoke);
    this.getTracksNeedingSegmentSelection = this.karaoke.getTracksNeedingSegmentSelection.bind(this.karaoke);
    this.getTracksNeedingWordAlignment = this.karaoke.getTracksNeedingWordAlignment.bind(this.karaoke);
  }
}
