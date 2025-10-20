#!/usr/bin/env bun

import chalk from 'chalk';
import { db, initDb } from '../../db/postgres';
import { sql } from 'drizzle-orm';
import { MLCSearchResultSchema, MLCWorkDetailsSchema } from '../../schemas/mlc-schemas';
import { JsonSaver } from '../../utils/json-saver';
import { z } from 'zod';

const GRIMES_IPI = '00633996999';
const baseUrl = 'https://api.ptl.themlc.com';

async function fetchMLCWorksByWriter(ipiNumber: string, page = 0): Promise<z.infer<typeof MLCSearchResultSchema> | null> {
  const url = `${baseUrl}/api2v/public/search/works?page=${page}&size=100`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'referer': 'https://portal.themlc.com/',
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    },
    body: JSON.stringify({ writerNameNumbers: ipiNumber })
  });

  if (!response.ok) {
    console.error(`Failed to fetch page ${page}: ${response.status}`);
    return null;
  }

  try {
    const data = await response.json();
    return MLCSearchResultSchema.parse(data);
  } catch (error) {
    console.error('Failed to parse MLC search response:', error);
    return null;
  }
}

export async function main() {
  console.log(chalk.bold.cyan('\n🎵 MLC OWNERSHIP DATA ENRICHMENT\n'));
  
  await initDb();
  
  const jsonSaver = new JsonSaver();
  const isni = '0000000356358936';
  const allWorksWithDetails: any[] = [];
  
  // Create MLC tables if they don't exist
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mlc_works (
      id VARCHAR(100) PRIMARY KEY,
      iswc VARCHAR(20),
      title VARCHAR(500) NOT NULL,
      total_known_shares DECIMAL(5,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mlc_writers (
      work_id VARCHAR(100),
      ipi VARCHAR(20),
      first_name VARCHAR(200),
      last_name VARCHAR(200),
      role VARCHAR(100),
      share_percentage DECIMAL(5,2),
      PRIMARY KEY (work_id, ipi),
      FOREIGN KEY (work_id) REFERENCES mlc_works(id) ON DELETE CASCADE
    )
  `);
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mlc_publishers (
      work_id VARCHAR(100),
      publisher_name VARCHAR(500),
      publisher_type VARCHAR(100),
      share_percentage DECIMAL(5,2),
      administrator_name VARCHAR(500),
      publisher_ipi VARCHAR(20),
      administrator_ipi VARCHAR(20),
      publisher_number VARCHAR(50),
      PRIMARY KEY (work_id, publisher_name),
      FOREIGN KEY (work_id) REFERENCES mlc_works(id) ON DELETE CASCADE
    )
  `);
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mlc_recordings (
      work_id VARCHAR(100),
      isrc VARCHAR(20),
      title VARCHAR(500),
      artist_name VARCHAR(500),
      PRIMARY KEY (work_id, isrc),
      FOREIGN KEY (work_id) REFERENCES mlc_works(id) ON DELETE CASCADE
    )
  `);
  
  // Clear existing data
  await db.execute(sql`TRUNCATE TABLE mlc_works, mlc_writers, mlc_publishers, mlc_recordings CASCADE`);
  
  console.log(chalk.yellow(`Fetching MLC works for IPI: ${GRIMES_IPI}\n`));
  
  let page = 0;
  let hasMore = true;
  const allWorks = [];
  
  // Fetch all pages
  while (hasMore) {
    console.log(chalk.gray(`Fetching page ${page + 1}...`));
    const data = await fetchMLCWorksByWriter(GRIMES_IPI, page);
    
    if (!data) break;
    
    allWorks.push(...data.content);
    hasMore = !data.last;
    page++;
    
    if (data.content.length === 0) break;
  }
  
  console.log(chalk.yellow(`\nFound ${allWorks.length} works. Processing...\n`));
  
  let worksInserted = 0;
  let writersInserted = 0;
  let publishersInserted = 0;
  let recordingsInserted = 0;
  
  // Process each work (data already complete from search)
  for (let i = 0; i < allWorks.length; i++) {
    const details = allWorks[i];  // Search response already has full details
    process.stdout.write(chalk.gray(`[${i+1}/${allWorks.length}] ${details.title.substring(0, 50)}... `));
    
    // Save to collection
    allWorksWithDetails.push(details);
    
    const workId = details.iswc || `mlc_${details.id}`;
    
    // Insert work
    await db.execute(sql`
      INSERT INTO mlc_works (id, iswc, title, total_known_shares)
      VALUES (
        ${workId},
        ${details.iswc || null},
        ${details.title},
        ${details.totalKnownShares || 0}
      )
      ON CONFLICT (id) DO NOTHING
    `);
    worksInserted++;
    
    // Insert writers
    if (details.writers) {
      for (const writer of details.writers) {
        if (writer.ipiNumber) {
          await db.execute(sql`
            INSERT INTO mlc_writers (work_id, ipi, first_name, last_name, role, share_percentage)
            VALUES (
              ${workId},
              ${writer.ipiNumber},
              ${writer.firstName || null},
              ${writer.lastName || null},
              ${writer.role || 'Writer'},
              ${writer.shareholderCopyrightOwnershipPercentage || 0}
            )
            ON CONFLICT DO NOTHING
          `);
          writersInserted++;
        }
      }
    }
    
    // Insert publishers with IPIs
    if (details.originalPublishers) {
      for (const pub of details.originalPublishers) {
        // Original publisher has its own IPI
        const pubIpi = pub.ipiNumber || null;
        const pubNumber = pub.hfaPublisherNumber || null;
        
        // If there are administrator publishers, insert each
        if (pub.administratorPublishers && pub.administratorPublishers.length > 0) {
          for (const admin of pub.administratorPublishers) {
            await db.execute(sql`
              INSERT INTO mlc_publishers (
                work_id, publisher_name, publisher_type, 
                share_percentage, administrator_name,
                publisher_ipi, administrator_ipi, publisher_number
              ) VALUES (
                ${workId},
                ${pub.publisherName || 'Unknown'},
                ${pub.publisherType || null},
                ${admin.publisherShare || 0},
                ${admin.publisherName || null},
                ${pubIpi},
                ${admin.ipiNumber || null},
                ${admin.hfaPublisherNumber || pubNumber}
              )
              ON CONFLICT DO NOTHING
            `);
            publishersInserted++;
          }
        } else {
          // No administrator, just the original publisher
          await db.execute(sql`
            INSERT INTO mlc_publishers (
              work_id, publisher_name, publisher_type, 
              share_percentage, administrator_name,
              publisher_ipi, administrator_ipi, publisher_number
            ) VALUES (
              ${workId},
              ${pub.publisherName || 'Unknown'},
              ${pub.publisherType || null},
              ${pub.publisherShare || pub.shareholderCopyrightOwnershipPercentage || 0},
              ${null},
              ${pubIpi},
              ${null},
              ${pubNumber}
            )
            ON CONFLICT DO NOTHING
          `);
          publishersInserted++;
        }
      }
    }
    
    // Insert recordings (handle nested structure)
    let recordings: any[] = [];
    if (details.matchedRecordings) {
      if ('recordings' in details.matchedRecordings) {
        // New format: { count: number, recordings: [...] }
        recordings = details.matchedRecordings.recordings || [];
      } else if (Array.isArray(details.matchedRecordings)) {
        // Old format: direct array
        recordings = details.matchedRecordings;
      }
    } else if (details.recordings) {
      recordings = details.recordings;
    }
    
    for (const recording of recordings) {
      if (recording.isrc) {
        await db.execute(sql`
          INSERT INTO mlc_recordings (work_id, isrc, title, artist_name)
          VALUES (
            ${workId},
            ${recording.isrc},
            ${recording.recordingTitle || null},
            ${recording.recordingDisplayArtistName || null}
          )
          ON CONFLICT DO NOTHING
        `);
        recordingsInserted++;
      }
    }
    
    console.log(chalk.green(`✓`));
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Save all works to JSON
  await jsonSaver.saveServiceData(isni, 'mlc', allWorksWithDetails, 'works.json');
  
  console.log(chalk.green(`\n✓ Inserted ${worksInserted} works`));
  console.log(chalk.green(`✓ Inserted ${writersInserted} writer credits`));
  console.log(chalk.green(`✓ Inserted ${publishersInserted} publisher records`));
  console.log(chalk.green(`✓ Inserted ${recordingsInserted} recording-work links`));
  
  // Show final stats
  const stats = await db.execute(sql`
    SELECT 
      (SELECT COUNT(*) FROM mlc_works WHERE iswc IS NOT NULL) as works_with_iswc,
      (SELECT COUNT(*) FROM mlc_works WHERE total_known_shares = 100) as complete_ownership,
      (SELECT COUNT(DISTINCT ipi) FROM mlc_writers) as unique_writers,
      (SELECT COUNT(DISTINCT publisher_name) FROM mlc_publishers) as unique_publishers,
      (SELECT COUNT(DISTINCT isrc) FROM mlc_recordings) as unique_isrcs
  `);
  
  const s = stats.rows[0] as any;
  console.log(chalk.bold.yellow('\n📊 MLC DATABASE STATS:\n'));
  console.log(`  Works with ISWC: ${s.works_with_iswc}`);
  console.log(`  Complete ownership (100%): ${s.complete_ownership}`);
  console.log(`  Unique writers: ${s.unique_writers}`);
  console.log(`  Unique publishers: ${s.unique_publishers}`);
  console.log(`  Unique ISRCs in MLC: ${s.unique_isrcs}`);
  
  console.log(chalk.bold.green('\n✅ MLC ENRICHMENT COMPLETE'));
}

// Allow running directly
if (import.meta.main) {
  main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
  });
}