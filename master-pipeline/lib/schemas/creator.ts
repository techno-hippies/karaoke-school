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
 * Video Manifest (Artist Flow - with audio matching & separation)
 */
export const ArtistVideoManifestSchema = z.object({
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

export type ArtistVideoManifest = z.infer<typeof ArtistVideoManifestSchema>;

/**
 * Creator Song Info
 */
export const CreatorSongSchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  copyrightType: z.enum(['copyrighted', 'copyright-free']),
  spotifyId: z.string().optional(),
  isrc: z.string().optional(),
  geniusId: z.number().int().positive().optional(),
  coverUri: z.string().optional().describe('Album art URI from song metadata'),
});

export type CreatorSong = z.infer<typeof CreatorSongSchema>;

/**
 * Creator Video Files
 */
export const CreatorVideoFilesSchema = z.object({
  video: z.string().min(1).describe('Path to processed video file'),
  audio: z.string().min(1).describe('Path to extracted audio'),
});

export type CreatorVideoFiles = z.infer<typeof CreatorVideoFilesSchema>;

/**
 * Creator Grove Storage
 */
export const CreatorGroveSchema = z.object({
  video: z.string().startsWith('lens://'),
  videoGateway: z.string().url(),
  thumbnail: z.string().startsWith('lens://').optional(),
  thumbnailGateway: z.string().url().optional(),
});

export type CreatorGrove = z.infer<typeof CreatorGroveSchema>;

/**
 * Creator Video Captions
 */
export const CreatorCaptionsSchema = z.object({
  en: z.string().min(1),
  vi: z.string().min(1),
  zh: z.string().min(1),
});

export type CreatorCaptions = z.infer<typeof CreatorCaptionsSchema>;

/**
 * Creator Story Protocol Data
 */
export const CreatorStoryProtocolSchema = z.object({
  ipId: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  metadataUri: z.string().startsWith('lens://'),
  metadataGatewayUrl: z.string().url().optional(),
  licenseTermsIds: z.array(z.string()).optional(),
  royaltyVault: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  mintedAt: z.string().datetime(),
});

export type CreatorStoryProtocol = z.infer<typeof CreatorStoryProtocolSchema>;

/**
 * Creator Lens Post
 */
export const CreatorLensPostSchema = z.object({
  hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  metadataUri: z.string().startsWith('lens://'),
  postedAt: z.string().datetime(),
});

export type CreatorLensPost = z.infer<typeof CreatorLensPostSchema>;

/**
 * Video Manifest (Creator Flow - direct TikTok posting)
 */
export const CreatorVideoManifestSchema = z.object({
  videoHash: z.string().min(1).describe('Unique video identifier'),
  creatorHandle: z.string().min(1),
  tiktokVideoId: z.string().min(1),
  tiktokUrl: z.string().url(),
  description: z.string(),
  descriptionTranslations: z.record(z.string(), z.string()).optional(),
  captions: CreatorCaptionsSchema.optional(),

  song: CreatorSongSchema,
  mlc: MLCDataSchema.optional().describe('Required for copyrighted content'),

  files: CreatorVideoFilesSchema,
  grove: CreatorGroveSchema,

  storyMintable: z.boolean(),
  storyProtocol: CreatorStoryProtocolSchema.optional(),
  lensPost: CreatorLensPostSchema.optional(),

  createdAt: z.string().datetime(),
}).refine(
  (data) => {
    // Copyrighted content MUST have MLC data
    if (data.song.copyrightType === 'copyrighted') {
      return data.mlc !== undefined;
    }
    return true;
  },
  {
    message: "Copyrighted content requires MLC data",
    path: ["mlc"],
  }
);

export type CreatorVideoManifest = z.infer<typeof CreatorVideoManifestSchema>;

/**
 * Legacy alias for backward compatibility
 */
export const VideoManifestSchema = ArtistVideoManifestSchema;
export type VideoManifest = ArtistVideoManifest;

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
