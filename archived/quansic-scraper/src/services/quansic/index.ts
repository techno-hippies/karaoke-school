#!/usr/bin/env bun

/**
 * QUANSIC SERVICE - Handles authentication and API calls
 * 1. Uses Playwright to login/refresh auth if needed
 * 2. Makes direct API calls with the auth cookie
 * 3. Saves all data to JSON and database
 */

import chalk from 'chalk';
import { db, initDb } from '../../db/postgres';
import { sql } from 'drizzle-orm';
import { JsonSaver } from '../../utils/json-saver';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import fs from 'fs';
import { QuansicRecordingWorksResponseSchema } from '../../schemas/quansic-schemas';
import { z } from 'zod';

class QuansicAPI {
  private cookies: string = '';
  private browser?: Browser;
  private context?: BrowserContext;
  
  async ensureAuth(): Promise<void> {
    // Try loading existing auth
    try {
      const authData = JSON.parse(fs.readFileSync('auth-state.json', 'utf-8'));
      this.cookies = authData.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
      
      // Test if auth works
      const testResponse = await fetch('https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::0000000356358936', {
        headers: {
          'cookie': this.cookies,
          'accept': 'application/json'
        }
      });
      
      if (testResponse.ok) {
        console.log(chalk.green('✓ Using existing auth cookie'));
        return;
      }
    } catch (error) {
      // Auth doesn't exist or is expired
    }
    
    // Need to refresh auth using Playwright
    console.log(chalk.yellow('⚠ Auth expired, refreshing with Playwright...'));
    await this.refreshAuth();
  }
  
  async refreshAuth(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext();
    const page = await this.context.newPage();
    
    // Navigate to login
    await page.goto('https://auth.quansic.com/en/signin');
    await page.waitForLoadState('networkidle');
    
    // Login
    await page.fill('input[name="email"]', 'grimes@hypergraph.storage');
    await page.fill('input[name="password"]', 'grimes4us#');
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL('**/explorer.quansic.com/**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    // Save auth state
    const storageState = await this.context.storageState();
    fs.writeFileSync('auth-state.json', JSON.stringify(storageState, null, 2));
    this.cookies = storageState.cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    await this.browser.close();
    console.log(chalk.green('✓ Auth refreshed and saved'));
  }
  
  async fetchParty(isni: string): Promise<any> {
    const url = `https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::${isni}`;
    const response = await fetch(url, {
      headers: {
        'cookie': this.cookies,
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error(`Failed to fetch party: ${response.status}`);
    const data = await response.json();
    return data.results;
  }
  
  async fetchRecordings(isni: string): Promise<any> {
    const allRecordings = [];
    let offset = 0;
    const pageSize = 100;
    
    while (true) {
      const url = `https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::${isni}/recordings/${offset}/${pageSize}`;
      console.log(chalk.gray(`  Fetching recordings page ${offset/pageSize + 1}...`));
      
      const response = await fetch(url, {
        headers: {
          'cookie': this.cookies,
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.log(chalk.yellow(`  No more recordings at offset ${offset}`));
        break;
      }
      
      const data = await response.json();
      const recordings = data.results?.data || [];  // Changed from recordings to data!
      
      if (recordings.length === 0) break;
      
      allRecordings.push(...recordings);
      offset += pageSize;
      
      if (recordings.length < pageSize) break;
    }
    
    return { recordings: allRecordings };
  }
  
  async fetchWorks(isni: string): Promise<any> {
    const url = `https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::${isni}/works`;
    const response = await fetch(url, {
      headers: {
        'cookie': this.cookies,
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error(`Failed to fetch works: ${response.status}`);
    const data = await response.json();
    return data.results;
  }
  
  async fetchReleases(isni: string): Promise<any> {
    const url = `https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::${isni}/releases`;
    const response = await fetch(url, {
      headers: {
        'cookie': this.cookies,
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error(`Failed to fetch releases: ${response.status}`);
    const data = await response.json();
    return data.results;
  }
  
  async fetchRecordingWorks(isrc: string): Promise<any> {
    const url = `https://explorer.quansic.com/api/q/lookup/recording/isrc/${isrc}/works/0`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Cookie': this.cookies,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          await this.refreshAuth();
          return this.fetchRecordingWorks(isrc);
        }
        return null;
      }
      
      return response.json();
    } catch (error) {
      console.error(`Failed to fetch works for ${isrc}:`, error);
      return null;
    }
  }

  async fetchNameVariants(isni: string): Promise<any> {
    const url = `https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::${isni}/nameVariants`;
    const response = await fetch(url, {
      headers: {
        'cookie': this.cookies,
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error(`Failed to fetch name variants: ${response.status}`);
    const data = await response.json();
    return data.results;
  }
}

async function createQuansicTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quansic_artists (
      id VARCHAR(50) PRIMARY KEY,
      quansic_id VARCHAR(100),
      name VARCHAR(500) NOT NULL,
      type VARCHAR(50),
      birth_date DATE,
      nationality VARCHAR(10),
      language VARCHAR(10),
      isni VARCHAR(50),
      ipi VARCHAR(50),
      ipn VARCHAR(50),
      musicbrainz_id VARCHAR(100),
      spotify_id VARCHAR(100),
      apple_id VARCHAR(100),
      deezer_id VARCHAR(100),
      discogs_id VARCHAR(100),
      wikidata_id VARCHAR(100),
      all_identifiers JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quansic_recordings (
      id VARCHAR(50) PRIMARY KEY,
      artist_id VARCHAR(50),
      isrc VARCHAR(20),
      title VARCHAR(500),
      duration_ms INTEGER,
      year VARCHAR(10),
      spotify_id VARCHAR(100),
      apple_id VARCHAR(100),
      deezer_id VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES quansic_artists(id) ON DELETE CASCADE
    )
  `);
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quansic_works (
      id VARCHAR(100) PRIMARY KEY,
      artist_id VARCHAR(50),
      iswc VARCHAR(20),
      title VARCHAR(500),
      role VARCHAR(100),
      q1_score DECIMAL(5,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES quansic_artists(id) ON DELETE CASCADE
    )
  `);
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quansic_releases (
      id VARCHAR(100) PRIMARY KEY,
      artist_id VARCHAR(50),
      title VARCHAR(500),
      upc VARCHAR(50),
      type VARCHAR(50),
      year VARCHAR(10),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES quansic_artists(id) ON DELETE CASCADE
    )
  `);
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quansic_artist_aliases (
      id SERIAL PRIMARY KEY,
      artist_id VARCHAR(50),
      name VARCHAR(500),
      language VARCHAR(10),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES quansic_artists(id) ON DELETE CASCADE
    )
  `);
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quansic_recording_works (
      recording_isrc VARCHAR(50),
      work_iswc VARCHAR(50),
      work_title VARCHAR(500),
      q1_score INTEGER,
      q2_score INTEGER,
      PRIMARY KEY (recording_isrc, work_iswc),
      FOREIGN KEY (recording_isrc) REFERENCES quansic_recordings(id) ON DELETE CASCADE,
      FOREIGN KEY (work_iswc) REFERENCES quansic_works(id) ON DELETE CASCADE
    )
  `);
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quansic_work_contributors (
      id SERIAL PRIMARY KEY,
      work_iswc VARCHAR(50),
      contributor_name VARCHAR(500),
      contributor_role VARCHAR(100),
      contributor_isni VARCHAR(50),
      contributor_ipi VARCHAR(50),
      FOREIGN KEY (work_iswc) REFERENCES quansic_works(id) ON DELETE CASCADE
    )
  `);
}

export async function runQuansicIngestion() {
  console.log(chalk.bold.cyan('\n📥 QUANSIC DATA INGESTION\n'));
  
  await initDb();
  
  const isni = '0000000356358936';
  const jsonSaver = new JsonSaver();
  const api = new QuansicAPI();
  
  // Ensure we have valid auth (will use Playwright if needed)
  await api.ensureAuth();
  
  // Create tables
  await createQuansicTables();
  
  // Clear Quansic tables
  await db.execute(sql`TRUNCATE TABLE quansic_artists, quansic_releases, quansic_works, quansic_recordings, quansic_artist_aliases, quansic_recording_works, quansic_work_contributors CASCADE`);
  
  console.log(chalk.yellow('\n📊 Fetching Quansic data via API...\n'));
  
  // Fetch all data in parallel
  const [party, recordings, works, releases, nameVariants] = await Promise.all([
    api.fetchParty(isni),
    api.fetchRecordings(isni),
    api.fetchWorks(isni),
    api.fetchReleases(isni),
    api.fetchNameVariants(isni)
  ]);
  
  const fullData = {
    party,
    recordings,
    works,
    releases,
    nameVariants
  };
  
  console.log(chalk.yellow('📊 Data fetched:'));
  console.log(`  Artist: ${party.party.name}`);
  console.log(`  Birthday: ${party.party.birthdate}`);
  console.log(`  Recordings: ${recordings.recordings.length}`);
  console.log(`  Works: ${works.works.length}`);
  console.log(`  Releases: ${releases.releases.length}`);
  console.log(`  Name variants: ${nameVariants.nameVariants.length}\n`);
  
  // Save JSON for debugging
  await jsonSaver.saveServiceData(isni, 'quansic', fullData, 'complete.json');
  
  // Insert artist
  const artistId = party.party.ids.isnis[0];
  await db.execute(sql`
    INSERT INTO quansic_artists (
      id, quansic_id, name, type, birth_date, nationality, language,
      isni, ipi, ipn, musicbrainz_id, spotify_id, apple_id,
      deezer_id, discogs_id, wikidata_id, all_identifiers
    ) VALUES (
      ${artistId},
      ${party.party.quansicId},
      ${party.party.name},
      ${party.party.type},
      ${party.party.birthdate},
      ${party.party.nationality},
      ${party.party.language || null},
      ${artistId},
      ${party.party.ids.ipis?.[0] || null},
      ${party.party.ids.ipns?.[0] || null},
      ${party.party.ids.musicBrainzIds?.[0] || null},
      ${party.party.ids.spotifyIds?.[0] || null},
      ${party.party.ids.appleIds?.[0] || null},
      ${party.party.ids.deezerIds?.[0] || null},
      ${party.party.ids.discogsIds?.[0] || null},
      ${party.party.ids.wikidataIds?.[0] || null},
      ${JSON.stringify(party.party.ids)}
    )
    ON CONFLICT (id) DO NOTHING
  `);
  
  // Insert recordings
  console.log(chalk.gray(`Inserting ${recordings.recordings.length} recordings...`));
  for (const recording of recordings.recordings) {
    if (!recording.isrc) continue;
    
    let durationMs = null;
    if (recording.duration) {
      const [min, sec] = recording.duration.split(':').map(Number);
      durationMs = (min * 60 + sec) * 1000;
    }
    
    await db.execute(sql`
      INSERT INTO quansic_recordings (
        id, artist_id, isrc, title, duration_ms, year
      ) VALUES (
        ${recording.isrc},
        ${artistId},
        ${recording.isrc},
        ${recording.title + (recording.subtitle ? ' ' + recording.subtitle : '')},
        ${durationMs},
        ${recording.year || null}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }
  
  // Insert works
  console.log(chalk.gray(`Inserting ${works.works.length} works...`));
  for (const work of works.works) {
    const workId = work.iswc || `${artistId}_work_${work.title.replace(/\W+/g, '_').substring(0, 50)}`;
    await db.execute(sql`
      INSERT INTO quansic_works (id, artist_id, iswc, title, role, q1_score)
      VALUES (
        ${workId},
        ${artistId},
        ${work.iswc || null},
        ${work.title},
        ${work.role || 'Composer'},
        ${work.q1Score || null}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }
  
  // Insert releases
  console.log(chalk.gray(`Inserting ${releases.releases.length} releases...`));
  for (const release of releases.releases) {
    const releaseId = release.upc || `${artistId}_${release.title.replace(/\W+/g, '_').substring(0, 50)}`;
    await db.execute(sql`
      INSERT INTO quansic_releases (id, artist_id, title, upc, type, year)
      VALUES (
        ${releaseId},
        ${artistId},
        ${release.title},
        ${release.upc || null},
        ${release.type || 'Album'},
        ${release.year || null}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }
  
  // Insert name variants
  console.log(chalk.gray(`Inserting ${nameVariants.nameVariants.length} artist aliases...`));
  for (const variant of nameVariants.nameVariants) {
    const name = variant.fullname || variant.name;
    if (name) {
      await db.execute(sql`
        INSERT INTO quansic_artist_aliases (artist_id, name, language)
        VALUES (${artistId}, ${name}, ${variant.language || null})
      `);
    }
  }
  
  // Fetch and insert recording-work relationships and contributors
  console.log(chalk.yellow('\n📊 Fetching detailed work data for each recording...\n'));
  
  const allRecordingWorks = [];
  let recordingWorksCount = 0;
  let contributorsCount = 0;
  
  for (let i = 0; i < recordings.recordings.length; i++) {
    const recording = recordings.recordings[i];
    if (!recording.isrc) continue;
    
    process.stdout.write(chalk.gray(`[${i+1}/${recordings.recordings.length}] ${recording.isrc}: ${recording.title.substring(0, 30)}... `));
    
    try {
      const worksData = await api.fetchRecordingWorks(recording.isrc);
      
      if (!worksData || !worksData.results?.data) {
        console.log(chalk.yellow('✗ No works found'));
        continue;
      }
      
      // Validate with schema
      const validated = QuansicRecordingWorksResponseSchema.parse(worksData);
      const works = validated.results.data;
      
      // Save to collection for JSON export
      allRecordingWorks.push({ isrc: recording.isrc, works });
      
      for (const work of works) {
        // Insert recording-work relationship
        await db.execute(sql`
          INSERT INTO quansic_recording_works (
            recording_isrc, work_iswc, work_title, q1_score, q2_score
          ) VALUES (
            ${recording.isrc},
            ${work.iswc},
            ${work.title},
            ${work.q1Score || null},
            ${work.q2Score || null}
          )
          ON CONFLICT DO NOTHING
        `);
        recordingWorksCount++;
        
        // Insert contributors for this work
        if (work.contributors) {
          for (const contributor of work.contributors) {
            await db.execute(sql`
              INSERT INTO quansic_work_contributors (
                work_iswc, contributor_name, contributor_role, 
                contributor_isni, contributor_ipi
              ) VALUES (
                ${work.iswc},
                ${contributor.name},
                ${contributor.role || 'Composer'},
                ${contributor.ids?.isnis?.[0] || null},
                ${contributor.ids?.ipis?.[0] || null}
              )
              ON CONFLICT DO NOTHING
            `);
            contributorsCount++;
          }
        }
      }
      
      console.log(chalk.green(`✓ ${works.length} works`));
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
    }
  }
  
  // Save all recording works to JSON
  await jsonSaver.saveServiceData(isni, 'quansic', allRecordingWorks, 'recording-works.json');
  
  console.log(chalk.green(`\n✓ Found ${recordingWorksCount} recording-work relationships`));
  console.log(chalk.green(`✓ Found ${contributorsCount} work contributors`));
  
  // Show stats
  const stats = await db.execute(sql`
    SELECT 
      (SELECT COUNT(*) FROM quansic_recordings WHERE isrc IS NOT NULL) as recordings,
      (SELECT COUNT(*) FROM quansic_works WHERE iswc IS NOT NULL) as works,
      (SELECT birth_date FROM quansic_artists LIMIT 1) as birthday
  `);
  
  const s = stats.rows[0] as any;
  console.log(chalk.bold.green('\n✅ QUANSIC INGESTION COMPLETE'));
  console.log(`  Recordings with ISRC: ${s.recordings}`);
  console.log(`  Works with ISWC: ${s.works}`);
  console.log(`  Birthday: ${s.birthday}`);
}

// Allow running directly
if (import.meta.main) {
  runQuansicIngestion().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
  });
}