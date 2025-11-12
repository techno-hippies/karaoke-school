import { z } from 'zod';

/**
 * Minimal validation for manual Spotify ingestion.
 * We only enforce the fields that the downstream pipeline needs
 * (album art + at least one artist) so we can provide actionable errors.
 */
export const ManualSpotifyTrackSchema = z.object({
  spotify_track_id: z.string().min(1, 'spotify_track_id is required'),
  title: z.string().min(1, 'title is required'),
  album: z.string().min(1, 'album title is required'),
  image_url: z
    .string({ required_error: 'album image is required' })
    .url('album image must be an HTTPS URL'),
  artists: z
    .array(
      z.object({
        id: z.string().min(1, 'artist id is required'),
        name: z.string().min(1, 'artist name is required'),
      })
    )
    .min(1, 'at least one artist is required'),
});

export type ManualSpotifyTrackShape = z.infer<typeof ManualSpotifyTrackSchema>;
