/**
 * Account Metadata Schema (Grove Storage)
 *
 * REPLACES: ArtistRegistryV1 + StudentProfileV2 contracts
 *
 * Unified account type - everyone gets the same structure:
 * - Regular users (TikTok creators, students)
 * - Artists (optional geniusArtistId field)
 * - No hierarchy: accounts are accounts
 *
 * Storage: Lens Account metadata (mutable via Grove ACL)
 * Access: Via Lens GraphQL + Grove HTTP
 * Updates: Via Lit Actions (PKP-signed) or backend wallet
 *
 * Example URI: lens://account-{address}/metadata.json
 */

import { z } from 'zod';

/**
 * Account Stats (replaces StudentProfileV2.StudentStats)
 *
 * Tracks both performance (full karaoke recordings) and study (FSRS line practice)
 */
export const AccountStatsSchema = z.object({
  // Performance metrics (karaoke recordings)
  totalPerformances: z.number().int().nonnegative().default(0)
    .describe('Total karaoke performances submitted'),
  gradedPerformances: z.number().int().nonnegative().default(0)
    .describe('Performances that received AI grading'),
  averagePerformanceScore: z.number().int().min(0).max(10000).default(0)
    .describe('Average performance score in basis points (0-10000)'),
  bestPerformanceScore: z.number().int().min(0).max(10000).default(0)
    .describe('Best performance score in basis points'),

  // FSRS study metrics (line-by-line learning)
  totalLinesStudied: z.number().int().nonnegative().default(0)
    .describe('Total line reviews (from FSRSTrackerV1 contract)'),
  totalStudySessions: z.number().int().nonnegative().default(0)
    .describe('Number of study sessions'),
  averageLineScore: z.number().int().min(0).max(100).default(0)
    .describe('Average pronunciation score (0-100)'),
  cardsInReview: z.number().int().nonnegative().default(0)
    .describe('Cards in long-term review state (FSRS algorithm)'),

  // Combined metrics
  totalStudyTime: z.number().int().nonnegative().default(0)
    .describe('Total practice time in seconds (study + performance)'),
  currentStreak: z.number().int().nonnegative().default(0)
    .describe('Current daily streak (any activity)'),
  longestStreak: z.number().int().nonnegative().default(0)
    .describe('Longest daily streak achieved'),

  // Timestamps
  lastActivity: z.string().datetime().optional()
    .describe('Last activity timestamp (study or performance)'),
  lastStreakUpdate: z.string().datetime().optional()
    .describe('Last time streak was updated'),
}).describe('Account statistics for learning progress');

export type AccountStats = z.infer<typeof AccountStatsSchema>;

/**
 * Achievement (replaces StudentProfileV2.Achievement)
 */
export const AchievementSchema = z.object({
  id: z.string().min(1)
    .describe('Achievement ID (e.g., "first_performance", "perfect_score_10x")'),
  title: z.string().min(1)
    .describe('Display title (e.g., "First Steps", "Perfect Pitch")'),
  description: z.string().optional()
    .describe('Achievement description (optional)'),
  unlockedAt: z.string().datetime()
    .describe('When achievement was unlocked'),
}).describe('Achievement badge earned by account');

export type Achievement = z.infer<typeof AchievementSchema>;

/**
 * Verification Status
 *
 * For artists/creators who want verified badge
 */
export const VerificationSchema = z.object({
  verified: z.boolean().default(false)
    .describe('Whether account is verified'),
  verifiedBy: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
    .describe('EOA address that verified this account'),
  verifiedAt: z.string().datetime().optional()
    .describe('Verification timestamp'),
  verificationMethod: z.enum(['manual', 'genius-api', 'twitter', 'other']).optional()
    .describe('How verification was performed'),
}).describe('Verification status for account');

export type Verification = z.infer<typeof VerificationSchema>;

/**
 * Complete Account Metadata
 *
 * Stored in Grove as Lens Account metadata
 * ACL: Mutable, editable by account owner or authorized PKP
 *
 * REPLACES:
 * - ArtistRegistryV1.Artist struct
 * - StudentProfileV2.StudentStats struct
 * - StudentProfileV2 achievements mapping
 */
export const AccountMetadataSchema = z.object({
  version: z.literal('1.0.0').describe('Metadata schema version'),

  // Account type (informational only, no hierarchy)
  type: z.literal('account').describe('Metadata type'),

  // Identity (Lens account info)
  username: z.string().min(1).max(50).regex(/^[a-z0-9-_]+$/)
    .describe('Lens username (without @, e.g., "taylorswift", "brookemonk")'),
  lensAccountAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Lens Account contract address'),
  pkpAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Lit Protocol PKP address (account controller)'),

  // Optional: Link to Genius artist (if account represents an artist)
  geniusArtistId: z.number().int().positive().optional()
    .describe('Genius.com artist ID (optional, only if account is also a Genius artist)'),

  // Verification (optional, for creators/artists)
  verification: VerificationSchema.optional()
    .describe('Verification status (optional)'),

  // Profile info
  displayName: z.string().max(100).optional()
    .describe('Display name (e.g., "Taylor Swift", "Brooke Monk")'),
  bio: z.string().max(500).optional()
    .describe('Profile bio'),
  avatarUri: z.string().url().optional()
    .describe('Avatar image URI (IPFS, HTTP, or lens://)'),
  coverUri: z.string().url().optional()
    .describe('Cover/banner image URI (optional)'),

  // Social links (optional)
  links: z.object({
    twitter: z.string().optional(),
    tiktok: z.string().optional(),
    instagram: z.string().optional(),
    website: z.string().url().optional(),
  }).optional().describe('Social media links'),

  // Content created by this account
  createdContent: z.array(z.string().startsWith('lens://'))
    .default([])
    .describe('Array of Grove URIs for content (songs, segments, videos, etc.)'),

  // Learning stats (replaces StudentProfileV2)
  stats: AccountStatsSchema.optional()
    .describe('Learning and performance statistics (optional, only if user has activity)'),

  // Achievements (replaces StudentProfileV2 achievements)
  achievements: z.array(AchievementSchema)
    .default([])
    .describe('Achievements unlocked by this account'),

  // Metadata timestamps
  createdAt: z.string().datetime()
    .describe('Account creation timestamp'),
  updatedAt: z.string().datetime()
    .describe('Last metadata update timestamp'),
}).describe('Complete account metadata stored in Grove');

export type AccountMetadata = z.infer<typeof AccountMetadataSchema>;

/**
 * Validation helpers
 */
export function validateAccountMetadata(data: unknown): AccountMetadata {
  return AccountMetadataSchema.parse(data);
}

export function validateAccountStats(data: unknown): AccountStats {
  return AccountStatsSchema.parse(data);
}

export function validateAchievement(data: unknown): Achievement {
  return AchievementSchema.parse(data);
}

/**
 * Helper: Create initial account metadata (for new accounts)
 */
export function createInitialAccountMetadata(params: {
  username: string;
  lensAccountAddress: string;
  pkpAddress: string;
  geniusArtistId?: number;
  displayName?: string;
  bio?: string;
}): AccountMetadata {
  const now = new Date().toISOString();

  return {
    version: '1.0.0',
    type: 'account',
    username: params.username,
    lensAccountAddress: params.lensAccountAddress,
    pkpAddress: params.pkpAddress,
    geniusArtistId: params.geniusArtistId,
    displayName: params.displayName,
    bio: params.bio,
    createdContent: [],
    achievements: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Helper: Check if account is verified
 */
export function isVerified(account: AccountMetadata): boolean {
  return account.verification?.verified ?? false;
}

/**
 * Helper: Check if account is an artist (has Genius ID)
 */
export function isArtist(account: AccountMetadata): boolean {
  return account.geniusArtistId !== undefined;
}

/**
 * Helper: Add achievement to account
 */
export function addAchievement(
  account: AccountMetadata,
  achievement: Achievement
): AccountMetadata {
  // Check if already unlocked
  if (account.achievements.some(a => a.id === achievement.id)) {
    throw new Error(`Achievement ${achievement.id} already unlocked`);
  }

  return {
    ...account,
    achievements: [...account.achievements, achievement],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper: Update account stats
 */
export function updateStats(
  account: AccountMetadata,
  updates: Partial<AccountStats>
): AccountMetadata {
  const currentStats = account.stats ?? {
    totalPerformances: 0,
    gradedPerformances: 0,
    averagePerformanceScore: 0,
    bestPerformanceScore: 0,
    totalLinesStudied: 0,
    totalStudySessions: 0,
    averageLineScore: 0,
    cardsInReview: 0,
    totalStudyTime: 0,
    currentStreak: 0,
    longestStreak: 0,
  };

  return {
    ...account,
    stats: {
      ...currentStats,
      ...updates,
    },
    updatedAt: new Date().toISOString(),
  };
}
