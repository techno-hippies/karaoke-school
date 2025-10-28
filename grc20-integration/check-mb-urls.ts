import postgres from 'postgres';
import { config } from './config';

const sql = postgres(config.neonConnectionString!);

async function main() {
  // Check what URL relations are actually in MusicBrainz raw_data
  const sample = await sql`
    SELECT 
      name,
      raw_data->'relations' as relations
    FROM musicbrainz_artists
    WHERE name IN ('Lana Del Rey', 'Taylor Swift', 'Drake')
    LIMIT 3
  `;
  
  console.log('=== RAW RELATIONS DATA ===\n');
  for (const artist of sample) {
    console.log(`\n${artist.name}:`);
    const relations = artist.relations as any[];
    
    // Filter URL relations
    const urlRels = relations?.filter(r => r.url) || [];
    
    console.log(`Total URL relations: ${urlRels.length}`);
    
    // Group by platform
    const platforms = {
      apple: urlRels.filter(r => r.url.resource?.includes('apple.com')),
      spotify: urlRels.filter(r => r.url.resource?.includes('spotify.com')),
      deezer: urlRels.filter(r => r.url.resource?.includes('deezer.com')),
      tidal: urlRels.filter(r => r.url.resource?.includes('tidal.com')),
      youtube: urlRels.filter(r => r.url.resource?.includes('youtube.com')),
    };
    
    console.log('Platform URLs found:');
    for (const [platform, rels] of Object.entries(platforms)) {
      if (rels.length > 0) {
        console.log(`  ${platform}: ${rels.length} URL(s)`);
        rels.forEach(r => console.log(`    - ${r.url.resource}`));
      }
    }
  }
  
  await sql.end();
}

main();
