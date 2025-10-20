#!/usr/bin/env bun

/**
 * PostgreSQL to GRC-20 Direct Minting
 * 
 * Pulls enriched data directly from PostgreSQL and mints to Base Sepolia
 * No intermediate Cytoscape step needed
 */

import { Graph, Ipfs, getWalletClient, Id } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import chalk from 'chalk';
import { db, initDb } from '../db/postgres';
import { sql } from 'drizzle-orm';

// Property IDs (we'll create these once and reuse)
let PROPERTIES = {
  // Identifiers
  ISNI: null as string | null,
  ISRC: null as string | null,
  ISWC: null as string | null,
  IPI: null as string | null,
  
  // Metadata
  DURATION_MS: null as string | null,
  RELEASE_YEAR: null as string | null,
  SHARE_PERCENTAGE: null as string | null,
  
  // External IDs
  SPOTIFY_ID: null as string | null,
  GENIUS_ID: null as string | null,
  
  // Relations
  COMPOSED_BY: null as string | null,
  RECORDING_OF: null as string | null,
  PUBLISHED_BY: null as string | null,
  PERFORMED_BY: null as string | null,
};

// Entity Type IDs
let TYPES = {
  ARTIST: null as string | null,
  WORK: null as string | null,
  RECORDING: null as string | null,
  PUBLISHER: null as string | null,
};

async function setupPropertiesAndTypes() {
  console.log(chalk.cyan('Setting up GRC-20 properties and types...'));
  const ops: any[] = [];
  
  // Create properties
  const properties = [
    { key: 'ISNI', name: 'ISNI', dataType: 'TEXT' as const },
    { key: 'ISRC', name: 'ISRC', dataType: 'TEXT' as const },
    { key: 'ISWC', name: 'ISWC', dataType: 'TEXT' as const },
    { key: 'IPI', name: 'IPI Number', dataType: 'TEXT' as const },
    { key: 'DURATION_MS', name: 'Duration (ms)', dataType: 'NUMBER' as const },
    { key: 'RELEASE_YEAR', name: 'Release Year', dataType: 'NUMBER' as const },
    { key: 'SHARE_PERCENTAGE', name: 'Share %', dataType: 'NUMBER' as const },
    { key: 'SPOTIFY_ID', name: 'Spotify ID', dataType: 'TEXT' as const },
    { key: 'GENIUS_ID', name: 'Genius ID', dataType: 'TEXT' as const },
    { key: 'COMPOSED_BY', name: 'Composed By', dataType: 'RELATION' as const },
    { key: 'RECORDING_OF', name: 'Recording Of', dataType: 'RELATION' as const },
    { key: 'PUBLISHED_BY', name: 'Published By', dataType: 'RELATION' as const },
    { key: 'PERFORMED_BY', name: 'Performed By', dataType: 'RELATION' as const },
  ];
  
  for (const prop of properties) {
    const { id, ops: propOps } = Graph.createProperty({
      name: prop.name,
      dataType: prop.dataType,
    });
    PROPERTIES[prop.key as keyof typeof PROPERTIES] = id;
    ops.push(...propOps);
    console.log(chalk.gray(`  Created property: ${prop.name}`));
  }
  
  // Create entity types
  const { id: artistTypeId, ops: artistTypeOps } = Graph.createType({
    name: 'Music Artist',
    properties: [PROPERTIES.ISNI!, PROPERTIES.IPI!, PROPERTIES.SPOTIFY_ID!, PROPERTIES.GENIUS_ID!],
  });
  TYPES.ARTIST = artistTypeId;
  ops.push(...artistTypeOps);
  
  const { id: workTypeId, ops: workTypeOps } = Graph.createType({
    name: 'Musical Work',
    properties: [PROPERTIES.ISWC!, PROPERTIES.COMPOSED_BY!, PROPERTIES.SHARE_PERCENTAGE!],
  });
  TYPES.WORK = workTypeId;
  ops.push(...workTypeOps);
  
  const { id: recordingTypeId, ops: recordingTypeOps } = Graph.createType({
    name: 'Recording',
    properties: [PROPERTIES.ISRC!, PROPERTIES.RECORDING_OF!, PROPERTIES.DURATION_MS!, PROPERTIES.RELEASE_YEAR!],
  });
  TYPES.RECORDING = recordingTypeId;
  ops.push(...recordingTypeOps);
  
  const { id: publisherTypeId, ops: publisherTypeOps } = Graph.createType({
    name: 'Music Publisher',
    properties: [PROPERTIES.IPI!, PROPERTIES.PUBLISHED_BY!],
  });
  TYPES.PUBLISHER = publisherTypeId;
  ops.push(...publisherTypeOps);
  
  console.log(chalk.green('✓ Properties and types created'));
  return ops;
}

async function mintGrimesData() {
  console.log(chalk.bold.cyan('\n🎵 MINTING GRIMES TO GRC-20 (BASE SEPOLIA)\n'));
  
  await initDb();
  
  // Get wallet
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Missing PRIVATE_KEY environment variable');
  }
  
  const { address } = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(chalk.yellow(`Minting from address: ${address}`));
  
  const walletClient = await getWalletClient({
    privateKey: privateKey as `0x${string}`,
  });
  
  // Deploy space
  console.log(chalk.cyan('\nDeploying space...'));
  const space = await Graph.createSpace({
    editorAddress: address,
    name: 'grimes-music-graph',
    network: 'TESTNET',
  });
  console.log(chalk.green(`✓ Space deployed: ${space.id}`));
  
  // Setup properties and types
  const setupOps = await setupPropertiesAndTypes();
  
  // Collect all ops
  const allOps = [...setupOps];
  let entityCount = 0;
  let relationCount = 0;
  
  // Create Grimes artist entity
  console.log(chalk.cyan('\nCreating artist entity...'));
  const grimesResult = await db.execute(sql`
    SELECT * FROM quansic_artists WHERE id = '0000000356358936'
  `);
  
  if (grimesResult.rows.length === 0) {
    throw new Error('Grimes not found in database');
  }
  
  const grimes = grimesResult.rows[0] as any;
  const { id: grimesEntityId, ops: grimesOps } = Graph.createEntity({
    name: grimes.name,
    description: `ISNI: ${grimes.id}`,
    types: [TYPES.ARTIST!],
    values: [
      {
        property: PROPERTIES.ISNI!,
        value: grimes.id,
      },
    ],
  });
  allOps.push(...grimesOps);
  entityCount++;
  console.log(chalk.green(`✓ Created Grimes entity: ${grimesEntityId}`));
  
  // Create work entities
  console.log(chalk.cyan('\nCreating work entities...'));
  const works = await db.execute(sql`
    SELECT DISTINCT
      w.id,
      w.title,
      w.iswc,
      wc.share_percentage
    FROM quansic_works w
    LEFT JOIN quansic_work_contributors wc ON w.id = wc.work_id
    WHERE wc.contributor_id = '0000000356358936'
    LIMIT 50
  `);
  
  const workEntityMap = new Map<string, string>();
  
  for (const work of works.rows) {
    const w = work as any;
    const values: any[] = [];
    
    if (w.iswc) {
      values.push({
        property: PROPERTIES.ISWC!,
        value: w.iswc,
      });
    }
    
    if (w.share_percentage) {
      values.push({
        property: PROPERTIES.SHARE_PERCENTAGE!,
        value: Graph.serializeNumber(w.share_percentage),
      });
    }
    
    const { id: workEntityId, ops: workOps } = Graph.createEntity({
      name: w.title,
      types: [TYPES.WORK!],
      values,
      relations: {
        [PROPERTIES.COMPOSED_BY!]: {
          toEntity: grimesEntityId,
        },
      },
    });
    
    allOps.push(...workOps);
    workEntityMap.set(w.id, workEntityId);
    entityCount++;
    relationCount++;
  }
  console.log(chalk.green(`✓ Created ${works.rows.length} work entities`));
  
  // Create recording entities
  console.log(chalk.cyan('\nCreating recording entities...'));
  const recordings = await db.execute(sql`
    SELECT 
      r.id as isrc,
      r.title,
      r.year,
      r.duration_ms,
      r.spotify_id,
      rw.work_id
    FROM quansic_recordings r
    LEFT JOIN quansic_recording_works rw ON r.id = rw.recording_id
    WHERE r.spotify_id IS NOT NULL
    LIMIT 50
  `);
  
  for (const recording of recordings.rows) {
    const r = recording as any;
    const values: any[] = [
      {
        property: PROPERTIES.ISRC!,
        value: r.isrc,
      },
    ];
    
    if (r.duration_ms) {
      values.push({
        property: PROPERTIES.DURATION_MS!,
        value: Graph.serializeNumber(r.duration_ms),
      });
    }
    
    if (r.year) {
      values.push({
        property: PROPERTIES.RELEASE_YEAR!,
        value: Graph.serializeNumber(parseInt(r.year)),
      });
    }
    
    if (r.spotify_id) {
      values.push({
        property: PROPERTIES.SPOTIFY_ID!,
        value: r.spotify_id,
      });
    }
    
    const relations: any = {};
    if (r.work_id && workEntityMap.has(r.work_id)) {
      relations[PROPERTIES.RECORDING_OF!] = {
        toEntity: workEntityMap.get(r.work_id),
      };
      relationCount++;
    }
    
    const { id: recordingEntityId, ops: recordingOps } = Graph.createEntity({
      name: r.title,
      types: [TYPES.RECORDING!],
      values,
      relations,
    });
    
    allOps.push(...recordingOps);
    entityCount++;
  }
  console.log(chalk.green(`✓ Created ${recordings.rows.length} recording entities`));
  
  // Publish to IPFS
  console.log(chalk.cyan('\nPublishing to IPFS...'));
  const { cid } = await Ipfs.publishEdit({
    name: 'Initial Grimes Music Graph Import',
    ops: allOps,
    author: address,
    network: 'TESTNET',
  });
  console.log(chalk.green(`✓ Published to IPFS: ${cid}`));
  
  // Get calldata
  console.log(chalk.cyan('\nGetting transaction calldata...'));
  const result = await fetch(`${Graph.TESTNET_API_ORIGIN}/space/${space.id}/edit/calldata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cid }),
  });
  
  const { to, data } = await result.json();
  
  // Submit transaction
  console.log(chalk.cyan('\nSubmitting transaction...'));
  const txResult = await walletClient.sendTransaction({
    account: walletClient.account,
    to,
    value: 0n,
    data,
  });
  
  console.log(chalk.bold.green(`\n✅ MINTING COMPLETE!`));
  console.log(chalk.yellow(`Transaction: ${txResult}`));
  console.log(chalk.yellow(`Space ID: ${space.id}`));
  console.log(chalk.yellow(`Entities: ${entityCount}`));
  console.log(chalk.yellow(`Relations: ${relationCount}`));
  console.log(chalk.cyan(`\nView on Geo Browser: https://testnet.geobrowser.io/space/${space.id}`));
}

// Run if called directly
if (import.meta.main) {
  mintGrimesData().catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });
}

export { mintGrimesData };