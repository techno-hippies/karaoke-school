import { pgTable, text, integer, timestamp, uuid, index, json } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { songs } from './schema';

// Genius track data
export const geniusTracks = pgTable('genius_tracks', {
  id: uuid('id').defaultRandom().primaryKey(),
  songId: text('song_id').references(() => songs.id).unique(),
  geniusId: text('genius_id').unique(),
  
  // Basic metadata
  title: text('title'),
  fullTitle: text('full_title'),
  artistNames: text('artist_names'),
  
  // Engagement metrics
  pageviews: integer('pageviews'),
  hot: integer('hot').default(0),
  
  // Song metadata
  lyricsState: text('lyrics_state'), // complete, incomplete, unreleased
  releaseDate: text('release_date'),
  recordingLocation: text('recording_location'),
  description: text('description'),
  
  // URLs and images
  url: text('url'),
  songArtImageUrl: text('song_art_image_url'),
  
  // Genre/tags
  primaryTag: text('primary_tag'),
  tags: json('tags').$type<string[]>(), // Array of tag names
  
  // Timestamps
  fetchedAt: timestamp('fetched_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  songIdIdx: index('idx_genius_tracks_song_id').on(table.songId),
  geniusIdIdx: index('idx_genius_tracks_genius_id').on(table.geniusId),
  pageviewsIdx: index('idx_genius_tracks_pageviews').on(table.pageviews),
}));

// Genius artist data
export const geniusArtists = pgTable('genius_artists', {
  id: uuid('id').defaultRandom().primaryKey(),
  geniusArtistId: text('genius_artist_id').unique(),
  name: text('name'),
  imageUrl: text('image_url'),
  isVerified: integer('is_verified').default(0),
  url: text('url'),
  
  fetchedAt: timestamp('fetched_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  geniusArtistIdIdx: index('idx_genius_artists_genius_id').on(table.geniusArtistId),
}));

// Genius album data
export const geniusAlbums = pgTable('genius_albums', {
  id: uuid('id').defaultRandom().primaryKey(),
  geniusAlbumId: text('genius_album_id').unique(),
  name: text('name'),
  artistName: text('artist_name'),
  releaseDate: text('release_date'),
  coverArtUrl: text('cover_art_url'),
  url: text('url'),
  
  fetchedAt: timestamp('fetched_at').defaultNow(),
}, (table) => ({
  geniusAlbumIdIdx: index('idx_genius_albums_genius_id').on(table.geniusAlbumId),
}));

// Song credits (producers, writers, featured artists)
export const geniusSongCredits = pgTable('genius_song_credits', {
  id: uuid('id').defaultRandom().primaryKey(),
  songId: text('song_id').references(() => songs.id),
  geniusArtistId: text('genius_artist_id'),
  role: text('role'), // producer, writer, featured, publisher
  creditedAs: text('credited_as'), // How they're credited
  orderIndex: integer('order_index'),
}, (table) => ({
  songIdIdx: index('idx_genius_credits_song_id').on(table.songId),
  artistIdIdx: index('idx_genius_credits_artist_id').on(table.geniusArtistId),
  roleIdx: index('idx_genius_credits_role').on(table.role),
}));

// Publisher information
export const geniusPublishers = pgTable('genius_publishers', {
  id: uuid('id').defaultRandom().primaryKey(),
  geniusPublisherId: text('genius_publisher_id').unique(),
  name: text('name'),
  url: text('url'),
  
  fetchedAt: timestamp('fetched_at').defaultNow(),
}, (table) => ({
  publisherIdIdx: index('idx_genius_publishers_id').on(table.geniusPublisherId),
}));

// Media links (Spotify, Apple Music, YouTube, etc.)
export const geniusMediaLinks = pgTable('genius_media_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  songId: text('song_id').references(() => songs.id),
  provider: text('provider'), // spotify, apple_music, youtube, soundcloud
  url: text('url'),
  nativeUri: text('native_uri'), // spotify:track:xxx, etc.
  startTime: integer('start_time'), // For YouTube timestamps
}, (table) => ({
  songIdIdx: index('idx_genius_media_links_song_id').on(table.songId),
  providerIdx: index('idx_genius_media_links_provider').on(table.provider),
}));

// Song relationships (samples, covers, remixes, interpolations)
export const geniusSongRelationships = pgTable('genius_song_relationships', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceSongId: text('source_song_id').references(() => songs.id),
  targetGeniusId: text('target_genius_id'),
  targetTitle: text('target_title'),
  targetArtist: text('target_artist'),
  relationshipType: text('relationship_type'), // samples, sampled_in, interpolates, cover_of, remix_of
  url: text('url'),
  
  fetchedAt: timestamp('fetched_at').defaultNow(),
}, (table) => ({
  sourceIdIdx: index('idx_genius_relationships_source').on(table.sourceSongId),
  typeIdx: index('idx_genius_relationships_type').on(table.relationshipType),
}));