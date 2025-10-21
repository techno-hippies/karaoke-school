/**
 * Story Protocol IP Asset Metadata Schema
 *
 * Validation for Story Protocol metadata requirements
 */

import { z } from 'zod';

/**
 * IP Asset Creator
 */
export const IPAssetCreatorSchema = z.object({
  name: z.string().min(1),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe('Ethereum address'),
  contributionPercent: z.number().int().gte(0).lte(100),
  role: z.string().min(1),
  description: z.string().min(1),
});

export type IPAssetCreator = z.infer<typeof IPAssetCreatorSchema>;

/**
 * Original Work Reference
 */
export const OriginalWorkSchema = z.object({
  title: z.string().min(1),
  primary_artists: z.array(z.string()).min(1),
  iswc: z.string().optional().describe('ISWC (composition identifier)'),
  mlc_work_id: z.string().optional().describe('MLC Song Code'),
  genius_url: z.string().url().optional(),
});

export type OriginalWork = z.infer<typeof OriginalWorkSchema>;

/**
 * Derivative Metadata (for karaoke instrumentals)
 */
export const DerivativeMetadataSchema = z.object({
  type: z.literal('ai_generated_instrumental'),
  segment_id: z.string().min(1),
  start_time: z.number().gte(0),
  end_time: z.number().gt(0),
  duration: z.number().gt(0),
  primary_media_uri: z.string().startsWith('lens://').describe('instrumental.wav'),
  vocals_uri: z.string().startsWith('lens://').describe('Backup only'),
  alignment_uri: z.string().startsWith('lens://').optional(),
  use_case: z.literal('educational_karaoke'),
  user_interaction: z.string().min(1),
  processing: z.object({
    source_separation: z.string(),
    ai_enhancement: z.string(),
    forced_alignment: z.string(),
  }),
  ownership: z.object({
    derivative_owner: z.string(),
    ownership_percent: z.literal(100),
    mechanical_royalty_obligation: z.string(),
  }),
});

export type DerivativeMetadata = z.infer<typeof DerivativeMetadataSchema>;

/**
 * IP Asset Metadata (Story Protocol format)
 */
export const IPAssetMetadataSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  createdAt: z.string().datetime(),
  image: z.string().url().or(z.string().startsWith('lens://')),
  imageHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  creators: z.array(IPAssetCreatorSchema).min(1),
  mediaUrl: z.string().url().or(z.string().startsWith('lens://')),
  mediaHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  mediaType: z.enum(['audio/wav', 'audio/mp3', 'video/mp4']),
  ipType: z.literal('Music'),
  tags: z.array(z.string()),
  original_work: OriginalWorkSchema.optional(),
  rights_metadata: z.any().optional(), // Complex nested structure
  derivative_metadata: DerivativeMetadataSchema.optional(),
  provenance: z.object({
    created_at: z.string().datetime(),
    uploader: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    tiktok_url: z.string().url().optional(),
    copyright_type: z.string(),
  }),
}).refine(
  (data) => {
    // Validate creator percentages sum to 100
    const total = data.creators.reduce((sum, c) => sum + c.contributionPercent, 0);
    return total === 100;
  },
  { message: "Creator contribution percentages must sum to 100" }
);

export type IPAssetMetadata = z.infer<typeof IPAssetMetadataSchema>;
