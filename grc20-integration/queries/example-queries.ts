/**
 * Example Queries for Karaoke School GRC-20 Integration
 *
 * Run: bun run scripts/test-queries.ts
 */

import { createClient, getPropertyValue, getRelatedEntities } from './graphql-client';

async function exampleQueries() {
  const client = createClient();

  console.log('🎵 GRC-20 Query Examples\n');

  // Example 1: Get work by Spotify ID
  console.log('1️⃣ Get work by Spotify ID');
  const work = await client.getWorkBySpotifyId('043dDJ9u0PQ3ooAXMgcwOe');
  if (work) {
    console.log(`   Title: ${work.name}`);
    console.log(`   Duration: ${getPropertyValue(work, 'Duration (ms)')} ms`);
    console.log(`   ISWC: ${getPropertyValue(work, 'ISWC') || 'N/A'}`);
    console.log(`   MBID: ${getPropertyValue(work, 'MusicBrainz ID') || 'N/A'}\n`);
  } else {
    console.log('   Not found\n');
  }

  // Example 2: Get segments for a work
  if (work) {
    console.log('2️⃣ Get segments for work');
    const segments = await client.getSegmentsByWork(work.id);
    console.log(`   Found ${segments.length} segments`);
    for (const segment of segments.slice(0, 3)) {
      const startMs = getPropertyValue(segment, 'Start Time (ms)');
      const endMs = getPropertyValue(segment, 'End Time (ms)');
      const instrumentalUri = getPropertyValue(segment, 'Instrumental Audio URI');
      console.log(`   - ${segment.name}`);
      console.log(`     Time: ${startMs}ms - ${endMs}ms`);
      console.log(`     Instrumental: ${instrumentalUri?.slice(0, 50)}...\n`);
    }
  }

  // Example 3: Search by ISWC
  console.log('3️⃣ Search by ISWC');
  const workByIswc = await client.getWorkByISWC('T-345.678.901-2');
  console.log(`   ${workByIswc ? `Found: ${workByIswc.name}` : 'Not found'}\n`);

  // Example 4: List all works
  console.log('4️⃣ List first 10 works');
  const allWorks = await client.getAllWorks(10);
  console.log(`   Found ${allWorks.length} works`);
  for (const w of allWorks.slice(0, 5)) {
    const spotifyId = getPropertyValue(w, 'Spotify ID');
    console.log(`   - ${w.name} (${spotifyId})`);
  }
  console.log();

  // Example 5: Get work with all related data
  console.log('5️⃣ Get work with full data');
  const fullWork = await client.getEntityById(work!.id);
  if (fullWork) {
    console.log(`   Name: ${fullWork.name}`);
    console.log(`   Types: ${fullWork.types.join(', ')}`);
    console.log(`   Properties:`);
    for (const prop of fullWork.properties) {
      console.log(`     - ${prop.property.name}: ${prop.value.slice(0, 50)}`);
    }
    console.log(`   Relations:`);
    for (const rel of fullWork.relations) {
      console.log(`     - ${rel.property.name} → ${rel.target.name}`);
    }
  }
}

// Run if called directly
if (import.meta.main) {
  exampleQueries().catch(console.error);
}

export { exampleQueries };
