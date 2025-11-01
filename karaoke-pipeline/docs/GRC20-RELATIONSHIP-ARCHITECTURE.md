# GRC-20 Relationship Architecture: MBID + Entity ID Strategy

## Problem Statement

**Current Issue:** Group relationships only store `mbid` (MusicBrainz ID), but GRC-20 requires `grc20_entity_id` for on-chain relationships.

**Why This Matters:** GRC-20 is a "master ID" system - entities should reference OTHER GRC-20 entities, not external IDs.

---

## GRC-20 Relationship Pattern (from SDK)

```typescript
// From: archived/grc20-service/connect-artists-to-works.ts

// Link artist to work using GRC-20 entity IDs:
const { ops: linkOps } = Graph.updateEntity(artistGRC20Id, {
  relations: {
    [properties.performedBy]: {
      toEntity: workId  // ← GRC-20 entity ID, NOT external ID!
    }
  }
});
```

**Key Insight:** GRC-20 relationships use `grc20_entity_id`, not external IDs like MBID or Spotify ID.

---

## Current Database Structure

### ❌ Problem: Missing `grc20_entity_id` in Relationships

```json
// Current member_of_groups structure:
{
  "member_of_groups": [{
    "mbid": "97b226c8-7140-4da3-91ac-15e62e131a81",
    "name": "Macklemore & Ryan Lewis",
    "spotify_artist_id": "5BcAKTbp20cv7tC5VqPFoC"
  }]
}
```

**Issues:**
1. ❌ Can't create on-chain relationships (no `grc20_entity_id`)
2. ⚠️ MBID is authoritative for validation but not for GRC-20 references
3. ⚠️ Backward reference to external system (MusicBrainz) instead of forward reference to GRC-20

---

## Proposed Solution: Single-Direction with Dual-ID Strategy

### ✅ Store Relationships in ONE Direction Only

**Architecture Decision:** Store only `member_of_groups` (member → group direction)

**Why?**
- Single source of truth (no redundancy)
- No backfilling needed
- Groups can query their members via JSONB query
- Follows GRC-20 best practices

```typescript
interface MemberOfGroupsReference {
  // GRC-20 Layer
  grc20_entity_id?: string;        // PRIMARY for on-chain relations (UUID)

  // Validation Layer
  mbid: string;                    // For data sourcing & validation (MusicBrainz)

  // Supplementary
  name: string;
  spotify_artist_id?: string;
}
```

**Querying Members of a Group:**
```sql
-- Find all members of "Macklemore & Ryan Lewis"
SELECT name, mbid
FROM grc20_artists
WHERE member_of_groups @> '[{"mbid": "97b226c8-7140-4da3-91ac-15e62e131a81"}]';
```

---

## Data Flow: From MusicBrainz → GRC-20

### Phase 1: Populate Relationships (MBID-based)

```
Step 1: MusicBrainz Enrichment (04-enrich-musicbrainz.ts)
  ↓ Fetches member_relations from MusicBrainz API
  ↓ Stores in musicbrainz_artists.member_relations

Step 2: GRC-20 Population (populate-grc20-artists.ts)
  ↓ Reads member_relations from musicbrainz_artists
  ↓ Populates grc20_artists.member_of_groups ONLY (single direction)
  ↓ Structure: {grc20_entity_id: null, mbid, name, spotify_artist_id}
  ↓ grc20_entity_id = null (will be populated during minting)
```

**Example After Phase 1:**

```json
{
  "name": "Ryan Lewis",
  "grc20_entity_id": null,  // Not minted yet
  "mbid": "c01560d1-6f69-48cf-a3c6-c94b65f099b1",
  "member_of_groups": [{
    "grc20_entity_id": null,  // Not minted yet
    "mbid": "97b226c8-7140-4da3-91ac-15e62e131a81",
    "name": "Macklemore & Ryan Lewis",
    "spotify_artist_id": "5BcAKTbp20cv7tC5VqPFoC"
  }]
}
```

### Phase 2: Mint Artists to GRC-20

```
Step 3: Mint to GRC-20 (import-artists.ts)
  ↓ For each ready-to-mint artist:
  ↓ Create GRC-20 entity
  ↓ Get entity ID from Graph.createEntity()
  ↓ UPDATE grc20_artists SET grc20_entity_id = ...
```

**Example After Minting:**

```json
{
  "name": "Ryan Lewis",
  "grc20_entity_id": "1a2b3c4d-...",  // ✅ Minted!
  "mbid": "c01560d1-6f69-48cf-a3c6-c94b65f099b1",
  "member_of_groups": [{
    "grc20_entity_id": null,  // ⚠️ Group not minted yet
    "mbid": "97b226c8-7140-4da3-91ac-15e62e131a81",
    "name": "Macklemore & Ryan Lewis",
    "spotify_artist_id": "5BcAKTbp20cv7tC5VqPFoC"
  }]
}
```

### Phase 3: Dependency-Ordered Minting (No Backfilling!)

**Strategy:** Mint in dependency order so `grc20_entity_id` is populated during minting

```typescript
// 1. Build dependency graph from member_of_groups
// 2. Topological sort (groups before members)
// 3. Mint in order, checking if dependencies already minted

const mintOrder = getMintOrder(artists);  // See GRC20-MINTING-STRATEGY.md

for (const artist of mintOrder) {
  // Mint artist
  const entityId = await mintArtist(artist);

  // Check if any groups are already minted
  const updatedMemberOfGroups = [];
  for (const group of artist.member_of_groups) {
    const groupEntity = await query(`
      SELECT grc20_entity_id FROM grc20_artists WHERE mbid = $1
    `, [group.mbid]);

    updatedMemberOfGroups.push({
      grc20_entity_id: groupEntity[0]?.grc20_entity_id || null,  // ✅ Available if minted
      mbid: group.mbid,
      name: group.name,
      spotify_artist_id: group.spotify_artist_id
    });
  }

  // Update with both entity ID and resolved group references
  await query(`
    UPDATE grc20_artists
    SET grc20_entity_id = $1, member_of_groups = $2
    WHERE mbid = $3
  `, [entityId, JSON.stringify(updatedMemberOfGroups), artist.mbid]);
}
```

**Example After Dependency-Ordered Minting:**

```json
{
  "name": "Ryan Lewis",
  "grc20_entity_id": "1a2b3c4d-...",  // ✅ Minted
  "mbid": "c01560d1-6f69-48cf-a3c6-c94b65f099b1",
  "member_of_groups": [{
    "grc20_entity_id": "5e6f7g8h-...",  // ✅ Group was minted first!
    "mbid": "97b226c8-7140-4da3-91ac-15e62e131a81",
    "name": "Macklemore & Ryan Lewis",
    "spotify_artist_id": "5BcAKTbp20cv7tC5VqPFoC"
  }]
}
```

### Phase 4: Create On-Chain Relationships

**NEW SCRIPT:** `create-artist-group-relations.ts`

```typescript
// Create on-chain artist-group relationships using GRC-20 SDK:

import { Graph } from '@graphprotocol/grc-20';
import { properties } from './type-ids.json';

for (const artist of allArtists) {
  if (!artist.grc20_entity_id || !artist.member_of_groups) continue;

  const allOps = [];

  for (const group of artist.member_of_groups) {
    if (!group.grc20_entity_id) {
      console.warn(`⚠️ Group ${group.name} not minted yet, skipping`);
      continue;
    }

    // Create relationship: Artist → memberOf → Group
    const { ops: relationOps } = Graph.updateEntity(artist.grc20_entity_id, {
      relations: {
        [properties.memberOf]: {
          toEntity: group.grc20_entity_id,  // ✅ Uses GRC-20 entity ID!
          values: [{
            property: properties.role,
            value: "group_member"
          }]
        }
      }
    });

    allOps.push(...relationOps);
  }

  // Publish to IPFS + blockchain
  if (allOps.length > 0) {
    await publishEdit(allOps, `Link ${artist.name} to groups`);
  }
}
```

---

## Why Maintain BOTH IDs?

| Use Case | MBID | GRC-20 Entity ID |
|----------|------|------------------|
| **Data Validation** | ✅ Authoritative source | ❌ |
| **On-Chain Relationships** | ❌ | ✅ Required |
| **Cross-Platform Matching** | ✅ Stable | ⚠️ Project-specific |
| **MusicBrainz Integration** | ✅ Native | ❌ |
| **GRC-20 Queries** | ❌ | ✅ Primary |
| **Debugging** | ✅ Human-readable | ⚠️ UUIDs |

---

## Implementation Checklist

### ✅ Completed (2025-11-01)
- [x] TypeScript interfaces updated to single-direction (member_of_groups only)
- [x] Removed `group_member_ids` column (migration 030)
- [x] Database schema has `grc20_entity_id` column
- [x] Relationship arrays include `grc20_entity_id` field
- [x] Populate logic includes `grc20_entity_id: null` initially
- [x] MusicBrainz member_relations as authoritative source
- [x] Single source of truth (no redundant data)

### ⏳ To Do
- [ ] Implement dependency-ordered minting algorithm (see GRC20-MINTING-STRATEGY.md)
- [ ] Create `create-artist-group-relations.ts` script (on-chain)
- [ ] Add validation to ensure MBID ↔ GRC-20 ID consistency
- [ ] Update GRC-20 type definitions to include `memberOf` property

---

## Migration Plan

### ✅ Step 1: Update to Single-Direction Architecture (COMPLETED 2025-11-01)

**Changes Made:**
1. Removed `GroupMemberReference` interface (no longer needed)
2. Updated `MemberOfGroupsReference` to include `grc20_entity_id` field
3. Removed all `group_member_ids` population logic
4. Updated database queries to only use `member_of_groups`
5. Created migration 030 to drop `group_member_ids` column

```typescript
// ✅ IMPLEMENTED in populate-grc20-artists.ts:

interface MemberOfGroupsReference {
  grc20_entity_id?: string;  // For on-chain relationships
  mbid: string;              // For validation
  name: string;
  spotify_artist_id?: string;
}

// Population logic:
agg.memberOfGroups.push({
  grc20_entity_id: null,  // Will be populated during dependency-ordered minting
  mbid: rel.artist_mbid,
  name: rel.artist_name,
  spotify_artist_id: groupData[0]?.spotify_artist_id
});
```

### ⏳ Step 2: Implement Dependency-Ordered Minting (NEXT)

See `GRC20-MINTING-STRATEGY.md` for complete algorithm.

Key components:
1. Build dependency graph from `member_of_groups`
2. Topological sort (mint groups before members)
3. During minting, check if dependencies already minted
4. Populate `grc20_entity_id` in relationships as entities are minted

### ⏳ Step 3: Create On-Chain Relations (FINAL)

After all entities minted with resolved `grc20_entity_id`:
- Use GRC-20 SDK to create `memberOf` relationships
- Artist → memberOf → Group (using grc20_entity_id)

---

## Validation Queries

```sql
-- Check relationship completeness:
SELECT
  name,
  grc20_entity_id IS NOT NULL as is_minted,
  jsonb_array_length(member_of_groups) as group_count,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(member_of_groups) as group
    WHERE group->>'grc20_entity_id' IS NOT NULL
  ) as groups_with_grc20_id
FROM grc20_artists
WHERE jsonb_array_length(member_of_groups) > 0;

-- Find artists ready for on-chain relationship creation:
SELECT name
FROM grc20_artists
WHERE grc20_entity_id IS NOT NULL
  AND jsonb_array_length(member_of_groups) > 0
  AND (
    SELECT COUNT(*)
    FROM jsonb_array_elements(member_of_groups) as group
    WHERE group->>'grc20_entity_id' IS NOT NULL
  ) = jsonb_array_length(member_of_groups);
```

---

## Conclusion

**Key Decisions:**
1. **Single-Direction Relationships:** Store only `member_of_groups` (no `group_member_ids`)
2. **Dual-ID Strategy:** Maintain BOTH MBID and GRC-20 Entity ID in each relationship
3. **Dependency-Ordered Minting:** No backfilling - mint in topological order

**Benefits:**
1. ✅ MBID for authoritative data sourcing & validation
2. ✅ GRC-20 Entity ID for on-chain relationships
3. ✅ Single source of truth (no redundant data)
4. ✅ No false positives (Wanz → The Rangehoods, NOT Macklemore & Ryan Lewis)
5. ✅ Scalable to 10k+ artists
6. ✅ Compatible with GRC-20 SDK patterns
7. ✅ No backfilling needed (dependency-ordered minting)

**Next Steps:**
1. ✅ Update TypeScript interfaces (COMPLETED)
2. ✅ Update populate logic (COMPLETED)
3. ✅ Create database migration (COMPLETED - migration 030)
4. ⏳ Implement dependency-ordered minting algorithm
5. ⏳ Create on-chain relationship creation script
6. ⏳ Define `memberOf` property in GRC-20 type system

---

**Status:** ✅ Architecture finalized and implemented
**Date:** 2025-11-01
**Review:** Single-direction architecture confirmed with user
**Migration:** Migration 030 drops `group_member_ids` column
