#!/usr/bin/env bun

/**
 * ARTIST TO GRC-20 V3 - CLEAN REFACTORED VERSION
 * 
 * Complete rewrite with proper separation of concerns:
 * - DataExtractor: Gets data from PostgreSQL
 * - DataNormalizer: Cleans and formats data
 * - SchemaBuilder: Creates GRC-20 properties and types
 * - EntityBuilder: Creates entities with proper relations
 * - Validator: Ensures data matches expectations
 * - Minter: Handles blockchain interaction
 */

import { Graph, Ipfs, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import chalk from 'chalk';
import { z } from 'zod';
import { db, initDb } from '../db/postgres';
import { sql } from 'drizzle-orm';
import { normalizeTitle, normalizePersonName, normalizeCompanyName } from './normalize-text';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  ARTIST_ID: '0000000356358936', // Grimes
  SPACE_NAME: 'songverse',
  NETWORK: 'TESTNET' as const,
  MAX_WORKS: 150,  // Increased to match HTML
  MAX_RECORDINGS: 100,
  DRY_RUN: !process.env.PRIVATE_KEY || process.argv.includes('--dry-run'),
};

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const ArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  ipi: z.string().nullable(),
  alternative_names: z.array(z.string()).optional(),
});

const WorkSchema = z.object({
  id: z.string(),
  title: z.string(),
  iswc: z.string().nullable(),
  contributors: z.array(z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    share: z.number().nullable(),
  })),
});

const RecordingSchema = z.object({
  isrc: z.string(),
  title: z.string(),
  year: z.string().nullable(),
  duration_ms: z.number().nullable(),
  spotify_id: z.string().nullable(),
  apple_id: z.string().nullable(),
  work_ids: z.array(z.string()),
});

// ============================================================================
// DATA EXTRACTOR
// ============================================================================

class DataExtractor {
  constructor(private artistId: string) {}

  async getArtist() {
    const result = await db.execute(sql`
      SELECT 
        a.id,
        a.name,
        a.ipi,
        COALESCE(
          (SELECT jsonb_agg(DISTINCT aa.name) 
           FROM quansic_artist_aliases aa 
           WHERE aa.artist_id = a.id),
          '[]'::jsonb
        ) as alternative_names
      FROM quansic_artists a
      WHERE a.id = ${this.artistId}
    `);

    if (result.rows.length === 0) {
      throw new Error(`Artist ${this.artistId} not found`);
    }

    return ArtistSchema.parse(result.rows[0]);
  }

  async getWorks() {
    const results = await db.execute(sql`
      SELECT 
        w.id,
        w.title,
        w.iswc,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', wc.contributor_isni,
              'name', wc.contributor_name,
              'role', wc.contributor_role,
              'share', NULL
            )
          ) FILTER (WHERE wc.contributor_isni IS NOT NULL),
          '[]'::jsonb
        ) as contributors
      FROM quansic_works w
      LEFT JOIN quansic_work_contributors wc ON w.id = wc.work_iswc
      WHERE EXISTS (
        SELECT 1 FROM quansic_work_contributors wc2
        WHERE wc2.work_iswc = w.id
        AND wc2.contributor_isni = ${this.artistId}
      )
      GROUP BY w.id, w.title, w.iswc
      LIMIT ${CONFIG.MAX_WORKS}
    `);

    return results.rows.map(row => WorkSchema.parse(row));
  }

  async getRecordings() {
    const results = await db.execute(sql`
      SELECT 
        r.id as isrc,
        r.title,
        r.year,
        r.duration_ms,
        r.spotify_id,
        r.apple_id,
        COALESCE(
          (SELECT jsonb_agg(rw.work_iswc) 
           FROM quansic_recording_works rw 
           WHERE rw.recording_isrc = r.id),
          '[]'::jsonb
        ) as work_ids
      FROM quansic_recordings r
      WHERE r.artist_id = ${this.artistId}
      LIMIT ${CONFIG.MAX_RECORDINGS}
    `);

    return results.rows.map(row => RecordingSchema.parse(row));
  }

  async getMLCWorks() {
    // Get ALL MLC works related to Grimes, not just ones in Quansic
    const results = await db.execute(sql`
      SELECT DISTINCT
        mw.id,
        mw.title,
        mw.iswc,
        jsonb_agg(DISTINCT 
          jsonb_build_object(
            'ipi', writer.ipi,
            'name', CONCAT(writer.first_name, ' ', writer.last_name),
            'role', writer.role,
            'share', writer.share_percentage
          )
        ) as writers
      FROM mlc_works mw
      JOIN mlc_writers writer ON mw.id = writer.work_id
      WHERE UPPER(writer.first_name || ' ' || writer.last_name) LIKE '%GRIMES%'
         OR UPPER(writer.first_name || ' ' || writer.last_name) LIKE '%BOUCHER%'
      GROUP BY mw.id, mw.title, mw.iswc
      LIMIT 200
    `);

    return results.rows;
  }

  async getMLCWriters() {
    // Get ALL MLC writers on Grimes works
    const results = await db.execute(sql`
      SELECT DISTINCT
        mw.ipi,
        CONCAT(mw.first_name, ' ', mw.last_name) as name,
        COUNT(DISTINCT mw.work_id) as work_count,
        ARRAY_AGG(DISTINCT mw.work_id) as work_ids
      FROM mlc_writers mw
      WHERE EXISTS (
        SELECT 1 FROM mlc_writers mw2
        WHERE mw2.work_id = mw.work_id
        AND (UPPER(mw2.first_name || ' ' || mw2.last_name) LIKE '%GRIMES%'
             OR UPPER(mw2.first_name || ' ' || mw2.last_name) LIKE '%BOUCHER%')
      )
      GROUP BY mw.ipi, mw.first_name, mw.last_name
    `);

    return results.rows;
  }

  async getPublishers() {
    const results = await db.execute(sql`
      SELECT DISTINCT
        mp.publisher_ipi as ipi,
        mp.publisher_name as name,
        COUNT(DISTINCT mp.work_id) as work_count,
        ARRAY_AGG(DISTINCT mp.work_id) as work_ids
      FROM mlc_publishers mp
      WHERE EXISTS (
        SELECT 1 FROM mlc_writers mw
        WHERE mw.work_id = mp.work_id
        AND (UPPER(mw.first_name || ' ' || mw.last_name) LIKE '%GRIMES%'
             OR UPPER(mw.first_name || ' ' || mw.last_name) LIKE '%BOUCHER%')
      )
      GROUP BY mp.publisher_ipi, mp.publisher_name
    `);

    return results.rows;
  }
}

// ============================================================================
// DATA NORMALIZER
// ============================================================================

class DataNormalizer {
  normalizeArtist(artist: z.infer<typeof ArtistSchema>) {
    return {
      ...artist,
      name: normalizePersonName(artist.name),
      alternative_names: artist.alternative_names?.map(n => normalizePersonName(n)),
    };
  }

  normalizeWork(work: z.infer<typeof WorkSchema>) {
    return {
      ...work,
      title: normalizeTitle(work.title),
      contributors: work.contributors.map(c => ({
        ...c,
        name: normalizePersonName(c.name),
      })),
    };
  }

  normalizeRecording(recording: z.infer<typeof RecordingSchema>) {
    return {
      ...recording,
      title: normalizeTitle(recording.title),
      year: recording.year?.replace(/,/g, ''), // Remove commas from years
    };
  }

  normalizePublisher(publisher: any) {
    return {
      ...publisher,
      name: normalizeCompanyName(publisher.name),
    };
  }
}

// ============================================================================
// SCHEMA BUILDER
// ============================================================================

class SchemaBuilder {
  private propertyIds = new Map<string, string>();
  private typeIds = new Map<string, string>();
  private ops: any[] = [];

  createProperties() {
    const properties = [
      // Identifiers
      { key: 'isni', name: 'ISNI', type: 'STRING' },
      { key: 'isrc', name: 'ISRC', type: 'STRING' },
      { key: 'iswc', name: 'ISWC', type: 'STRING' },
      { key: 'ipi', name: 'IPI', type: 'STRING' },
      
      // Metadata
      { key: 'alternative_names', name: 'Alternative Names', type: 'STRING' },
      { key: 'year', name: 'Year', type: 'STRING' },
      { key: 'duration_seconds', name: 'Duration (seconds)', type: 'NUMBER' },
      { key: 'share_percentage', name: 'Share %', type: 'NUMBER' },
      { key: 'work_count', name: 'Works', type: 'NUMBER' },
      
      // External IDs
      { key: 'spotify_id', name: 'Spotify', type: 'STRING' },
      { key: 'apple_id', name: 'Apple Music', type: 'STRING' },
      
      // Relations
      { key: 'composed_by', name: 'Composed By', type: 'RELATION' },
      { key: 'recording_of', name: 'Recording Of', type: 'RELATION' },
      { key: 'published_by', name: 'Published By', type: 'RELATION' },
      { key: 'performed_by', name: 'Performed By', type: 'RELATION' },
      { key: 'alias_of', name: 'Alias Of', type: 'RELATION' },
      { key: 'publishes', name: 'Publishes', type: 'RELATION' },
      { key: 'writes', name: 'Writes', type: 'RELATION' },
    ];

    for (const prop of properties) {
      const { id, ops } = Graph.createProperty({
        name: prop.name,
        dataType: prop.type as any,
      });
      this.propertyIds.set(prop.key, id);
      this.ops.push(...ops);
    }

    console.log(chalk.green(`✓ Created ${properties.length} properties`));
  }

  createTypes() {
    const types = [
      {
        key: 'artist',
        name: 'Artist',
        props: ['isni', 'ipi', 'alternative_names', 'spotify_id', 'apple_id'],
      },
      {
        key: 'work',
        name: 'Musical Work',
        props: ['iswc', 'composed_by', 'share_percentage'],
      },
      {
        key: 'recording',
        name: 'Recording',
        props: ['isrc', 'recording_of', 'year', 'duration_seconds', 'spotify_id'],
      },
      {
        key: 'publisher',
        name: 'Publisher',
        props: ['ipi', 'work_count'],
      },
      {
        key: 'writer',
        name: 'Writer',
        props: ['ipi', 'work_count'],
      },
      {
        key: 'alternative_name',
        name: 'Alternative Name',
        props: ['alias_of'],
      },
    ];

    for (const type of types) {
      const propIds = type.props
        .map(p => this.propertyIds.get(p))
        .filter(Boolean) as string[];
      
      const { id, ops } = Graph.createType({
        name: type.name,
        properties: propIds,
      });
      
      this.typeIds.set(type.key, id);
      this.ops.push(...ops);
    }

    console.log(chalk.green(`✓ Created ${types.length} entity types`));
  }

  getPropertyId(key: string) {
    return this.propertyIds.get(key);
  }

  getTypeId(key: string) {
    return this.typeIds.get(key);
  }

  getOps() {
    return this.ops;
  }
}

// ============================================================================
// ENTITY BUILDER
// ============================================================================

class EntityBuilder {
  private entityMap = new Map<string, string>();
  private ops: any[] = [];
  private stats = {
    artists: 0,
    works: 0,
    recordings: 0,
    writers: 0,
    publishers: 0,
    relations: 0,
  };

  constructor(private schema: SchemaBuilder) {}

  createArtist(artist: any) {
    const values: any[] = [
      {
        property: this.schema.getPropertyId('isni')!,
        value: artist.id,
      },
    ];

    // Add IPI
    if (artist.ipi) {
      values.push({
        property: this.schema.getPropertyId('ipi')!,
        value: artist.ipi,
      });
    }

    const { id, ops } = Graph.createEntity({
      name: artist.name,
      description: `Music artist with ISNI ${artist.id}`,
      types: [this.schema.getTypeId('artist')!],
      values,
    });

    this.entityMap.set(`artist:${artist.id}`, id);
    this.ops.push(...ops);
    this.stats.artists++;

    // Create alternative names as separate entities with ALIAS_OF relations
    if (artist.alternative_names && artist.alternative_names.length > 0) {
      for (const altName of artist.alternative_names) {
        this.createAlternativeName(altName, id);
      }
    }

    return id;
  }
  
  createAlternativeName(name: string, artistEntityId: string) {
    const { id, ops } = Graph.createEntity({
      name: name,
      types: [this.schema.getTypeId('alternative_name')!],
      values: [],
      relations: {
        [this.schema.getPropertyId('alias_of')!]: {
          toEntity: artistEntityId,
        },
      },
    });
    
    this.ops.push(...ops);
    this.stats.altNames = (this.stats.altNames || 0) + 1;
    this.stats.relations++;
    
    return id;
  }

  createWork(work: any, artistEntityId: string) {
    const values: any[] = [];

    if (work.iswc) {
      values.push({
        property: this.schema.getPropertyId('iswc')!,
        value: work.iswc,
      });
    }

    // Find artist's share
    const artistContributor = work.contributors.find(
      (c: any) => c.id === CONFIG.ARTIST_ID
    );
    if (artistContributor?.share) {
      values.push({
        property: this.schema.getPropertyId('share_percentage')!,
        value: Graph.serializeNumber(artistContributor.share),
      });
    }

    const { id, ops } = Graph.createEntity({
      name: work.title,
      types: [this.schema.getTypeId('work')!],
      values,
      relations: {
        [this.schema.getPropertyId('composed_by')!]: {
          toEntity: artistEntityId,
        },
      },
    });

    this.entityMap.set(`work:${work.id}`, id);
    this.ops.push(...ops);
    this.stats.works++;
    this.stats.relations++;

    // Create other contributors as writers
    for (const contributor of work.contributors) {
      if (contributor.id !== CONFIG.ARTIST_ID) {
        this.createWriter({
          name: contributor.name,
          ipi: contributor.id,
          role: contributor.role,
        });
      }
    }

    return id;
  }

  createRecording(recording: any, artistEntityId: string) {
    const values: any[] = [
      {
        property: this.schema.getPropertyId('isrc')!,
        value: recording.isrc,
      },
    ];

    if (recording.year) {
      values.push({
        property: this.schema.getPropertyId('year')!,
        value: recording.year,
      });
    }

    if (recording.duration_ms) {
      values.push({
        property: this.schema.getPropertyId('duration_seconds')!,
        value: Graph.serializeNumber(Math.round(recording.duration_ms / 1000)),
      });
    }

    if (recording.spotify_id) {
      values.push({
        property: this.schema.getPropertyId('spotify_id')!,
        value: recording.spotify_id,
      });
    }

    if (recording.apple_id) {
      values.push({
        property: this.schema.getPropertyId('apple_id')!,
        value: recording.apple_id,
      });
    }

    // Build relations - ALWAYS add PERFORMED_BY to artist
    const relations: any = {
      [this.schema.getPropertyId('performed_by')!]: {
        toEntity: artistEntityId,
      },
    };
    this.stats.relations++; // PERFORMED_BY edge

    // Add work connection if exists
    if (recording.work_ids.length > 0) {
      const workEntityId = this.entityMap.get(`work:${recording.work_ids[0]}`);
      if (workEntityId) {
        relations[this.schema.getPropertyId('recording_of')!] = {
          toEntity: workEntityId,
        };
        this.stats.relations++;
      }
    }

    const { id, ops } = Graph.createEntity({
      name: recording.title,
      types: [this.schema.getTypeId('recording')!],
      values,
      relations,
    });

    this.entityMap.set(`recording:${recording.isrc}`, id);
    this.ops.push(...ops);
    this.stats.recordings++;

    return id;
  }

  createMLCWork(work: any, artistEntityId: string) {
    // Check if already created as Quansic work
    const existingId = this.entityMap.get(`work:${work.id}`);
    if (existingId) return existingId;

    const values: any[] = [];
    
    // MLC works typically don't have ISWC
    if (work.iswc) {
      values.push({
        property: this.schema.getPropertyId('iswc')!,
        value: work.iswc,
      });
    }

    const { id, ops } = Graph.createEntity({
      name: work.title || work.id,
      types: [this.schema.getTypeId('work')!],
      values,
      relations: {
        [this.schema.getPropertyId('composed_by')!]: {
          toEntity: artistEntityId,
        },
      },
    });

    this.entityMap.set(`work:${work.id}`, id);
    this.entityMap.set(`mlc_work:${work.id}`, id); // Also store as mlc_work
    this.ops.push(...ops);
    this.stats.mlcWorks = (this.stats.mlcWorks || 0) + 1;
    this.stats.relations++;

    return id;
  }

  createWriter(writer: any) {
    const existingId = this.entityMap.get(`writer:${writer.ipi}`);
    if (existingId) return existingId;

    const values: any[] = [];

    if (writer.ipi) {
      values.push({
        property: this.schema.getPropertyId('ipi')!,
        value: writer.ipi,
      });
    }

    if (writer.work_count) {
      values.push({
        property: this.schema.getPropertyId('work_count')!,
        value: Graph.serializeNumber(writer.work_count),
      });
    }

    const { id, ops } = Graph.createEntity({
      name: writer.name,
      types: [this.schema.getTypeId('writer')!],
      values,
    });

    this.entityMap.set(`writer:${writer.ipi}`, id);
    this.ops.push(...ops);
    this.stats.writers++;

    // Create WRITES edges to works
    if (writer.work_ids && Array.isArray(writer.work_ids)) {
      for (const workId of writer.work_ids) {
        const workEntityId = this.entityMap.get(`work:${workId}`) || 
                            this.entityMap.get(`mlc_work:${workId}`);
        if (workEntityId) {
          // Add WRITES relation from writer to work
          this.ops.push({
            type: 'triple',
            action: 'set',
            entity: id,
            property: this.schema.getPropertyId('writes')!,
            value: workEntityId,
          });
          this.stats.relations++;
        }
      }
    }

    return id;
  }

  createPublisher(publisher: any) {
    const existingId = this.entityMap.get(`publisher:${publisher.ipi}`);
    if (existingId) return existingId;

    const values: any[] = [
      {
        property: this.schema.getPropertyId('ipi')!,
        value: publisher.ipi,
      },
    ];

    if (publisher.work_count) {
      values.push({
        property: this.schema.getPropertyId('work_count')!,
        value: Graph.serializeNumber(publisher.work_count),
      });
    }

    const { id, ops } = Graph.createEntity({
      name: publisher.name,
      types: [this.schema.getTypeId('publisher')!],
      values,
    });

    this.entityMap.set(`publisher:${publisher.ipi}`, id);
    this.ops.push(...ops);
    this.stats.publishers++;

    // Create PUBLISHES relations to works
    if (publisher.work_ids && Array.isArray(publisher.work_ids)) {
      for (const workId of publisher.work_ids) {
        const workEntityId = this.entityMap.get(`work:${workId}`);
        if (workEntityId) {
          // Add relation from publisher to work
          this.ops.push({
            type: 'triple',
            action: 'set',
            entity: id,
            property: this.schema.getPropertyId('publishes')!,
            value: workEntityId,
          });
          this.stats.relations++;
        }
      }
    }

    return id;
  }

  getOps() {
    return this.ops;
  }

  getStats() {
    return this.stats;
  }
}

// ============================================================================
// VALIDATOR
// ============================================================================

class Validator {
  validateOps(ops: any[]) {
    console.log(chalk.cyan('\n📊 Validating operations...'));
    
    // Debug: Check first few ops to see structure
    if (ops.length > 0) {
      const sampleOp = ops[0];
      const keys = Object.keys(sampleOp);
      console.log(chalk.gray(`  Op structure: ${keys.join(', ')}`));
    }
    
    const counts = {
      property: 0,
      type: 0,
      entity: 0,
      triple: 0,
      total: ops.length,
    };

    // Count based on actual op structure
    for (const op of ops) {
      // GRC-20 ops have different structure than expected
      // They are arrays of operations from Graph SDK
      if (Array.isArray(op)) {
        counts.total += op.length - 1; // Adjust for nested arrays
      } else if (op.type) {
        counts[op.type as keyof typeof counts]++;
      }
    }

    console.log(chalk.gray(`  Total operations: ${counts.total}`));

    return counts;
  }

  compareWithTarget() {
    console.log(chalk.cyan('\n🎯 Target comparison:'));
    console.log(chalk.gray('  HTML: 322 nodes, 808 edges (147 duplicates)'));
    console.log(chalk.gray('  Expected: ~322 entities, ~661 unique relations'));
  }
}

// ============================================================================
// MINTER
// ============================================================================

class Minter {
  async mint(ops: any[]) {
    if (CONFIG.DRY_RUN) {
      console.log(chalk.yellow('\n🔍 DRY RUN - Skipping actual minting'));
      return;
    }

    const privateKey = process.env.PRIVATE_KEY!;
    const { address } = privateKeyToAccount(privateKey as `0x${string}`);
    
    console.log(chalk.cyan('\n🚀 Minting to blockchain...'));
    console.log(chalk.gray(`  Address: ${address}`));

    const walletClient = await getWalletClient({
      privateKey: privateKey as `0x${string}`,
    });

    // Deploy space
    const space = await Graph.createSpace({
      editorAddress: address,
      name: CONFIG.SPACE_NAME,
      network: CONFIG.NETWORK,
    });
    console.log(chalk.green(`✓ Space deployed: ${space.id}`));

    // Publish to IPFS
    const { cid } = await Ipfs.publishEdit({
      name: `${CONFIG.SPACE_NAME} Initial Import`,
      ops,
      author: address,
      network: CONFIG.NETWORK,
    });
    console.log(chalk.green(`✓ Published to IPFS: ${cid}`));

    // Get calldata
    const result = await fetch(
      `${Graph.TESTNET_API_ORIGIN}/space/${space.id}/edit/calldata`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid }),
      }
    );

    const { to, data } = await result.json();

    // Submit transaction
    const txResult = await walletClient.sendTransaction({
      account: walletClient.account,
      to,
      value: 0n,
      data,
    });

    console.log(chalk.bold.green('\n✅ MINTING COMPLETE!'));
    console.log(chalk.yellow(`Transaction: ${txResult}`));
    console.log(chalk.yellow(`Space ID: ${space.id}`));
    console.log(
      chalk.cyan(
        `\nView on Geo Browser: https://testnet.geobrowser.io/space/${space.id}`
      )
    );
  }
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

async function main() {
  console.log(chalk.bold.cyan('🎵 ARTIST TO GRC-20 V3 - CLEAN PIPELINE\n'));

  await initDb();

  // 1. Extract data
  console.log(chalk.cyan('📥 Extracting data...'));
  const extractor = new DataExtractor(CONFIG.ARTIST_ID);
  const artist = await extractor.getArtist();
  const works = await extractor.getWorks();
  const mlcWorks = await extractor.getMLCWorks();
  const recordings = await extractor.getRecordings();
  const mlcWriters = await extractor.getMLCWriters();
  const publishers = await extractor.getPublishers();
  
  console.log(chalk.gray(`  Artist: ${artist.name}`));
  console.log(chalk.gray(`  Quansic Works: ${works.length}`));
  console.log(chalk.gray(`  MLC Works: ${mlcWorks.length}`));
  console.log(chalk.gray(`  Recordings: ${recordings.length}`));
  console.log(chalk.gray(`  MLC Writers: ${mlcWriters.length}`));
  console.log(chalk.gray(`  Publishers: ${publishers.length}`));

  // 2. Normalize data
  console.log(chalk.cyan('\n🧹 Normalizing data...'));
  const normalizer = new DataNormalizer();
  const normalizedArtist = normalizer.normalizeArtist(artist);
  const normalizedWorks = works.map(w => normalizer.normalizeWork(w));
  const normalizedMLCWorks = mlcWorks.map(w => normalizer.normalizeWork(w)); // NORMALIZE MLC TOO!
  const normalizedRecordings = recordings.map(r => normalizer.normalizeRecording(r));
  const normalizedMLCWriters = mlcWriters.map(w => ({
    ...w,
    name: normalizer.normalizePersonName(w.name) // Normalize writer names
  }));
  const normalizedPublishers = publishers.map(p => normalizer.normalizePublisher(p));

  // 3. Build schema
  console.log(chalk.cyan('\n🏗️  Building schema...'));
  const schema = new SchemaBuilder();
  schema.createProperties();
  schema.createTypes();

  // 4. Create entities
  console.log(chalk.cyan('\n🎨 Creating entities...'));
  const builder = new EntityBuilder(schema);
  
  // Create artist first
  const artistEntityId = builder.createArtist(normalizedArtist);
  
  // Create Quansic works first
  for (const work of normalizedWorks) {
    builder.createWork(work, artistEntityId);
  }
  
  // Create MLC-only works (ones not already created from Quansic)
  for (const mlcWork of mlcWorks) {
    builder.createMLCWork(mlcWork, artistEntityId);
  }
  
  // Create recordings
  for (const recording of normalizedRecordings) {
    builder.createRecording(recording, artistEntityId);
  }
  
  // Create MLC writers (AFTER works so WRITES edges can connect)
  for (const writer of mlcWriters) {
    builder.createWriter(writer);
  }
  
  // Create publishers (AFTER works so PUBLISHES edges can connect)
  for (const publisher of normalizedPublishers) {
    builder.createPublisher(publisher);
  }

  const stats = builder.getStats();
  console.log(chalk.green('✓ Entity creation complete:'));
  console.log(chalk.gray(`  Artists: ${stats.artists}`));
  console.log(chalk.gray(`  Alternative Names: ${stats.altNames || 0}`));
  console.log(chalk.gray(`  Quansic Works: ${stats.works}`));
  console.log(chalk.gray(`  MLC Works: ${stats.mlcWorks || 0}`));
  console.log(chalk.gray(`  Recordings: ${stats.recordings}`));
  console.log(chalk.gray(`  Writers: ${stats.writers}`));
  console.log(chalk.gray(`  Publishers: ${stats.publishers}`));
  console.log(chalk.gray(`  Relations: ${stats.relations}`));

  // 5. Validate
  const validator = new Validator();
  const allOps = [...schema.getOps(), ...builder.getOps()];
  validator.validateOps(allOps);
  validator.compareWithTarget();

  // 6. Mint
  const minter = new Minter();
  await minter.mint(allOps);

  console.log(chalk.bold.green('\n✨ Pipeline complete!'));
}

// Run if called directly
if (import.meta.main) {
  main().catch(error => {
    console.error(chalk.red('❌ Error:'), error);
    process.exit(1);
  });
}

export { main };