import { z } from 'zod';

// Genius Artist Schema
export const GeniusArtistSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string().url(),
  api_path: z.string(),
  header_image_url: z.string().url(),
  image_url: z.string().url(),
  is_meme_verified: z.boolean(),
  is_verified: z.boolean(),
  iq: z.number().optional()
});

// Media Link Schema
export const GeniusMediaSchema = z.object({
  provider: z.enum(['youtube', 'spotify', 'soundcloud', 'apple_music']),
  type: z.enum(['video', 'audio']),
  url: z.string().url().optional(),
  native_uri: z.string().optional(),
  start: z.number().optional(),
  attribution: z.string().optional()
});

// Custom Performance Schema (Production Credits)
export const GeniusCustomPerformanceSchema = z.object({
  label: z.string(), // "Publisher", "Mixing Engineer", "Guitar", etc.
  artists: z.array(GeniusArtistSchema)
});

// Song Relationship Schema
export const GeniusSongRelationshipSchema = z.object({
  relationship_type: z.string(), // Just accept any string for now
  type: z.string(),
  url: z.string().nullable().optional(),
  songs: z.array(z.object({
    id: z.number(),
    title: z.string(),
    title_with_featured: z.string(),
    url: z.string().url(),
    primary_artist_names: z.string(),
    primary_artist: GeniusArtistSchema
  }))
});

// Album Schema
export const GeniusAlbumSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string().url(),
  api_path: z.string(),
  cover_art_url: z.string().url(),
  full_title: z.string(),
  release_date_for_display: z.string().nullable(),
  artist: GeniusArtistSchema,
  primary_artists: z.array(GeniusArtistSchema).optional()
});

// Complete Song Details Schema
export const GeniusSongDetailsSchema = z.object({
  id: z.number(),
  title: z.string(),
  title_with_featured: z.string(),
  full_title: z.string(),
  url: z.string().url(),
  path: z.string(),
  api_path: z.string(),
  
  // Metadata
  artist_names: z.string(),
  primary_artist_names: z.string(),
  language: z.string().nullable(),
  lyrics_state: z.enum(['complete', 'incomplete', 'unreleased']),
  lyrics_owner_id: z.number().nullable(),
  
  // Counts
  annotation_count: z.number(),
  pyongs_count: z.number().nullable(),
  
  // Images
  header_image_url: z.string().url(),
  header_image_thumbnail_url: z.string().url(),
  song_art_image_url: z.string().url(),
  song_art_image_thumbnail_url: z.string().url(),
  
  // Colors for UI
  song_art_primary_color: z.string().nullable(),
  song_art_secondary_color: z.string().nullable(),
  song_art_text_color: z.string().nullable(),
  
  // Dates
  release_date: z.string().nullable(),
  release_date_for_display: z.string().nullable(),
  recording_location: z.string().nullable(),
  
  // Platform IDs
  apple_music_id: z.string().nullable().optional(),
  apple_music_player_url: z.string().url().nullable().optional(),
  spotify_uuid: z.string().nullable().optional(),
  soundcloud_url: z.string().url().nullable().optional(),
  youtube_url: z.string().url().nullable().optional(),
  
  // Embed
  embed_content: z.string().optional(),
  
  // Stats
  stats: z.object({
    unreviewed_annotations: z.number().optional(),
    hot: z.boolean().optional(),
    pageviews: z.number().optional()
  }).optional(),
  
  // Description
  description: z.object({
    plain: z.string().optional()
  }).optional(),
  
  // Relationships
  album: GeniusAlbumSchema.nullable(),
  custom_performances: z.array(GeniusCustomPerformanceSchema).optional(),
  featured_artists: z.array(GeniusArtistSchema).optional(),
  primary_artist: GeniusArtistSchema,
  primary_artists: z.array(GeniusArtistSchema).optional(),
  producer_artists: z.array(GeniusArtistSchema).optional(),
  writer_artists: z.array(GeniusArtistSchema).optional(),
  media: z.array(GeniusMediaSchema).optional(),
  song_relationships: z.array(GeniusSongRelationshipSchema).optional()
});

// Search Result Schema
export const GeniusSearchResultSchema = z.object({
  id: z.number(),
  title: z.string(),
  title_with_featured: z.string(),
  artist_names: z.string(),
  primary_artist: GeniusArtistSchema,
  url: z.string().url(),
  path: z.string(),
  song_art_image_url: z.string().url().optional(),
  lyrics_state: z.string().optional(),
  stats: z.object({
    pageviews: z.number().optional(),
    hot: z.boolean().optional()
  }).optional()
});

// API Response Schemas
export const GeniusSearchResponseSchema = z.object({
  response: z.object({
    hits: z.array(z.object({
      result: GeniusSearchResultSchema
    }))
  })
});

export const GeniusSongResponseSchema = z.object({
  response: z.object({
    song: GeniusSongDetailsSchema
  })
});