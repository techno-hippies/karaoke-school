import { parseArgs } from 'util';
import { fetchReferents } from '../services/genius';
import { neon } from '@neondatabase/serverless';
import { DATABASE_URL } from '../config';
import { getSongByISWC } from '../db/queries';
import { normalizeISWC } from '../lib/lyrics-parser';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    'genius-id': { type: 'string' },
  },
  strict: true,
});

if (!values.iswc || !values['genius-id']) {
  console.error('Usage: bun src/scripts/insert-referents.ts --iswc=T0123456789 --genius-id=12345');
  process.exit(1);
}

const iswc = normalizeISWC(values.iswc);
const geniusSongId = parseInt(values['genius-id'], 10);

const song = await getSongByISWC(iswc);
if (!song) {
  console.error(`Song not found: ${iswc}`);
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const songId = song.id;

const refs = await fetchReferents(geniusSongId);
console.log(`Fetched ${refs.length} referents for "${song.title}"`);

let inserted = 0;
for (const ref of refs) {
  const annotation = ref.annotations?.[0];
  if (!annotation) continue;

  await sql`
    INSERT INTO genius_referents (song_id, referent_id, genius_song_id, fragment, classification, annotations, votes_total, is_verified)
    VALUES (${songId}, ${ref.id}, ${geniusSongId}, ${ref.fragment}, ${ref.classification}, ${JSON.stringify(ref.annotations)}, ${annotation.votes_total || 0}, ${annotation.verified || false})
    ON CONFLICT (song_id, referent_id) DO NOTHING
  `;
  inserted++;
}

console.log('Inserted', inserted, 'referents');
