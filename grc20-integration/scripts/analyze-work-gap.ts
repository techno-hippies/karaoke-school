import postgres from 'postgres';
import { config } from '../config';

const sql = postgres(config.neonConnectionString!);

console.log('🔍 Analyzing work data gap...\n');

// Current approach: genius_songs as primary source
const geniusWorks = await sql`
  SELECT 
    COUNT(*) as total_genius_songs,
    COUNT(DISTINCT genius_artist_id) as unique_artists_in_genius
  FROM genius_songs
`;

// CISAC works count
const cisacWorks = await sql`
  SELECT 
    COUNT(*) as total_cisac_works,
    COUNT(DISTINCT iswc) as unique_iswcs
  FROM cisac_works
`;

// Check if CISAC has artist linkage we could use
const cisacSample = await sql`
  SELECT 
    title,
    iswc,
    composers,
    authors
  FROM cisac_works
  LIMIT 3
`;

// Check Quansic works structure
const quansicWorks = await sql`
  SELECT COUNT(*) as total_quansic_works
  FROM quansic_works
`;

const quansicSample = await sql`
  SELECT raw_data
  FROM quansic_works
  LIMIT 1
`;

// Check if we can link CISAC → artists via IPI
const cisacArtistLinkage = await sql`
  SELECT 
    COUNT(DISTINCT cw.iswc) as cisac_works_with_potential_artist_link
  FROM cisac_works cw
  WHERE EXISTS (
    SELECT 1 FROM bmi_artist_ipis bai
    WHERE bai.artist_name IS NOT NULL
  )
`;

console.log('📊 Current State:');
console.log('Genius Songs (current primary source):');
console.log(geniusWorks[0]);

console.log('\n📚 CISAC Works (massive untapped source):');
console.log(cisacWorks[0]);

console.log('\n📚 Quansic Works:');
console.log(quansicWorks[0]);

console.log('\n🔗 CISAC Sample (checking artist linkage):');
console.log(cisacSample);

console.log('\n🔗 Quansic Sample (raw_data structure):');
if (quansicSample[0]) {
  console.log(JSON.stringify(quansicSample[0].raw_data, null, 2).slice(0, 500));
}

console.log('\n💡 Analysis:');
console.log(`- Genius has ${geniusWorks[0].total_genius_songs} works (current source)`);
console.log(`- CISAC has ${cisacWorks[0].total_cisac_works} works (13x more!)`);
console.log(`- We're missing ~${parseInt(cisacWorks[0].total_cisac_works) - parseInt(geniusWorks[0].total_genius_songs)} works`);
console.log('\n💡 Gap Explanation:');
console.log('We only create works from genius_songs (1,083 songs for 240 artists).');
console.log('CISAC has 14,349 works but we only use it for ISWC enrichment via fuzzy title matching.');
console.log('We should import ALL CISAC works and link them to artists via IPI/ISNI.');

await sql.end();
