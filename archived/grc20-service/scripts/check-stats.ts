import postgres from 'postgres';
import { config } from '../config';

const sql = postgres(config.neonConnectionString!);

const artistResults = await sql`
  SELECT 
    COUNT(*) as total_artists,
    COUNT(*) FILTER (WHERE ready_to_mint) as ready_to_mint,
    COUNT(*) FILTER (WHERE mbid IS NOT NULL) as has_mbid,
    COUNT(*) FILTER (WHERE isni IS NOT NULL) as has_isni,
    COUNT(*) FILTER (WHERE music_platform_count >= 1) as has_music_platform,
    COUNT(*) FILTER (WHERE array_length(mint_blocking_reasons, 1) > 0) as has_blocking_reasons
  FROM grc20_artists
`;

const workResults = await sql`
  SELECT 
    COUNT(*) as total_works,
    COUNT(*) FILTER (WHERE ready_to_mint) as ready_to_mint,
    COUNT(*) FILTER (WHERE isrc IS NOT NULL) as has_isrc,
    COUNT(*) FILTER (WHERE iswc IS NOT NULL) as has_iswc,
    COUNT(*) FILTER (WHERE array_length(mint_blocking_reasons, 1) > 0) as has_blocking_reasons
  FROM grc20_works
`;

console.log('📊 Artist Statistics:');
console.log(artistResults[0]);
console.log('\n📊 Work Statistics:');
console.log(workResults[0]);

await sql.end();
