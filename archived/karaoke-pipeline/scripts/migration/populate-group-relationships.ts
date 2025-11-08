/**
 * DEPRECATED: This script is no longer needed!
 *
 * Group relationships are now AUTOMATICALLY populated by:
 * scripts/migration/populate-grc20-artists.ts
 *
 * The populate-grc20-artists script:
 * - Reads member_relations from musicbrainz_artists (populated by step 4)
 * - Populates group_member_ids and member_of_groups automatically
 * - Does a second pass to fill in missing Spotify IDs
 * - No manual steps required!
 *
 * This standalone script remains for manual debugging/testing only.
 *
 * ---
 *
 * Populate Group Relationships - ROBUST VERSION
 *
 * Uses authoritative MusicBrainz member_relations data instead of naive co-appearance heuristics.
 * This prevents false positives like Grimes being labeled as aespa member.
 *
 * Algorithm:
 * 1. For each artist in grc20_artists with MusicBrainz data
 * 2. Check their member_relations from musicbrainz_artists table
 * 3. direction="backward" → this is a GROUP, linked artists are members (group ← member)
 * 4. direction="forward" → this is a MEMBER, linked artists are groups (member → group)
 * 5. Update grc20_artists with bidirectional relationships
 */

import { query } from '../../src/db/neon';

interface GroupMember {
  mbid: string;
  name: string;
  spotify_artist_id?: string;
}

interface GroupReference {
  mbid: string;                    // PRIMARY identifier (MusicBrainz ID)
  name: string;
  spotify_artist_id?: string;      // optional
}

interface MemberRelation {
  type: string;
  direction: 'forward' | 'backward';
  artist_mbid: string;
  artist_name: string;
}

async function main() {
  console.log('🎭 Populating Group Relationships (Authoritative MusicBrainz Data)...\n');

  // Step 0: Clear all existing relationships to remove false positives
  console.log('🧹 Clearing old relationship data...');
  await query(`
    UPDATE grc20_artists
    SET group_member_ids = '[]'::jsonb,
        member_of_groups = '[]'::jsonb,
        updated_at = NOW()
    WHERE group_member_ids != '[]'::jsonb
       OR member_of_groups != '[]'::jsonb
  `);
  console.log('✅ Old data cleared\n');

  // Get all artists with MusicBrainz data
  const artists = await query<{
    id: number;
    name: string;
    spotify_artist_id: string;
    mbid: string;
    artist_type: string | null;
  }>(`
    SELECT id, name, spotify_artist_id, mbid, artist_type
    FROM grc20_artists
    WHERE mbid IS NOT NULL
    ORDER BY name
  `);

  console.log(`📊 Found ${artists.length} artists with MusicBrainz IDs\n`);

  let groupsUpdated = 0;
  let membersUpdated = 0;

  for (const artist of artists) {
    // Get MusicBrainz member relations
    const mbData = await query<{ member_relations: MemberRelation[] }>(`
      SELECT member_relations
      FROM musicbrainz_artists
      WHERE artist_mbid = $1
    `, [artist.mbid]);

    if (!mbData[0] || !mbData[0].member_relations || mbData[0].member_relations.length === 0) {
      continue;
    }

    const relations = mbData[0].member_relations;

    // Check if this artist is a group (has "backward" relations = has members)
    // NOTE: direction="backward" means members pointing TO this group (group ← member)
    const memberRels = relations.filter(rel => rel.direction === 'backward');

    if (memberRels.length > 0) {
      // This is a GROUP with members
      console.log(`🎭 ${artist.name} (Group)`);
      console.log(`   Found ${memberRels.length} members in MusicBrainz`);

      // Build group_member_ids array
      const memberIds: GroupMember[] = [];

      for (const rel of memberRels) {
        // Try to find this member in grc20_artists by mbid
        const member = await query<{
          spotify_artist_id: string;
          name: string;
        }>(`
          SELECT spotify_artist_id, name
          FROM grc20_artists
          WHERE mbid = $1
        `, [rel.artist_mbid]);

        if (member[0]) {
          memberIds.push({
            mbid: rel.artist_mbid,
            name: member[0].name,
            spotify_artist_id: member[0].spotify_artist_id
          });
          console.log(`      ✅ ${member[0].name} (in database)`);
        } else {
          // Member not in our database yet (not processed)
          memberIds.push({
            mbid: rel.artist_mbid,
            name: rel.artist_name
          });
          console.log(`      ⚠️  ${rel.artist_name} (not in database yet)`);
        }
      }

      // Update group with member_ids
      await query(`
        UPDATE grc20_artists
        SET group_member_ids = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify(memberIds), artist.id]);

      groupsUpdated++;

      // Update each member with group reference (only if they're in database)
      const groupRef: GroupReference = {
        mbid: artist.mbid,                           // PRIMARY identifier
        name: artist.name,
        spotify_artist_id: artist.spotify_artist_id  // optional
      };

      for (const member of memberIds) {
        if (!member.spotify_artist_id) continue; // Skip members not in database

        // Get current member_of_groups
        const current = await query<{ member_of_groups: GroupReference[] }>(`
          SELECT member_of_groups FROM grc20_artists WHERE spotify_artist_id = $1
        `, [member.spotify_artist_id]);

        let memberOfGroups = current[0]?.member_of_groups || [];

        // Add if not already present
        if (!memberOfGroups.some((g: GroupReference) => g.mbid === artist.mbid)) {
          memberOfGroups.push(groupRef);

          await query(`
            UPDATE grc20_artists
            SET member_of_groups = $1,
                updated_at = NOW()
            WHERE spotify_artist_id = $2
          `, [JSON.stringify(memberOfGroups), member.spotify_artist_id]);

          membersUpdated++;
        }
      }

      console.log(`   ✅ Updated group + ${memberIds.filter(m => m.spotify_artist_id).length} members\n`);
    }

    // Check if this artist is a member (has "forward" relations = member of groups)
    // NOTE: direction="forward" means this member pointing TO groups (member → group)
    const groupRels = relations.filter(rel => rel.direction === 'forward');

    if (groupRels.length > 0) {
      // This is a MEMBER of group(s)
      console.log(`👤 ${artist.name} (Member)`);
      console.log(`   Member of ${groupRels.length} groups in MusicBrainz`);

      // Get current member_of_groups
      const current = await query<{ member_of_groups: GroupReference[] }>(`
        SELECT member_of_groups FROM grc20_artists WHERE id = $1
      `, [artist.id]);

      let memberOfGroups = current[0]?.member_of_groups || [];

      for (const rel of groupRels) {
        // Try to find this group in grc20_artists
        const group = await query<{
          spotify_artist_id: string;
          name: string;
        }>(`
          SELECT spotify_artist_id, name
          FROM grc20_artists
          WHERE mbid = $1
        `, [rel.artist_mbid]);

        if (group[0]) {
          const groupRef: GroupReference = {
            mbid: rel.artist_mbid,                     // PRIMARY identifier
            name: group[0].name,
            spotify_artist_id: group[0].spotify_artist_id  // optional
          };

          // Add if not already present
          if (!memberOfGroups.some((g: GroupReference) => g.mbid === rel.artist_mbid)) {
            memberOfGroups.push(groupRef);
            console.log(`      ✅ ${group[0].name} (in database)`);
          }
        } else {
          console.log(`      ⚠️  ${rel.artist_name} (group not in database yet)`);
        }
      }

      // Update member with group references
      await query(`
        UPDATE grc20_artists
        SET member_of_groups = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify(memberOfGroups), artist.id]);

      console.log(`   ✅ Updated member\n`);
    }
  }

  console.log('📊 Summary:');
  console.log(`   Groups updated: ${groupsUpdated}`);
  console.log(`   Member relationships added: ${membersUpdated}`);
  console.log('');

  // Show examples
  console.log('🔍 Example: Macklemore & Ryan Lewis');
  const macklemoreExample = await query(`
    SELECT
      name,
      artist_type,
      jsonb_pretty(group_member_ids) as members,
      jsonb_pretty(member_of_groups) as groups
    FROM grc20_artists
    WHERE name IN ('Macklemore & Ryan Lewis', 'Macklemore', 'Ryan Lewis')
    ORDER BY
      CASE
        WHEN artist_type = 'Group' THEN 0
        ELSE 1
      END,
      name
  `);

  macklemoreExample.forEach((row: any) => {
    console.log(`\n${row.name} (${row.artist_type || 'Unknown'}):`);
    if (row.members) {
      console.log(`   Members:\n${row.members}`);
    }
    if (row.groups) {
      console.log(`   Member of:\n${row.groups}`);
    }
  });

  console.log('\n🔍 Example: aespa (should have Korean members, NOT Grimes)');
  const aespaExample = await query(`
    SELECT
      name,
      artist_type,
      jsonb_pretty(group_member_ids) as members
    FROM grc20_artists
    WHERE name = 'aespa'
  `);

  if (aespaExample[0]) {
    console.log(`\n${aespaExample[0].name}:`);
    console.log(`   Members:\n${aespaExample[0].members || '[]'}`);
  }

  console.log('\n✅ Done! Relationships are now based on authoritative MusicBrainz data.');
}

main().catch(console.error);
