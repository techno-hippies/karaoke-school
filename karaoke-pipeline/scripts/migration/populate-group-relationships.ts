/**
 * Populate Group Relationships
 *
 * Links groups to their members and vice versa in grc20_artists table
 * Uses Spotify tracks data to infer relationships (artists appearing together)
 */

import { query } from '../../src/db/neon';

interface GroupMember {
  mbid: string;
  name: string;
  spotify_artist_id: string;
}

interface GroupReference {
  spotify_artist_id: string;
  name: string;
}

async function main() {
  console.log('🎭 Populating Group Relationships...\n');

  // Step 1: Process all groups - find their members
  const groups = await query<{
    id: number;
    name: string;
    spotify_artist_id: string;
    mbid: string | null;
  }>(`
    SELECT id, name, spotify_artist_id, mbid
    FROM grc20_artists
    WHERE artist_type = 'Group'
    ORDER BY name
  `);

  console.log(`📊 Found ${groups.length} groups to process\n`);

  let groupsUpdated = 0;
  let membersUpdated = 0;

  for (const group of groups) {
    console.log(`🎭 ${group.name}`);

    // Find potential members: artists who appear in same tracks as this group
    const potentialMembers = await query<{
      spotify_artist_id: string;
      name: string;
      mbid: string | null;
      artist_type: string | null;
    }>(`
      WITH group_tracks AS (
        SELECT DISTINCT st.spotify_track_id
        FROM spotify_tracks st,
        jsonb_array_elements(st.artists) as artist
        WHERE artist->>'id' = '${group.spotify_artist_id}'
      )
      SELECT DISTINCT
        ga.spotify_artist_id,
        ga.name,
        ga.mbid,
        ga.artist_type
      FROM group_tracks gt
      JOIN spotify_tracks st ON st.spotify_track_id = gt.spotify_track_id,
      jsonb_array_elements(st.artists) as member_artist
      JOIN grc20_artists ga ON ga.spotify_artist_id = member_artist->>'id'
      WHERE ga.spotify_artist_id != '${group.spotify_artist_id}'
        AND ga.artist_type = 'Person'
      LIMIT 20
    `);

    if (potentialMembers.length === 0) {
      console.log(`   ⚠️  No members found in processed tracks\n`);
      continue;
    }

    // Build group_member_ids array
    const memberIds: GroupMember[] = potentialMembers.map(m => ({
      mbid: m.mbid || '',
      name: m.name,
      spotify_artist_id: m.spotify_artist_id
    }));

    console.log(`   Found ${memberIds.length} members:`);
    memberIds.forEach(m => console.log(`      • ${m.name}`));

    // Update group with member_ids
    await query(`
      UPDATE grc20_artists
      SET group_member_ids = '${JSON.stringify(memberIds).replace(/'/g, "''")}'::jsonb,
          updated_at = NOW()
      WHERE id = ${group.id}
    `);

    groupsUpdated++;

    // Update each member with group reference
    const groupRef: GroupReference = {
      spotify_artist_id: group.spotify_artist_id,
      name: group.name
    };

    for (const member of potentialMembers) {
      // Check if already has this group
      const current = await query<{ member_of_groups: any[] }>(`
        SELECT member_of_groups FROM grc20_artists WHERE spotify_artist_id = '${member.spotify_artist_id}'
      `);

      let memberOfGroups = current[0]?.member_of_groups || [];

      // Add if not already present
      if (!memberOfGroups.some((g: any) => g.spotify_artist_id === group.spotify_artist_id)) {
        memberOfGroups.push(groupRef);

        await query(`
          UPDATE grc20_artists
          SET member_of_groups = '${JSON.stringify(memberOfGroups).replace(/'/g, "''")}'::jsonb,
              updated_at = NOW()
          WHERE spotify_artist_id = '${member.spotify_artist_id}'
        `);

        membersUpdated++;
      }
    }

    console.log(`   ✅ Updated group + ${potentialMembers.length} members\n`);
  }

  console.log('📊 Summary:');
  console.log(`   Groups updated: ${groupsUpdated}`);
  console.log(`   Member relationships added: ${membersUpdated}`);
  console.log('');

  // Show examples
  console.log('🔍 Example: Macklemore & Ryan Lewis');
  const example = await query(`
    SELECT
      name,
      artist_type,
      group_member_ids,
      member_of_groups
    FROM grc20_artists
    WHERE name IN ('Macklemore & Ryan Lewis', 'Macklemore', 'Ryan Lewis')
    ORDER BY
      CASE
        WHEN artist_type = 'Group' THEN 0
        ELSE 1
      END,
      name
  `);

  example.forEach((row: any) => {
    console.log(`\n${row.name} (${row.artist_type || 'Unknown'}):`);
    if (row.group_member_ids && row.group_member_ids.length > 0) {
      console.log(`   Members: ${row.group_member_ids.map((m: any) => m.name).join(', ')}`);
    }
    if (row.member_of_groups && row.member_of_groups.length > 0) {
      console.log(`   Member of: ${row.member_of_groups.map((g: any) => g.name).join(', ')}`);
    }
  });

  console.log('\n✅ Done!');
}

main().catch(console.error);
