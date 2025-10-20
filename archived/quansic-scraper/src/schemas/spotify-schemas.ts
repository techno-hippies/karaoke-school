import { z } from 'zod';

// Spotify Artist Schema
export const SpotifyArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  href: z.string().url().optional(),
  uri: z.string(),
  external_urls: z.object({
    spotify: z.string().url()
  }),
  type: z.literal('artist').optional()
});

// Spotify Album Schema  
export const SpotifyAlbumSchema = z.object({
  id: z.string(),
  name: z.string(),
  album_type: z.enum(['album', 'single', 'compilation', 'appears_on']),
  total_tracks: z.number(),
  release_date: z.string(),
  release_date_precision: z.enum(['year', 'month', 'day']),
  uri: z.string(),
  href: z.string().url().optional(),
  external_urls: z.object({
    spotify: z.string().url()
  }),
  images: z.array(z.object({
    url: z.string().url(),
    height: z.number().nullable(),
    width: z.number().nullable()
  })),
  artists: z.array(SpotifyArtistSchema)
});

// Spotify Track Schema
export const SpotifyTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  disc_number: z.number(),
  track_number: z.number(),
  duration_ms: z.number(),
  explicit: z.boolean(),
  is_playable: z.boolean().optional(),
  is_local: z.boolean(),
  popularity: z.number(),
  preview_url: z.string().url().nullable(),
  uri: z.string(),
  href: z.string().url(),
  external_ids: z.object({
    isrc: z.string().optional(),
    ean: z.string().optional(),
    upc: z.string().optional()
  }),
  external_urls: z.object({
    spotify: z.string().url()
  }),
  album: SpotifyAlbumSchema,
  artists: z.array(SpotifyArtistSchema),
  available_markets: z.array(z.string()).optional(),
  type: z.literal('track')
});

// Search Response Schema
export const SpotifySearchResponseSchema = z.object({
  tracks: z.object({
    items: z.array(SpotifyTrackSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number()
  })
});