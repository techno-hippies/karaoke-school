/**
 * Tiered Validation Schemas for GRC-20 Minting
 * 
 * Implements three quality tiers with different ISNI requirements:
 * - Premium: Industry-ready with full consensus (requires ISNI)
 * - Standard: Good quality for most use cases (ISNI optional)
 * - Minimal: Basic identity only (ISNI optional)
 */

import { z } from 'zod';
import { 
  ISNISchema, 
  IPISchema, 
  MBIDSchema, 
  SocialHandleSchema,
  MusicalArtistMintSchema 
} from './validation-schemas';

// ============ Validation Tier Configuration ============

export const ValidationTiers = {
  PREMIUM: {
    name: 'Premium',
    description: 'Industry-ready with full consensus',
    isni_required: true,
    min_external_ids: 5,
    min_social_links: 3,
    min_completeness: 0.90,
    min_consensus: 0.75,
    color: '🌟'
  },
  STANDARD: {
    name: 'Standard', 
    description: 'Good quality for most use cases',
    isni_required: false,
    min_external_ids: 3,
    min_social_links: 2,
    min_completeness: 0.70,
    min_consensus: 0.50,
    color: '✅'
  },
  MINIMAL: {
    name: 'Minimal',
    description: 'Basic identity only',
    isni_required: false,
    min_external_ids: 1,
    min_social_links: 1,
    min_completeness: 0.50,
    min_consensus: 0.25,
    color: '⚠️'
  }
} as const;

export type ValidationTier = keyof typeof ValidationTiers;

// ============ Premium Artist Schema (Requires ISNI) ============

export const PremiumArtistSchema = z.object({
  // Core identity (required)
  name: z.string().min(1, 'Artist name required').max(255),
  geniusId: z.number().int().positive('Genius artist ID required'),

  // ISNI is REQUIRED for premium tier
  isni: ISNISchema,
  
  // Require more external IDs for premium
  mbid: MBIDSchema,
  spotifyId: z.string().min(1, 'Spotify ID required for premium tier'),

  // Optional fields from original schema
  wikidataId: z.string().nullish(),
  discogsId: z.string().nullish(),
  ipi: IPISchema.nullish(),
  alternateNames: z.array(z.string()).nullish(),
  sortName: z.string().nullish(),
  disambiguation: z.string().nullish(),
  instagramHandle: SocialHandleSchema.nullish(),
  tiktokHandle: SocialHandleSchema.nullish(),
  twitterHandle: SocialHandleSchema.nullish(),
  facebookHandle: SocialHandleSchema.nullish(),
  youtubeChannel: SocialHandleSchema.nullish(),
  soundcloudHandle: SocialHandleSchema.nullish(),
  geniusUrl: z.string().url().nullish(),
  spotifyUrl: z.string().url().nullish(),
  appleMusicUrl: z.string().url().nullish(),
  imageUrl: z.string().url().nullish(),
  headerImageUrl: z.string().url().nullish(),
  type: z.enum(['Person', 'Group', 'Orchestra', 'Choir', 'Character', 'Other']).nullish(),
  country: z.string().length(2).nullish(),
  gender: z.enum(['Male', 'Female', 'Non-binary', 'Other']).nullish(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  deathDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  genres: z.array(z.string()).nullish(),
  spotifyFollowers: z.number().int().nonnegative().nullish(),
  spotifyPopularity: z.number().int().min(0).max(100).nullish(),
  geniusFollowers: z.number().int().nonnegative().nullish(),
  isVerified: z.boolean().nullish(),
  lensAccount: z.string().regex(/^0x[a-fA-F0-9]{40}$/).nullish(),

}).refine(data => {
  const externalIds = [
    data.mbid,
    data.spotifyId,
    data.wikidataId,
    data.discogsId,
    data.ipi
  ].filter(Boolean);
  
  return externalIds.length >= ValidationTiers.PREMIUM.min_external_ids;
}, {
  message: `Premium tier requires ${ValidationTiers.PREMIUM.min_external_ids}+ external IDs`,
  path: ['external_ids']
}).refine(data => {
  const socialLinks = [
    data.instagramHandle,
    data.tiktokHandle,
    data.twitterHandle,
    data.facebookHandle,
    data.youtubeChannel,
    data.soundcloudHandle,
    data.geniusUrl,
    data.spotifyUrl
  ].filter(Boolean);
  
  return socialLinks.length >= ValidationTiers.PREMIUM.min_social_links;
}, {
  message: `Premium tier requires ${ValidationTiers.PREMIUM.min_social_links}+ social links`,
  path: ['social_links']
});

// ============ Standard Artist Schema (Current) ============

export const StandardArtistSchema = MusicalArtistMintSchema.refine(data => {
  const externalIds = [
    data.mbid,
    data.spotifyId,
    data.wikidataId,
    data.discogsId,
    data.isni,
    data.ipi
  ].filter(Boolean);
  
  return externalIds.length >= ValidationTiers.STANDARD.min_external_ids;
}, {
  message: `Standard tier requires ${ValidationTiers.STANDARD.min_external_ids}+ external IDs`,
  path: ['external_ids']
}).refine(data => {
  const socialLinks = [
    data.instagramHandle,
    data.tiktokHandle,
    data.twitterHandle,
    data.facebookHandle,
    data.youtubeChannel,
    data.soundcloudHandle,
    data.geniusUrl,
    data.spotifyUrl
  ].filter(Boolean);
  
  return socialLinks.length >= ValidationTiers.STANDARD.min_social_links;
}, {
  message: `Standard tier requires ${ValidationTiers.STANDARD.min_social_links}+ social links`,
  path: ['social_links']
});

// ============ Minimal Artist Schema (Basic Requirements) ============

export const MinimalArtistSchema = z.object({
  // Core identity only
  name: z.string().min(1, 'Artist name required').max(255),
  geniusId: z.number().int().positive('Genius artist ID required'),
  imageUrl: z.string().url().nullish(),
  
  // Basic social/external
  spotifyUrl: z.string().url().nullish(),
  geniusUrl: z.string().url().nullish(),
  instagramHandle: SocialHandleSchema.nullish(),
  twitterHandle: SocialHandleSchema.nullish(),
  facebookHandle: SocialHandleSchema.nullish(),
  
  // Optional identifiers
  mbid: MBIDSchema.nullish(),
  spotifyId: z.string().nullish(),
  wikidataId: z.string().nullish(),
  discogsId: z.string().nullish(),
  isni: ISNISchema.nullish(),
  ipi: IPISchema.nullish(),
  
  // Basic metadata
  type: z.enum(['Person', 'Group', 'Orchestra', 'Choir', 'Character', 'Other']).nullish(),
  country: z.string().length(2).nullish(),

}).refine(data => {
  const socialLinks = [
    data.instagramHandle,
    data.twitterHandle,
    data.facebookHandle,
    data.geniusUrl,
    data.spotifyUrl
  ].filter(Boolean);
  
  return socialLinks.length >= ValidationTiers.MINIMAL.min_social_links;
}, {
  message: `Minimal tier requires ${ValidationTiers.MINIMAL.min_social_links}+ social link`,
  path: ['social_links']
});

// ============ Tier Detection Function ============

export function detectValidationTier(artistData: any): ValidationTier {
  // Check if it passes premium tier first
  try {
    PremiumArtistSchema.parse(artistData);
    return 'PREMIUM';
  } catch {
    // Not premium, check standard
  }
  
  try {
    StandardArtistSchema.parse(artistData);
    return 'STANDARD';
  } catch {
    // Not standard, check minimal
  }
  
  try {
    MinimalArtistSchema.parse(artistData);
    return 'MINIMAL';
  } catch {
    // Doesn't pass any tier
    return 'MINIMAL'; // Will fail validation but categorize as minimal
  }
}

// ============ Tier Validation Function ============

export function validateForTier(
  artistData: any, 
  tier: ValidationTier
): { success: boolean; errors: string[]; tier: ValidationTier } {
  const schemas = {
    PREMIUM: PremiumArtistSchema,
    STANDARD: StandardArtistSchema,
    MINIMAL: MinimalArtistSchema
  };
  
  const schema = schemas[tier];
  const result = schema.safeParse(artistData);
  
  if (result.success) {
    return { success: true, errors: [], tier };
  } else {
    const errors = result.error.issues.map((issue: any) => 
      `${issue.path.join('.')}: ${issue.message}`
    );
    return { success: false, errors, tier };
  }
}

// ============ Batch Tier Validation ============

export interface TierValidationResult {
  tier: ValidationTier;
  valid: any[];
  invalid: Array<{
    item: any;
    errors: string[];
  }>;
  stats: {
    total: number;
    validCount: number;
    invalidCount: number;
    validPercent: number;
    tier: string;
  };
}

export function validateBatchByTier(
  items: any[],
  tier: ValidationTier
): TierValidationResult {
  const schemas = {
    PREMIUM: PremiumArtistSchema,
    STANDARD: StandardArtistSchema,
    MINIMAL: MinimalArtistSchema
  };
  
  const schema = schemas[tier];
  const valid: any[] = [];
  const invalid: Array<{ item: any; errors: string[] }> = [];

  for (const item of items) {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      const errors = result.error.issues.map((issue: any) => 
        `${issue.path.join('.')}: ${issue.message}`
      );
      invalid.push({ item, errors });
    }
  }

  return {
    tier,
    valid,
    invalid,
    stats: {
      total: items.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      validPercent: Math.round((valid.length / items.length) * 100),
      tier: ValidationTiers[tier].name
    }
  };
}

// ============ Quality Gate Function ============

export interface QualityGateResult {
  passed: boolean;
  tier: ValidationTier | null;
  message: string;
  recommendation: string;
}

export function checkQualityGates(
  artistData: any,
  targetTier?: ValidationTier
): QualityGateResult {
  
  // If target tier specified, check that specific tier
  if (targetTier) {
    const validation = validateForTier(artistData, targetTier);
    if (validation.success) {
      return {
        passed: true,
        tier: targetTier,
        message: `${ValidationTiers[targetTier].color} Passes ${ValidationTiers[targetTier].name} tier validation`,
        recommendation: 'Ready to mint'
      };
    } else {
      return {
        passed: false,
        tier: null,
        message: `❌ Fails ${ValidationTiers[targetTier].name} tier validation`,
        recommendation: validation.errors.join('; ')
      };
    }
  }
  
  // Auto-detect highest passing tier
  const detectedTier = detectValidationTier(artistData);
  const validation = validateForTier(artistData, detectedTier);
  
  if (validation.success) {
    return {
      passed: true,
      tier: detectedTier,
      message: `${ValidationTiers[detectedTier].color} Passes ${ValidationTiers[detectedTier].name} tier validation`,
      recommendation: detectedTier === 'MINIMAL' 
        ? 'Consider adding more external IDs and social links for higher tier'
        : 'Ready to mint'
    };
  } else {
    return {
      passed: false,
      tier: null,
      message: '❌ Fails all validation tiers',
      recommendation: 'Add basic required fields (name, genius ID, image, at least 1 social link)'
    };
  }
}

// ============ Export All ============

export const TieredSchemas = {
  Premium: PremiumArtistSchema,
  Standard: StandardArtistSchema,
  Minimal: MinimalArtistSchema,
} as const;

export type PremiumArtist = z.infer<typeof PremiumArtistSchema>;
export type StandardArtist = z.infer<typeof StandardArtistSchema>;
export type MinimalArtist = z.infer<typeof MinimalArtistSchema>;
