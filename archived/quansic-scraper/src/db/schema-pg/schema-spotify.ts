import { pgTable, text, integer, real, timestamp, uuid, index, json } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { songs } from './schema';

// Spotify enrichment data for songs
export const spotifyTracks = pgTable('spotify_tracks', {
  id: uuid('id').defaultRandom().primaryKey(),
  songId: text('song_id').references(() => songs.id).unique(), // FK to our songs table
  
  // Spotify identifiers
  spotifyTrackId: text('spotify_track_id').unique(),
  spotifyTrackUri: text('spotify_track_uri'),
  spotifyAlbumId: text('spotify_album_id'),
  spotifyAlbumUri: text('spotify_album_uri'),
  
  // Track metadata
  cleanTitle: text('clean_title'), // Spotify's clean title
  albumName: text('album_name'),
  albumType: text('album_type'), // album, single, compilation
  releaseDate: text('release_date'),
  releaseDatePrecision: text('release_date_precision'), // year, month, day
  
  // Track details
  durationMs: integer('duration_ms'),
  explicit: integer('explicit'), // 0 or 1
  popularity: integer('popularity'), // 0-100
  trackNumber: integer('track_number'),
  discNumber: integer('disc_number'),
  totalTracks: integer('total_tracks'),
  
  // Media URLs
  previewUrl: text('preview_url'), // 30-second preview
  albumImageLarge: text('album_image_large'), // 640x640
  albumImageMedium: text('album_image_medium'), // 300x300
  albumImageSmall: text('album_image_small'), // 64x64
  
  // Geographic availability
  availableMarkets: json('available_markets').$type<string[]>(), // Array of country codes
  marketCount: integer('market_count'),
  
  // Timestamps
  fetchedAt: timestamp('fetched_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  songIdIdx: index('idx_spotify_tracks_song_id').on(table.songId),
  spotifyTrackIdIdx: index('idx_spotify_tracks_spotify_id').on(table.spotifyTrackId),
  popularityIdx: index('idx_spotify_tracks_popularity').on(table.popularity),
}));

// Spotify artist data (many-to-many with tracks)
export const spotifyArtists = pgTable('spotify_artists', {
  id: uuid('id').defaultRandom().primaryKey(),
  spotifyArtistId: text('spotify_artist_id').unique(),
  spotifyArtistUri: text('spotify_artist_uri'),
  name: text('name'),
  href: text('href'), // API endpoint
  externalUrl: text('external_url'), // Spotify web URL
  
  // Additional artist data (fetched separately)
  genres: json('genres').$type<string[]>(), // Array of genres
  popularity: integer('popularity'),
  followerCount: integer('follower_count'),
  imageUrl: text('image_url'),
  
  fetchedAt: timestamp('fetched_at').defaultNow(),
}, (table) => ({
  spotifyArtistIdIdx: index('idx_spotify_artists_spotify_id').on(table.spotifyArtistId),
}));

// Junction table for track-artist relationships
export const spotifyTrackArtists = pgTable('spotify_track_artists', {
  id: uuid('id').defaultRandom().primaryKey(),
  spotifyTrackId: text('spotify_track_id'),
  spotifyArtistId: text('spotify_artist_id'),
  artistOrder: integer('artist_order'), // Position in artist list
  isAlbumArtist: integer('is_album_artist').default(0),
}, (table) => ({
  trackIdx: index('idx_spotify_track_artists_track').on(table.spotifyTrackId),
  artistIdx: index('idx_spotify_track_artists_artist').on(table.spotifyArtistId),
}));

// Audio features from Spotify
export const spotifyAudioFeatures = pgTable('spotify_audio_features', {
  id: uuid('id').defaultRandom().primaryKey(),
  songId: text('song_id').references(() => songs.id).unique(),
  spotifyTrackId: text('spotify_track_id').unique(),
  
  // Musical characteristics
  acousticness: real('acousticness'), // 0.0 to 1.0
  danceability: real('danceability'), // 0.0 to 1.0
  energy: real('energy'), // 0.0 to 1.0
  instrumentalness: real('instrumentalness'), // 0.0 to 1.0
  liveness: real('liveness'), // 0.0 to 1.0
  loudness: real('loudness'), // -60 to 0 db
  speechiness: real('speechiness'), // 0.0 to 1.0
  valence: real('valence'), // 0.0 to 1.0 (positivity)
  tempo: real('tempo'), // BPM
  
  // Musical properties
  key: integer('key'), // 0-11 (pitch class)
  mode: integer('mode'), // 0 = minor, 1 = major
  timeSignature: integer('time_signature'), // 3-7
  
  fetchedAt: timestamp('fetched_at').defaultNow(),
}, (table) => ({
  songIdIdx: index('idx_spotify_audio_features_song_id').on(table.songId),
  spotifyTrackIdIdx: index('idx_spotify_audio_features_spotify_id').on(table.spotifyTrackId),
}));