import { query } from './src/db/neon';

async function main() {
  // Check for GRC-20 related tables
  const tables = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE '%grc20%'
  `);

  console.log('GRC-20 tables:', tables.map(t => t.table_name));

  // Check grc20_artists status
  const artistCount = await query(`SELECT COUNT(*) as count FROM grc20_artists`);
  console.log('\ngrc20_artists:', artistCount[0].count, 'total');

  // Check if we have lens/pkp data
  const withAccounts = await query(`
    SELECT
      COUNT(*) FILTER (WHERE pkp_account_id IS NOT NULL) as with_pkp,
      COUNT(*) FILTER (WHERE lens_account_id IS NOT NULL) as with_lens
    FROM grc20_artists
  `);
  console.log('  - with PKP:', withAccounts[0].with_pkp);
  console.log('  - with Lens:', withAccounts[0].with_lens);

  process.exit(0);
}

main().catch(console.error);
