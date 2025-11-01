# GRC-20 Dependency-Ordered Minting Strategy

## Problem with Backfilling

❌ **Why Backfilling is Bad:**
- Requires multiple passes over data
- Error-prone (what if backfill fails?)
- Wasteful database operations
- Complex state management

## Correct Approach: Dependency-Ordered Minting

✅ **Single-Pass Strategy:**
1. Mint in dependency order (groups before members)
2. Check if referenced entities already exist
3. Include `grc20_entity_id` when available
4. Create on-chain relationships during minting

---

## Minting Algorithm

### Phase 1: Build Dependency Graph

```typescript
interface MintCandidate {
  id: number;
  name: string;
  mbid: string;
  artist_type: 'Group' | 'Person';

  // Dependencies (artists this one references)
  depends_on_mbids: string[];  // From member_of_groups
}

async function buildDependencyGraph() {
  const artists = await query<MintCandidate[]>(`
    SELECT
      id,
      name,
      mbid,
      artist_type,
      COALESCE(
        (
          SELECT jsonb_agg(elem->>'mbid')
          FROM jsonb_array_elements(member_of_groups) elem
        ),
        '[]'::jsonb
      ) as depends_on_mbids
    FROM grc20_artists
    WHERE ready_to_mint = true
  `);

  return artists;
}
```

**Note:** We only track forward dependencies (member → group). Groups can discover their members by querying artists where `member_of_groups` contains the group's MBID.

### Phase 2: Topological Sort (Mint Order)

```typescript
function getMintOrder(candidates: MintCandidate[]): MintCandidate[] {
  const order: MintCandidate[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(candidate: MintCandidate) {
    if (visited.has(candidate.mbid)) return;
    if (visiting.has(candidate.mbid)) {
      // Circular dependency - just add it
      console.warn(`⚠️ Circular dependency: ${candidate.name}`);
      return;
    }

    visiting.add(candidate.mbid);

    // Visit dependencies first (groups before members)
    for (const depMbid of candidate.depends_on_mbids) {
      const dep = candidates.find(c => c.mbid === depMbid);
      if (dep) visit(dep);
    }

    visiting.delete(candidate.mbid);
    visited.add(candidate.mbid);
    order.push(candidate);
  }

  // Visit all candidates
  for (const candidate of candidates) {
    visit(candidate);
  }

  return order;
}
```

**Example Output:**
```
Mint Order:
1. Macklemore & Ryan Lewis (Group) - no dependencies
2. Ryan Lewis (Person) - depends on group #1
3. Macklemore (Person) - depends on group #1
4. Grimes (Person) - no dependencies
```

### Phase 3: Mint with Relationship Resolution

```typescript
import { Graph } from '@graphprotocol/grc-20';

async function mintInOrder(candidates: MintCandidate[]) {
  const mintedEntities = new Map<string, string>();  // mbid → grc20_entity_id

  for (const candidate of candidates) {
    console.log(`\n🎵 Minting: ${candidate.name}`);

    // 1. Create base entity
    const { ops: entityOps, id: entityId } = Graph.createEntity({
      name: candidate.name,
      types: [types.musicalArtist],
      values: [
        { property: properties.name, value: candidate.name },
        { property: properties.mbid, value: candidate.mbid },
        // ... other properties
      ]
    });

    const allOps = [...entityOps];

    // 2. Check group relationships
    const groupRelations = [];

    for (const groupMbid of candidate.depends_on_mbids) {
      const groupEntityId = mintedEntities.get(groupMbid);

      if (groupEntityId) {
        // ✅ Group already minted - create on-chain relationship
        console.log(`   ✅ Linking to group (${groupMbid}) - already minted`);

        const { ops: relationOps } = Graph.updateEntity(entityId, {
          relations: {
            [properties.memberOf]: {
              toEntity: groupEntityId,
              values: [{
                property: properties.role,
                value: "group_member"
              }]
            }
          }
        });

        allOps.push(...relationOps);

        groupRelations.push({
          grc20_entity_id: groupEntityId,  // ✅ Available!
          mbid: groupMbid,
          name: getNameByMbid(groupMbid)
        });
      } else {
        // ⚠️ Group not minted yet - store MBID only
        console.log(`   ⚠️ Group (${groupMbid}) not minted yet - storing MBID`);

        groupRelations.push({
          grc20_entity_id: null,  // Will be resolved if group gets minted later
          mbid: groupMbid,
          name: getNameByMbid(groupMbid)
        });
      }
    }

    // 3. Publish to blockchain
    await publishEdit(allOps, `Mint ${candidate.name}`);

    // 4. Update database with grc20_entity_id
    await query(`
      UPDATE grc20_artists
      SET
        grc20_entity_id = $1,
        member_of_groups = $2,
        minted_at = NOW()
      WHERE mbid = $3
    `, [
      entityId,
      JSON.stringify(groupRelations),
      candidate.mbid
    ]);

    // 5. Store in map for future references
    mintedEntities.set(candidate.mbid, entityId);

    console.log(`   ✅ Minted: ${entityId}`);
  }

  return mintedEntities;
}
```

---

## Example Execution Flow

### Initial State
```json
[
  {
    "name": "Macklemore & Ryan Lewis",
    "mbid": "97b226c8-...",
    "artist_type": "Group",
    "member_of_groups": []
  },
  {
    "name": "Ryan Lewis",
    "mbid": "c01560d1-...",
    "artist_type": "Person",
    "member_of_groups": [
      {
        "grc20_entity_id": null,
        "mbid": "97b226c8-...",
        "name": "Macklemore & Ryan Lewis"
      }
    ]
  }
]
```

**Note:** Groups do NOT store `group_member_ids`. To find members of a group, query: `SELECT * FROM grc20_artists WHERE member_of_groups @> '[{"mbid": "97b226c8-..."}]'`

### Minting Order (Dependency-Sorted)
```
1. Macklemore & Ryan Lewis (no dependencies)
2. Ryan Lewis (depends on #1)
```

### Step 1: Mint Group

```typescript
// Mint Macklemore & Ryan Lewis (Group has no dependencies)
const groupId = await mintArtist({
  name: "Macklemore & Ryan Lewis",
  mbid: "97b226c8-...",
  // No relationships to create yet (members haven't been minted)
});

// Update database with GRC-20 entity ID
await query(`
  UPDATE grc20_artists
  SET grc20_entity_id = $1
  WHERE mbid = '97b226c8-...'
`, [groupId]);

// Store for future lookups
mintedEntities.set("97b226c8-...", groupId);
```

**Note:** We do NOT update `group_member_ids` because that column no longer exists. Members will reference the group via `member_of_groups`.

### Step 2: Mint Member with Relationship

```typescript
// Mint Ryan Lewis
const memberId = await mintArtist({
  name: "Ryan Lewis",
  mbid: "c01560d1-...",
});

// Check if group is minted
const groupId = mintedEntities.get("97b226c8-...");  // ✅ Found!

// Create on-chain relationship
await Graph.updateEntity(memberId, {
  relations: {
    [properties.memberOf]: {
      toEntity: groupId  // ✅ Uses GRC-20 entity ID!
    }
  }
});

// Update database with BOTH IDs
await query(`
  UPDATE grc20_artists
  SET
    grc20_entity_id = $1,
    member_of_groups = $2
  WHERE mbid = 'c01560d1-...'
`, [
  memberId,
  JSON.stringify([
    {
      grc20_entity_id: groupId,  // ✅ Available!
      mbid: "97b226c8-...",
      name: "Macklemore & Ryan Lewis"
    }
  ])
]);
```

---

## Benefits of This Approach

✅ **Single Pass:** No backfilling needed
✅ **Predictable:** Topological sort ensures dependencies are minted first
✅ **On-Chain Relations:** Created during minting, not after
✅ **Self-Healing:** If group isn't minted, just store MBID (can be resolved later)
✅ **Efficient:** Only touch each artist once during minting

---

## Edge Cases

### Case 1: Circular Dependencies
```
Artist A → memberOf → Group B
Group B → memberOf → Group A (circular!)
```

**Solution:** Detect cycles, mint both, then create on-chain relationships. Database only stores forward direction (`member_of_groups`).

### Case 2: Missing Dependencies
```
Ryan Lewis → memberOf → Macklemore & Ryan Lewis
(but group isn't ready to mint yet)
```

**Solution:** Store MBID only, skip on-chain relationship for now.

### Case 3: Solo Artists (No Dependencies)
```
Grimes → member_of_groups: []
```

**Solution:** Mint immediately (no dependencies to wait for).

---

## Implementation Checklist

- [ ] Create `build-dependency-graph.ts`
- [ ] Create `get-mint-order.ts` (topological sort)
- [ ] Update `import-artists.ts` to use dependency order
- [ ] Add relationship resolution during minting
- [ ] Add validation to ensure referenced entities exist
- [ ] Handle circular dependencies gracefully

---

## Comparison: Backfill vs Dependency-Ordered

| Aspect | Backfill ❌ | Dependency-Ordered ✅ |
|--------|-------------|------------------------|
| **Passes** | 2+ passes | Single pass |
| **Complexity** | High | Medium |
| **Error Handling** | Complex | Simple |
| **On-Chain Relations** | After minting | During minting |
| **Performance** | Slower | Faster |
| **Data Consistency** | Risky | Guaranteed |

---

## Conclusion

**Key Principle:** Mint in dependency order, resolve relationships during minting.

**Benefits:**
- No backfilling
- On-chain relationships created correctly
- Single source of truth
- Predictable, testable, efficient

**Next Steps:**
1. Implement dependency graph builder
2. Implement topological sort
3. Update minting script to check mintedEntities map
4. Test with Macklemore & Ryan Lewis group

---

**Status:** ✅ Architecture validated, ready for implementation
**Date:** 2025-11-01
**Strategy:** Dependency-ordered minting (no backfilling)
