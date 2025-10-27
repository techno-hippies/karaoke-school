/**
 * CISAC IPI Discovery Cron (runs every 2 hours)
 *
 * CATALOG VACUUM: Discovers ALL works by creators with known IPIs.
 *
 * This is a long-running, comprehensive enrichment that builds a complete
 * catalog of compositions by searching CISAC's database by IPI (Name Number).
 *
 * Priority:
 * 1. MusicBrainz IPIs (performers/artists we care about)
 * 2. Quansic IPIs (composers discovered via ISWC lookup)
 * 3. Other sources
 *
 * Stores results in cisac_works and logs in ipi_search_log.
 */

import { NeonDB } from '../neon';
import { CISACService } from '../services/cisac';
import type { Env } from '../types';

export default async function runCISACIPIDiscovery(env: Env): Promise<void> {
  console.log('🔢 CISAC IPI Discovery Cron: Starting...');

  if (!env.CISAC_SERVICE_URL) {
    console.log('CISAC service URL not configured, skipping');
    return;
  }

  const db = new NeonDB(env.NEON_DATABASE_URL);
  const cisacService = new CISACService(env.CISAC_SERVICE_URL);

  try {
    const viableIPIs = await db.sql`
      SELECT DISTINCT ON (ai.name_number)
        ai.name_number, ai.ipi_with_zeros, ai.creator_name, ai.source
      FROM all_ipis ai
      LEFT JOIN ipi_search_log isl ON ai.name_number = isl.name_number
      WHERE isl.name_number IS NULL
      ORDER BY
        ai.name_number,
        CASE ai.source
          WHEN 'musicbrainz' THEN 1  -- Prioritize performers (artists we care about)
          WHEN 'quansic' THEN 2
          ELSE 3
        END
      LIMIT 1000
    `;

    if (viableIPIs.length === 0) {
      console.log('No IPIs need searching');
      return;
    }

    console.log(`Searching CISAC for ${viableIPIs.length} IPIs to discover their work catalogs...`);
    let totalWorksFound = 0;

    for (const ipi of viableIPIs) {
      try {
        console.log(`  Searching IPI ${ipi.name_number} (${ipi.creator_name} from ${ipi.source})...`);

        // Search CISAC by name number (returns ALL works by this creator)
        const works = await cisacService.searchByNameNumber(parseInt(ipi.name_number, 10));

        // Store all discovered works
        for (const work of works) {
          try {
            // Upsert into cisac_works (ISWC is primary key, prevents duplicates)
            await db.sql`
              INSERT INTO cisac_works (
                iswc, title, iswc_status, raw_data, fetched_at, updated_at
              ) VALUES (
                ${work.iswc},
                ${work.title},
                ${work.iswc_status},
                ${JSON.stringify(work)}::jsonb,
                NOW(),
                NOW()
              )
              ON CONFLICT (iswc)
              DO UPDATE SET
                title = EXCLUDED.title,
                iswc_status = EXCLUDED.iswc_status,
                raw_data = EXCLUDED.raw_data,
                updated_at = NOW()
            `;
            totalWorksFound++;
          } catch (error) {
            console.error(`    Error storing work ${work.iswc}:`, error);
          }
        }

        // Log search in ipi_search_log
        await db.sql`
          INSERT INTO ipi_search_log (
            name_number, ipi_with_zeros, creator_name, source, works_found, searched_at
          ) VALUES (
            ${ipi.name_number},
            ${ipi.ipi_with_zeros},
            ${ipi.creator_name},
            ${ipi.source},
            ${works.length},
            NOW()
          )
          ON CONFLICT (name_number)
          DO UPDATE SET
            works_found = EXCLUDED.works_found,
            searched_at = NOW(),
            last_error = NULL
        `;

        console.log(`  ✓ Found ${works.length} works for ${ipi.creator_name}`);
      } catch (error: any) {
        console.error(`  ❌ Error searching IPI ${ipi.name_number}:`, error);

        // Log error in ipi_search_log
        await db.sql`
          INSERT INTO ipi_search_log (
            name_number, ipi_with_zeros, creator_name, source, works_found, searched_at, last_error
          ) VALUES (
            ${ipi.name_number},
            ${ipi.ipi_with_zeros},
            ${ipi.creator_name},
            ${ipi.source},
            0,
            NOW(),
            ${error.message}
          )
          ON CONFLICT (name_number)
          DO UPDATE SET
            last_error = EXCLUDED.last_error,
            searched_at = NOW()
        `;
      }
    }

    console.log(`✅ CISAC IPI Discovery: ${totalWorksFound} works discovered from ${viableIPIs.length} IPIs`);
  } catch (error) {
    console.error('❌ CISAC IPI Discovery failed:', error);
    throw error;
  }
}
