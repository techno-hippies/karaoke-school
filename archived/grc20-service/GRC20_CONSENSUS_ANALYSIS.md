# GRC-20 Integration Analysis & Recommendations

## Executive Summary

After analyzing the current grc20-integration implementation, I've identified several critical issues and opportunities for improvement in the consensus system and data validation pipeline.

## Key Issues Identified

### 1. 🐛 Wikidata ID Bug: Shows "wiki" Instead of Q-IDs

**Root Cause:** Incorrect regex pattern in `scripts/enrich-musicbrainz.ts`

```typescript
// CURRENT (BUGGY):
wikidata_id: extractSocial(/wikidata\.org\/(entity|wiki)\/(Q\d+)/),

// PROBLEM:
// The regex captures "entity|wiki" as group 1, and "Q\d+" as group 2
// extractSocial returns group 1 OR group 2, so it returns "wiki" instead of "Q123456"

// FIX:
wikidata_id: extractSocial(/wikidata\.org\/(?:entity|wiki)\/(Q\d+)/),
// OR update extractSocial to return the correct group
```

**Impact:** All wikidata_id values show "wiki" instead of proper Q-IDs (e.g., "Q683544")

**Solution:** Update regex to use non-capturing group `(?:entity|wiki)` or modify extractSocial to return group 2.

### 2. ⚠️ ISNI Validation Too Weak

**Current State:** ISNI is optional in Zod schema but critical for industry consensus

**Problem:** 
- Validation schema allows minting without ISNI
- But consensus system treats ISNI as high-value identifier
- Only 49.8% of artists have ISNI (117/235)

**Recommendation:** Implement tiered validation:

```typescript
// Tier 1: Premium Quality (require ISNI)
export const PremiumArtistSchema = MusicalArtistMintSchema.extend({
  isni: ISNISchema, // Required
}).refine(data => data.external_id_count >= 5, {
  message: 'Premium tier requires 5+ external IDs'
});

// Tier 2: Standard Quality (ISNI optional)
export const StandardArtistSchema = MusicalArtistMintSchema; // Current

// Tier 3: Minimal Quality (basic requirements only)
export const MinimalArtistSchema = MusicalArtistMintSchema.pick({
  name: true,
  geniusId: true,
  imageUrl: true
}).extend({
  // At least one social link
});
```

### 3. 📝 Empty Corroboration Log Table

**Root Cause:** The ETL script doesn't actually write to `grc20_corroboration_log`

**Current Implementation:** Table exists but no INSERT statements populate it

**Solution:** Add logging to the corroboration ETL:

```sql
-- Example: Log ISNI resolution decisions
INSERT INTO grc20_corroboration_log (
  entity_type, entity_id, field_name, source, 
  old_value, new_value, resolution_reason, consensus_count
)
SELECT 
  'artist'::TEXT,
  ga.id,
  'isni'::TEXT,
  'musicbrainz'::TEXT,
  NULL,
  ma.isnis[1],
  'MusicBrainz ISNI accepted (single source)',
  1
FROM grc20_artists ga
JOIN musicbrainz_artists ma ON ma.mbid = ga.mbid
WHERE ma.isnis[1] IS NOT NULL;
```

### 4. 🔄 Missing Industry Source Integration

**Current State:** Only 3 sources (Genius, MusicBrainz, Spotify)

**Missing High-Value Sources:**
- CISAC (performing rights organization)
- BMI (broadcast music inc.)
- MLC (mechanical licensing collective)
- Quansic (music metadata service)

**Impact:** Limited consensus tracking for ISNI/IPI/ISRC/ISWC

## Current System Strengths

### ✅ Well-Designed Schema
- JSONB for flexible consensus tracking
- Comprehensive quality metrics
- Ready-to-mint gating logic
- Proper indexing strategy

### ✅ Good Resolution Rules
- MusicBrainz > Genius for authoritative data
- Fal > Spotify > Genius for images
- Proper fallback logic for missing data

### ✅ Solid ETL Foundation
- Batch processing with rate limiting
- Error handling and progress tracking
- Comprehensive data enrichment

## Recommended Improvements

### 1. Fix Wikidata ID Bug (High Priority)

```typescript
// In scripts/enrich-musicbrainz.ts
// Line ~103:
wikidata_id: extractSocial(/wikidata\.org\/(?:entity|wiki)\/(Q\d+)/),
```

### 2. Implement Tiered Validation System

Create quality tiers with different ISNI requirements:

```typescript
// types/validation-schemas.ts
export const ValidationTiers = {
  PREMIUM: {
    name: 'Premium',
    description: 'Industry-ready with full consensus',
    isni_required: true,
    min_external_ids: 5,
    min_social_links: 3,
    min_completeness: 0.90
  },
  STANDARD: {
    name: 'Standard', 
    description: 'Good quality for most use cases',
    isni_required: false,
    min_external_ids: 3,
    min_social_links: 2,
    min_completeness: 0.70
  },
  MINIMAL: {
    name: 'Minimal',
    description: 'Basic identity only',
    isni_required: false,
    min_external_ids: 1,
    min_social_links: 1,
    min_completeness: 0.50
  }
};
```

### 3. Populate Corroboration Log

Add comprehensive logging to `sql/02-corroborate-artists.sql`:

```sql
-- After the main INSERT, add logging for each field resolution
INSERT INTO grc20_corroboration_log (
  entity_type, entity_id, field_name, source, 
  old_value, new_value, resolution_reason, consensus_count, conflict_detected
)
SELECT 
  'artist',
  ga.id,
  'name',
  CASE WHEN ma.name IS NOT NULL THEN 'musicbrainz' ELSE 'genius' END,
  ga.name, -- old value would be from previous run
  COALESCE(ma.name, ga.name), -- new resolved value
  CASE 
    WHEN ma.name IS NOT NULL THEN 'MusicBrainz canonical name preferred'
    ELSE 'Genius name used (no MusicBrainz match)'
  END,
  CASE WHEN ma.name IS NOT NULL AND ga.name IS NOT NULL THEN 2 ELSE 1 END,
  CASE WHEN ma.name IS NOT NULL AND ga.name IS NOT NULL AND ma.name != ga.name THEN TRUE ELSE FALSE END
FROM grc20_artists ga
LEFT JOIN musicbrainz_artists ma ON ma.mbid = ga.mbid;
```

### 4. Enhanced Consensus Tracking

Improve `field_consensus` JSONB structure:

```sql
-- Enhanced field_consensus example
{
  "isni": {
    "value": "0000000123456789",
    "sources": ["musicbrainz", "cisac", "bmi"],
    "consensus_count": 3,
    "confidence_score": 0.75, -- 3/4 sources agree
    "conflicts": {
      "quansic": "0000000123456790"
    },
    "resolution_rule": "majority_vote",
    "resolved_at": "2025-01-15T10:30:00Z"
  }
}
```

### 5. Industry Source Integration Plan

**Phase 1: CISAC Integration**
- Add `cisac_artists` table
- Import ISNI/IPI data from CISAC
- Join on ISNI for consensus

**Phase 2: BMI/MLC Integration**
- Add performing rights data
- Track songwriter-publisher relationships
- Enhance work-level consensus

**Phase 3: Quansic Integration**
- Commercial metadata service
- High-quality ISRC/ISWC data
- Automated matching algorithms

### 6. Quality Gate Improvements

Current ready-to-mint logic is good but can be enhanced:

```sql
-- Enhanced ready-to-mint logic
UPDATE grc20_artists SET
  ready_to_mint = CASE
    -- Premium tier (highest confidence)
    WHEN isni IS NOT NULL 
     AND external_id_count >= 5 
     AND social_link_count >= 3 
     AND completeness_score >= 0.90
     AND consensus_score >= 0.75
    THEN TRUE
    
    -- Standard tier (good confidence)
    WHEN external_id_count >= 3 
     AND social_link_count >= 2 
     AND completeness_score >= 0.70
     AND image_url IS NOT NULL
    THEN TRUE
    
    -- Minimal tier (basic identity)
    WHEN genius_artist_id IS NOT NULL 
     AND image_url IS NOT NULL
     AND social_link_count >= 1
    THEN TRUE
    
    ELSE FALSE
  END,
  mint_tier = CASE
    WHEN isni IS NOT NULL AND external_id_count >= 5 THEN 'premium'
    WHEN external_id_count >= 3 THEN 'standard'
    ELSE 'minimal'
  END;
```

## Implementation Priority

### 🔥 Critical (Fix Immediately)
1. **Wikidata ID regex bug** - 5-minute fix, high impact
2. **ISNI validation policy** - Business decision needed
3. **Corroboration log population** - Add logging to ETL

### 📈 High Priority (Next Sprint)
1. **Tiered validation system** - Improves data quality
2. **Enhanced consensus tracking** - Better audit trail
3. **Industry source integration** - CISAC first

### 🔮 Medium Priority (Future)
1. **Automated conflict resolution**
2. **Machine learning for entity matching**
3. **Real-time consensus updates**

## Testing Recommendations

### 1. Data Quality Dashboard
```sql
-- Add to existing dashboard
SELECT 
  'Wikidata Issues' as metric,
  COUNT(*) FILTER (WHERE wikidata_id = 'wiki') as broken_count,
  COUNT(*) FILTER (WHERE wikidata_id LIKE 'Q%') as correct_count
FROM grc20_artists;
```

### 2. Consensus Validation
```sql
-- Test consensus tracking
SELECT 
  name,
  isni,
  field_consensus->'isni'->>'consensus_count' as isni_consensus,
  field_consensus->'isni'->'sources' as isni_sources
FROM grc20_artists 
WHERE isni IS NOT NULL
LIMIT 10;
```

### 3. Validation Tier Testing
```typescript
// Test script to validate tier assignment
import { validateBatch, ValidationTiers } from './types/validation-schemas';

const artists = await sql`SELECT * FROM grc20_artists LIMIT 100`;

for (const [tierName, tierConfig] of Object.entries(ValidationTiers)) {
  const result = validateBatch(artists, getTierSchema(tierConfig));
  console.log(`${tierName}: ${result.stats.validPercent}% pass`);
}
```

## Conclusion

The current grc20-integration system has a solid foundation but needs critical fixes and enhancements:

1. **Immediate fixes required:** Wikidata ID bug, ISNI validation policy, corroboration logging
2. **Strategic improvements:** Tiered validation, industry source integration, enhanced consensus
3. **Long-term vision:** Automated conflict resolution, ML-based matching, real-time updates

The consensus system design is excellent and aligns well with industry best practices for data integration and entity resolution. With the recommended fixes and improvements, this will be a robust, production-ready system for GRC-20 minting.

---

**Next Steps:**
1. Fix wikidata regex bug (5 minutes)
2. Decide on ISNI validation policy (business decision)
3. Implement corroboration logging (1 hour)
4. Plan tiered validation rollout (1 week)
5. Begin CISAC integration (2-3 weeks)

The foundation is solid - these improvements will make it exceptional.
