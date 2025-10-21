/**
 * Creator Schema
 *
 * Validation for TikTok creator identities and video manifests
 */

import { z } from 'zod';
import { MLCDataSchema } from './mlc.js';

/**
 * Creator PKP
 */
export const CreatorPKPSchema = z.object({
  pkpPublicKey: z.string().min(1),
  pkpEthAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  pkpTokenId: z.string().min(1),
  ownerEOA: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  network: z.string().min(1),
  mintedAt: z.string().datetime(),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

export type CreatorPKP = z.infer<typeof CreatorPKPSchema>;

/**
 * Creator Social Identifiers
 */
export const CreatorIdentifiersSchema = z.object({
  tiktokHandle: z.string().min(1).describe('TikTok handle (without @)'),
  tiktokUserId: z.string().optional().describe('TikTok numeric user ID'),
  instagramHandle: z.string().optional(),
  youtubeChannelId: z.string().optional(),
  spotifyCreatorId: z.string().optional(),
});

export type CreatorIdentifiers = z.infer<typeof CreatorIdentifiersSchema>;

/**
 * Creator Lens Account
 */
export const CreatorLensSchema = z.object({
  lensHandle: z.string().min(1).describe('Lens handle (same as TikTok)'),
  lensAccountAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  lensAccountId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  network: z.string().min(1),
  createdAt: z.string().datetime(),
  metadataUri: z.string().startsWith('lens://'),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

export type CreatorLens = z.infer<typeof CreatorLensSchema>;

/**
 * Creator Manifest
 */
export const CreatorManifestSchema = z.object({
  handle: z.string().min(1).describe('TikTok handle (filesystem safe)'),
  displayName: z.string().min(1).describe("Creator's display name"),
  identifiers: CreatorIdentifiersSchema,
  pkp: CreatorPKPSchema,
  lens: CreatorLensSchema,
  videos: z.array(z.string()).default([]).describe('Array of video hashes'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreatorManifest = z.infer<typeof CreatorManifestSchema>;

/**
 * Song Match (from TikTok video)
 */
export const SongMatchSchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  spotifyId: z.string().min(1),
  spotifyUrl: z.string().url(),
  isrc: z.string().min(1),
  geniusId: z.number().int().positive().optional(),
  mlcSongCode: z.string().optional(),
});

export type SongMatch = z.infer<typeof SongMatchSchema>;

/**
 * Audio Match Result
 */
export const AudioMatchResultSchema = z.object({
  startTime: z.number().gte(0).describe('Start time in original song'),
  endTime: z.number().gt(0).describe('End time in original song'),
  duration: z.number().gt(0).describe('Duration in seconds'),
  confidence: z.number().gte(0).lte(1).describe('Match confidence 0-1'),
  method: z.enum(['dtw', 'stt', 'hybrid']).describe('Matching method'),
}).refine(
  (data) => data.endTime > data.startTime,
  { message: "End time must be greater than start time" }
);

export type AudioMatchResult = z.infer<typeof AudioMatchResultSchema>;

/**
 * Processed Files
 */
export const ProcessedFilesSchema = z.object({
  originalVideo: z.string().min(1).describe('Path to original TikTok video'),
  segment: z.string().min(1).describe('Path to cropped segment'),
  vocals: z.string().min(1).describe('Path to separated vocals'),
  instrumental: z.string().min(1).describe('Path to instrumental'),
});

export type ProcessedFiles = z.infer<typeof ProcessedFilesSchema>;

/**
 * Grove URIs
 */
export const GroveURIsSchema = z.object({
  vocalsUri: z.string().startsWith('lens://'),
  instrumentalUri: z.string().startsWith('lens://'),
  alignmentUri: z.string().startsWith('lens://').optional(),
});

export type GroveURIs = z.infer<typeof GroveURIsSchema>;

/**
 * Story Protocol IP (for derivative works)
 */
export const StoryProtocolIPSchema = z.object({
  ipId: z.string().min(1).describe('Story Protocol IP Asset ID'),
  parentIpId: z.string().optional().describe('Original song IP (if registered)'),
  licenseTermsId: z.string().optional(),
  mintedAt: z.string().datetime(),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  metadataUri: z.string().url(),
  royaltyVault: z.string().optional(),
});

export type StoryProtocolIP = z.infer<typeof StoryProtocolIPSchema>;

/**
 * Lens Post
 */
export const LensPostSchema = z.object({
  postId: z.string().min(1),
  uri: z.string().startsWith('lens://'),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

export type LensPost = z.infer<typeof LensPostSchema>;

/**
 * Video Manifest (Complete)
 */
export const VideoManifestSchema = z.object({
  videoHash: z.string().min(1).describe('Unique video identifier'),
  creatorHandle: z.string().min(1),
  tiktokVideoId: z.string().min(1),
  tiktokUrl: z.string().url(),

  song: SongMatchSchema,
  match: AudioMatchResultSchema,
  files: ProcessedFilesSchema,
  grove: GroveURIsSchema,
  licensing: MLCDataSchema,

  storyProtocol: StoryProtocolIPSchema.optional(),
  lens: LensPostSchema.optional(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type VideoManifest = z.infer<typeof VideoManifestSchema>;

/**
 * Song Identification Result (from TikTok music metadata)
 */
export const SongIdentificationResultSchema = z.object({
  spotifyId: z.string().min(1),
  spotifyUrl: z.string().url(),
  isrc: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().min(1),
  geniusId: z.number().int().positive().optional(),
  mlcData: MLCDataSchema.optional(),
  storyMintable: z.boolean(),
});

export type SongIdentificationResult = z.infer<typeof SongIdentificationResultSchema>;
