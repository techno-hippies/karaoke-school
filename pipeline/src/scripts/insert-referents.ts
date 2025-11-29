import { fetchReferents } from '../services/genius';
import { neon } from '@neondatabase/serverless';
import { DATABASE_URL } from '../config';

const sql = neon(DATABASE_URL);
const songId = '31cb8fc3-2887-424d-8d6a-3091408e972f';
const geniusSongId = 207;

const refs = await fetchReferents(geniusSongId);
console.log('Fetched', refs.length, 'referents');

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
