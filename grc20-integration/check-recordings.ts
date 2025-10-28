import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

const stats = await sql`
  SELECT 
    COUNT(*) as total,
    COUNT(iswc) as with_iswc,
    COUNT(CASE WHEN enriched_at > NOW() - INTERVAL '5 minutes' THEN 1 END) as last_5_min
  FROM quansic_recordings
`;

console.log('📊 Quansic Recordings Stats:');
console.log(stats[0]);

const recent = await sql`
  SELECT isrc, title, iswc, work_title, enriched_at
  FROM quansic_recordings
  ORDER BY enriched_at DESC NULLS LAST
  LIMIT 10
`;

console.log('\n🎵 Most Recent Recordings:');
console.table(recent);
