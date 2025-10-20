import { pgTable, text, integer, timestamp, real, uuid, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Artists table
export const artists = pgTable('artists', {
  id: text('id').primaryKey(), // Using ISNI or generated ID
  name: text('name').notNull(),
  type: text('type'), // Person, Group, etc.
  nationality: text('nationality'),
  birthDate: text('birth_date'),
  deathDate: text('death_date'),
  isni: text('isni').unique(),
  ipi: text('ipi'),
  spotifyId: text('spotify_id'),
  musicbrainzId: text('musicbrainz_id'),
  discogsId: text('discogs_id'),
  image: text('image'),
  comments: text('comments'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  isniIdx: index('idx_artists_isni').on(table.isni),
  nameIdx: index('idx_artists_name').on(table.name),
}));

// Releases table (Albums, EPs, Singles)
export const releases = pgTable('releases', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  artistId: text('artist_id').references(() => artists.id),
  type: text('type'), // Album, EP, Single, Compilation
  upc: text('upc').unique(),
  ean: text('ean'),
  year: text('year'),
  label: text('label'),
  cover: text('cover'),
  discogsMasterId: text('discogs_master_id'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  upcIdx: index('idx_releases_upc').on(table.upc),
  artistIdx: index('idx_releases_artist_id').on(table.artistId),
}));

// Songs/Recordings table
export const songs = pgTable('songs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  artistId: text('artist_id').references(() => artists.id),
  releaseId: text('release_id').references(() => releases.id),
  isrc: text('isrc').unique(),
  iswc: text('iswc'),
  duration: text('duration'), // Format: "4:15"
  durationMs: integer('duration_ms'), // Duration in milliseconds
  year: text('year'),
  trackNumber: integer('track_number'),
  spotifyVerified: integer('spotify_verified').default(0),
  geniusVerified: integer('genius_verified').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  isrcIdx: index('idx_songs_isrc').on(table.isrc),
  artistIdx: index('idx_songs_artist_id').on(table.artistId),
  releaseIdx: index('idx_songs_release_id').on(table.releaseId),
  spotifyVerifiedIdx: index('idx_songs_spotify_verified').on(table.spotifyVerified),
  geniusVerifiedIdx: index('idx_songs_genius_verified').on(table.geniusVerified),
}));

// Artist aliases/variants table
export const artistAliases = pgTable('artist_aliases', {
  id: uuid('id').defaultRandom().primaryKey(),
  artistId: text('artist_id').references(() => artists.id),
  alias: text('alias').notNull(),
  type: text('type'), // 'aka', 'variant', 'legal_name', etc.
});

// Relationships between artists
export const artistRelationships = pgTable('artist_relationships', {
  id: uuid('id').defaultRandom().primaryKey(),
  artistId: text('artist_id').references(() => artists.id),
  relatedArtistId: text('related_artist_id').references(() => artists.id),
  relationshipType: text('relationship_type'), // 'member_of', 'collaborated_with', etc.
  startDate: text('start_date'),
  endDate: text('end_date'),
});

// Royalty splits table
export const royaltySplits = pgTable('royalty_splits', {
  id: uuid('id').defaultRandom().primaryKey(),
  songId: text('song_id').references(() => songs.id),
  payee: text('payee').notNull(),
  percentage: real('percentage').notNull(),
  role: text('role'), // 'performer', 'writer', 'producer', etc.
  verifiedBy: text('verified_by'),
  verificationDate: text('verification_date'),
  source: text('source'), // Where this data came from
});

// Ingestion log table
export const ingestionLog = pgTable('ingestion_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: text('source').notNull(), // 'scraper', 'manual', 'api', etc.
  entityType: text('entity_type').notNull(), // 'artist', 'release', 'song'
  entityId: text('entity_id'),
  status: text('status').notNull(), // 'success', 'failed', 'skipped'
  message: text('message'),
  rawData: text('raw_data'), // JSON string of original data
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  createdAtIdx: index('idx_ingestion_log_created_at').on(table.createdAt),
  statusIdx: index('idx_ingestion_log_status').on(table.status),
}));

// Export all tables
export const schema = {
  artists,
  releases,
  songs,
  artistAliases,
  artistRelationships,
  royaltySplits,
  ingestionLog,
};