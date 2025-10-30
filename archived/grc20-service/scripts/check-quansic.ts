import postgres from 'postgres';
import { config } from '../config';

const sql = postgres(config.neonConnectionString!);

const quansicStats = await sql`
  SELECT 
    COUNT(*) as total_quansic_artists,
    COUNT(DISTINCT musicbrainz_mbid) as unique_mbids,
    COUNT(*) FILTER (WHERE isni IS NOT NULL) as has_isni,
    COUNT(*) FILTER (WHERE apple_music_id IS NOT NULL) as has_apple_music,
    COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '30 minutes') as updated_last_30min
  FROM quansic_artists
`;

const mbCoverage = await sql`
  SELECT 
    COUNT(*) as total_mb_artists,
    COUNT(*) FILTER (WHERE mbid IN (SELECT DISTINCT musicbrainz_mbid FROM quansic_artists)) as has_quansic_match
  FROM musicbrainz_artists
`;

console.log('📊 Quansic Artist Data:');
console.log(quansicStats[0]);
console.log('\n📊 MusicBrainz → Quansic Coverage:');
console.log(mbCoverage[0]);

await sql.end();
