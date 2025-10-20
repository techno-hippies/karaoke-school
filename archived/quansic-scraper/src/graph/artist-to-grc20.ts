#!/usr/bin/env bun

/**
 * ARTIST TO GRC-20 PIPELINE
 * 
 * Reusable pipeline that extracts data using the EXACT same logic
 * as create-graph-viz.ts but outputs GRC-20 ops for ANY artist
 * 
 * Usage:
 *   bun run src/graph/artist-to-grc20.ts [ISNI]
 *   bun run src/graph/artist-to-grc20.ts 0000000356358936  # Grimes
 */

import chalk from 'chalk';
import { db, initDb } from '../db/postgres';
import { sql } from 'drizzle-orm';
import { Graph, Ipfs, getWalletClient, Id } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import { normalizeTitle, normalizeCompanyName, normalizePersonName, normalizeByType } from './normalize-text';

class ArtistToGRC20Pipeline {
  private artistISNI: string;
  private entityMap = new Map<string, string>(); // Local ID -> GRC-20 entity ID
  private propertyIds = new Map<string, string>();
  private typeIds = new Map<string, string>();
  private nodeCount = 0;
  private edgeCount = 0;
  
  constructor(artistISNI?: string) {
    this.artistISNI = artistISNI || '0000000356358936'; // Default to Grimes
  }
  
  async process(options: { dryRun?: boolean } = {}) {
    console.log(chalk.bold.cyan(`\n🎵 PROCESSING ARTIST ${this.artistISNI} FOR GRC-20\n`));
    
    await initDb();
    
    // Step 1: Extract data using EXACT same logic as create-graph-viz.ts
    const { nodes, edges } = await this.extractGraphData();
    
    console.log(chalk.green(`\n✓ Extracted ${nodes.length} nodes and ${edges.length} edges`));
    this.nodeCount = nodes.length;
    this.edgeCount = edges.length;
    
    // Step 2: Convert to GRC-20 ops
    const ops = await this.convertToGRC20Ops(nodes, edges);
    
    console.log(chalk.green(`✓ Created ${ops.length} GRC-20 operations`));
    
    // Default to dry run unless explicitly set to false
    if (options.dryRun !== false) {
      await this.saveDryRun(nodes, edges, ops);
      return;
    }
    
    // Step 3: Mint to blockchain
    await this.mintToBlockchain(ops);
  }
  
  /**
   * EXACT extraction logic from create-graph-viz.ts
   * This ensures we get the same 322 nodes and 808 edges
   */
  private async extractGraphData() {
    const nodes: any[] = [];
    const edges: any[] = [];
    const addedNodes = new Set();
    
    // Get artist info (from create-graph-viz.ts line 44-100)
    const artist = await db.execute(sql`
      SELECT * FROM quansic_artists WHERE id = ${this.artistISNI}
    `);
    
    if (artist.rows.length === 0) {
      throw new Error(`Artist with ISNI ${this.artistISNI} not found`);
    }
    
    const artistData = artist.rows[0] as any;
    const artistNodeId = `artist_${artistData.id}`;
    
    // Parse all identifiers from JSON
    let identifiers: any = {};
    if (artistData.all_identifiers) {
      identifiers = typeof artistData.all_identifiers === 'string' 
        ? JSON.parse(artistData.all_identifiers) 
        : artistData.all_identifiers;
    }
    
    // Add central artist node with ALL data
    addedNodes.add(artistNodeId);
    nodes.push({
      id: artistNodeId,
      label: normalizePersonName(artistData.name),
      type: 'Person',
      properties: {
        isni: artistData.id,
        ipis: identifiers.ipis || [],
        spotify_id: identifiers.spotifyIds?.[0] || artistData.spotify_id,
        apple_id: identifiers.appleIds?.[0],
        deezer_id: identifiers.deezerIds?.[0],
        musicbrainz_id: identifiers.musicBrainzIds?.[0],
        discogs_ids: identifiers.discogsIds || [],
        wikidata_id: identifiers.wikidataIds?.[0]
      }
    });
    
    // Add alternative names (from line 103-132)
    const altNames = await db.execute(sql`
      SELECT name, language FROM quansic_artist_aliases 
      WHERE artist_id = ${this.artistISNI}
    `);
    
    for (let i = 0; i < altNames.rows.length; i++) {
      const altName = altNames.rows[i];
      // Use index for ID to avoid collisions with non-ASCII names
      const nodeId = `altname_${this.artistISNI}_${i}`;
      addedNodes.add(nodeId);
      nodes.push({
        id: nodeId,
        label: normalizePersonName(altName.name),
        type: 'alternative_name',
        properties: {
          language: altName.language || 'unknown'
        }
      });
      
      edges.push({
        source: nodeId,
        target: artistNodeId,
        label: 'ALIAS_OF'
      });
    }
    
    // Add recordings (from line 134-236)
    const recordings = await db.execute(sql`
      SELECT 
        r.*,
        s.spotify_id,
        s.popularity,
        s.track_name,
        COUNT(DISTINCT rw.work_iswc) as work_count
      FROM quansic_recordings r
      LEFT JOIN spotify_tracks s ON r.id = s.isrc
      LEFT JOIN quansic_recording_works rw ON r.id = rw.recording_isrc
      WHERE r.artist_id = ${this.artistISNI}
      GROUP BY r.id, r.artist_id, r.isrc, r.title, r.duration_ms, r.year,
               r.spotify_id, r.apple_id, r.deezer_id, r.created_at,
               s.spotify_id, s.popularity, s.track_name
      ORDER BY s.popularity DESC NULLS LAST
      LIMIT 75
    `);
    
    const recordingIds = recordings.rows.map(r => r.id);
    
    for (const rec of recordings.rows) {
      const nodeId = `rec_${rec.id}`;
      addedNodes.add(nodeId);
      
      const properties: any = {
        isrc: rec.id,
        duration_ms: rec.duration_ms
      };
      
      // Create proper date from year
      if (rec.year) {
        properties.release_date = Graph.serializeDate(new Date(`${rec.year}-01-01`));
      }
      
      if (rec.spotify_id) properties.spotify_id = rec.spotify_id;
      if (rec.apple_id) properties.apple_id = rec.apple_id;
      if (rec.deezer_id) properties.deezer_id = rec.deezer_id;
      
      nodes.push({
        id: nodeId,
        label: normalizeTitle((rec.track_name || rec.title || rec.id)).substring(0, 40),
        type: 'recording',
        properties
      });
      
      edges.push({
        source: nodeId,
        target: artistNodeId,
        label: 'PERFORMED_BY'
      });
    }
    
    // Add works (from line 238-303)
    if (recordingIds.length > 0) {
      const recordingIdString = recordingIds.map(id => `'${id}'`).join(',');
      const works = await db.execute(sql.raw(`
        SELECT 
          w.*,
          COUNT(DISTINCT rw.recording_isrc) as recording_count,
          COUNT(DISTINCT wc.id) as contributor_count
        FROM quansic_works w
        LEFT JOIN quansic_recording_works rw ON w.id = rw.work_iswc
        LEFT JOIN quansic_work_contributors wc ON w.id = wc.work_iswc
        WHERE rw.recording_isrc IN (${recordingIdString})
        GROUP BY w.id, w.title, w.iswc, w.artist_id, w.created_at
        ORDER BY recording_count DESC
      `));
      
      for (const work of works.rows) {
        const nodeId = `work_${work.id}`;
        addedNodes.add(nodeId);
        
        nodes.push({
          id: nodeId,
          label: normalizeTitle(work.title)?.substring(0, 40) || work.id,
          type: 'work',
          properties: {
            iswc: work.iswc || work.id,
            recording_count: work.recording_count,
            contributor_count: work.contributor_count
          }
        });
        
        // Connect recordings to works
        const workRecordings = await db.execute(sql`
          SELECT recording_isrc FROM quansic_recording_works 
          WHERE work_iswc = ${work.id}
            AND recording_isrc = ANY(ARRAY[${sql.raw(recordingIds.map(id => `'${id}'`).join(','))}])
        `);
        
        for (const wr of workRecordings.rows) {
          edges.push({
            source: `rec_${wr.recording_isrc}`,
            target: nodeId,
            label: 'EMBODIES'
          });
        }
        
        // Connect work to artist
        edges.push({
          source: nodeId,
          target: artistNodeId,
          label: 'COMPOSED_BY'
        });
      }
    }
    
    // Add MLC writers (from line 305-431)
    const mlcWriters = await db.execute(sql`
      SELECT DISTINCT
        first_name || ' ' || last_name as writer_name,
        ipi,
        string_agg(DISTINCT role, ', ') as roles,
        COUNT(DISTINCT work_id) as work_count,
        ARRAY_AGG(DISTINCT work_id) as work_ids
      FROM mlc_writers
      WHERE ipi IS NOT NULL
      GROUP BY first_name, last_name, ipi
      ORDER BY work_count DESC
      LIMIT 30
    `);
    
    for (const writer of mlcWriters.rows) {
      if (writer.writer_name && writer.writer_name.trim()) {
        const writerData = writer as any;
        const nodeId = `mlc_writer_${writerData.ipi || writerData.writer_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        addedNodes.add(nodeId);
        
        nodes.push({
          id: nodeId,
          label: normalizePersonName(writerData.writer_name),
          type: 'mlc_writer',
          properties: {
            ipi: writerData.ipi,
            roles: writerData.roles,
            work_count: writerData.work_count
          }
        });
        
        // Connect writer to their works
        if (writerData.work_ids && Array.isArray(writerData.work_ids)) {
          for (const workId of writerData.work_ids) {
            // Check for existing work node or create mlc_work node
            const workData = await db.execute(sql`
              SELECT iswc, title FROM mlc_works WHERE id = ${workId} LIMIT 1
            `);
            
            if (workData.rows.length > 0) {
              const work = workData.rows[0] as any;
              let targetNodeId = work.iswc ? `work_${work.iswc}` : null;
              
              // If no existing work node, create MLC work node
              if (!targetNodeId || !addedNodes.has(targetNodeId)) {
                const mlcWorkNodeId = `mlc_work_${workId}`;
                if (!addedNodes.has(mlcWorkNodeId)) {
                  nodes.push({
                    id: mlcWorkNodeId,
                    label: normalizeTitle(work.title).substring(0, 40),
                    type: 'work',
                    properties: {
                      mlc_id: workId,
                      iswc: work.iswc || 'No ISWC',
                      data_source: 'MLC'
                    }
                  });
                  addedNodes.add(mlcWorkNodeId);
                  
                  edges.push({
                    source: mlcWorkNodeId,
                    target: artistNodeId,
                    label: 'COMPOSED_BY'
                  });
                }
                targetNodeId = mlcWorkNodeId;
              }
              
              if (targetNodeId) {
                edges.push({
                  source: nodeId,
                  target: targetNodeId,
                  label: 'WRITES'
                });
              }
            }
          }
        }
      }
    }
    
    // Add MLC publishers (from line 433-570)
    const mlcPublishers = await db.execute(sql`
      SELECT DISTINCT
        publisher_name,
        publisher_ipi,
        administrator_ipi,
        COUNT(DISTINCT work_id) as work_count,
        ARRAY_AGG(DISTINCT work_id) as work_ids
      FROM mlc_publishers
      WHERE publisher_ipi IS NOT NULL 
         OR administrator_ipi IS NOT NULL
      GROUP BY publisher_name, publisher_ipi, administrator_ipi
      ORDER BY work_count DESC
      LIMIT 25
    `);
    
    for (const publisher of mlcPublishers.rows) {
      const pubData = publisher as any;
      const nodeId = `publisher_${pubData.publisher_name?.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      if (!addedNodes.has(nodeId)) {
        nodes.push({
          id: nodeId,
          label: normalizeCompanyName(pubData.publisher_name),
          type: 'publisher',
          properties: {
            work_count: pubData.work_count,
            publisher_ipi: pubData.publisher_ipi || 'N/A',
            administrator_ipi: pubData.administrator_ipi
          }
        });
        addedNodes.add(nodeId);
      }
      
      // Connect publisher to works
      if (pubData.work_ids && Array.isArray(pubData.work_ids)) {
        for (const workId of pubData.work_ids) {
          const workData = await db.execute(sql`
            SELECT iswc, title FROM mlc_works WHERE id = ${workId} LIMIT 1
          `);
          
          if (workData.rows.length > 0) {
            const work = workData.rows[0] as any;
            let targetNodeId = null;
            
            // Strategy 1: Try ISWC-based node (for existing quansic works)
            if (work.iswc) {
              const iswcNodeId = `work_${work.iswc}`;
              if (addedNodes.has(iswcNodeId)) {
                targetNodeId = iswcNodeId;
              }
            }
            
            // Strategy 2: Check for existing MLC work node
            if (!targetNodeId) {
              const mlcWorkNodeId = `mlc_work_${workId}`;
              if (addedNodes.has(mlcWorkNodeId)) {
                targetNodeId = mlcWorkNodeId;
              } else {
                // Create new MLC work node
                nodes.push({
                  id: mlcWorkNodeId,
                  label: normalizeTitle(work.title).substring(0, 40),
                  type: 'work',
                  properties: {
                    mlc_id: workId,
                    iswc: work.iswc || 'No ISWC',
                    data_source: 'MLC'
                  }
                });
                addedNodes.add(mlcWorkNodeId);
                targetNodeId = mlcWorkNodeId;
                
                edges.push({
                  source: mlcWorkNodeId,
                  target: artistNodeId,
                  label: 'COMPOSED_BY'
                });
              }
            }
            
            if (targetNodeId) {
              edges.push({
                source: nodeId,
                target: targetNodeId,
                label: 'PUBLISHES'
              });
            }
          }
        }
      }
    }
    
    // Add contributors (from line 572-620)
    if (recordingIds.length > 0) {
      const recordingIdString = recordingIds.map(id => `'${id}'`).join(',');
      const contributors = await db.execute(sql.raw(`
        SELECT 
          contributor_name,
          contributor_role,
          COUNT(DISTINCT work_iswc) as work_count,
          ARRAY_AGG(DISTINCT work_iswc) as work_ids
        FROM quansic_work_contributors
        WHERE work_iswc IN (
          SELECT DISTINCT work_iswc FROM quansic_recording_works 
          WHERE recording_isrc IN (${recordingIdString})
        )
        AND contributor_name != '${artistData.name}'
        GROUP BY contributor_name, contributor_role
        ORDER BY work_count DESC
        LIMIT 15
      `));
      
      for (const contrib of contributors.rows) {
        const nodeId = `contrib_${contrib.contributor_name?.replace(/[^a-zA-Z0-9]/g, '_')}_${contrib.contributor_role?.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        if (!addedNodes.has(nodeId)) {
          nodes.push({
            id: nodeId,
            label: normalizePersonName(contrib.contributor_name),
            type: 'contributor',
            properties: {
              role: contrib.contributor_role,
              workCount: contrib.work_count
            }
          });
          addedNodes.add(nodeId);
        }
        
        // Add edges to works
        if (contrib.work_ids) {
          for (const workId of contrib.work_ids.slice(0, 5)) {
            edges.push({
              source: nodeId,
              target: `work_${workId}`,
              label: contrib.contributor_role
            });
          }
        }
      }
    }
    
    return { nodes, edges };
  }
  
  /**
   * Convert extracted graph data to GRC-20 operations
   */
  private async convertToGRC20Ops(nodes: any[], edges: any[]) {
    const ops: any[] = [];
    
    // Create properties and types (same as before)
    this.createPropertiesAndTypes(ops);
    
    // Create entities from nodes
    for (const node of nodes) {
      const values = this.nodeToValues(node);
      const typeId = this.typeIds.get(node.type);
      
      // Add description based on node type
      let description = '';
      if (node.type === 'Person') {
        description = `Music artist with ISNI ${node.properties?.isni}`;
      } else if (node.type === 'recording') {
        description = `Recording with ISRC ${node.properties?.isrc}`;
      } else if (node.type === 'work') {
        description = `Musical composition${node.properties?.iswc ? ` with ISWC ${node.properties.iswc}` : ''}`;
      } else if (node.type === 'publisher') {
        description = `Music publisher`;
      } else if (node.type === 'mlc_writer') {
        description = `Songwriter/composer`;
      }
      
      const { id: entityId, ops: entityOps } = Graph.createEntity({
        name: node.label,
        description,
        types: typeId ? [typeId] : [],
        values
      });
      
      this.entityMap.set(node.id, entityId);
      ops.push(...entityOps);
    }
    
    // Create relationships from edges
    for (const edge of edges) {
      const sourceId = this.entityMap.get(edge.source);
      const targetId = this.entityMap.get(edge.target);
      
      if (sourceId && targetId) {
        const propId = this.getRelationProperty(edge.label);
        if (propId) {
          ops.push({
            type: 'triple',
            action: 'set',
            entity: sourceId,
            property: propId,
            value: targetId
          });
        }
      }
    }
    
    return ops;
  }
  
  private createPropertiesAndTypes(ops: any[]) {
    // Properties
    const properties = [
      { key: 'isni', name: 'ISNI', type: 'STRING' },
      { key: 'isrc', name: 'ISRC', type: 'STRING' },
      { key: 'iswc', name: 'ISWC', type: 'STRING' },
      { key: 'ipi', name: 'IPI', type: 'STRING' },
      { key: 'spotify_id', name: 'Spotify ID', type: 'STRING' },
      { key: 'duration_ms', name: 'Duration (ms)', type: 'NUMBER' },
      { key: 'release_date', name: 'Release Date', type: 'TIME' },
      { key: 'work_count', name: 'Work Count', type: 'NUMBER' },
      // Relations
      { key: 'performed_by', name: 'Performed By', type: 'RELATION' },
      { key: 'composed_by', name: 'Composed By', type: 'RELATION' },
      { key: 'publishes', name: 'Publishes', type: 'RELATION' },
      { key: 'writes', name: 'Writes', type: 'RELATION' },
      { key: 'embodies', name: 'Embodies', type: 'RELATION' },
      { key: 'alias_of', name: 'Alias Of', type: 'RELATION' },
    ];
    
    for (const prop of properties) {
      const { id, ops: propOps } = Graph.createProperty({
        name: prop.name,
        dataType: prop.type as any,
      });
      this.propertyIds.set(prop.key, id);
      ops.push(...propOps);
    }
    
    // Types
    const types = [
      { key: 'Person', name: 'Music Artist', props: ['isni', 'ipi', 'spotify_id'] },
      { key: 'recording', name: 'Recording', props: ['isrc', 'duration_ms', 'release_date'] },
      { key: 'work', name: 'Musical Work', props: ['iswc'] },
      { key: 'publisher', name: 'Publisher', props: ['ipi', 'work_count'] },
      { key: 'mlc_writer', name: 'Writer', props: ['ipi', 'work_count'] },
      { key: 'contributor', name: 'Contributor', props: [] },
      { key: 'alternative_name', name: 'Alternative Name', props: [] },
    ];
    
    for (const type of types) {
      const propIds = type.props.map(p => this.propertyIds.get(p)!).filter(Boolean);
      const { id, ops: typeOps } = Graph.createType({
        name: type.name,
        properties: propIds,
      });
      this.typeIds.set(type.key, id);
      ops.push(...typeOps);
    }
  }
  
  private nodeToValues(node: any) {
    const values: any[] = [];
    
    if (node.properties) {
      for (const [key, value] of Object.entries(node.properties)) {
        const propId = this.propertyIds.get(key);
        if (propId && value !== null && value !== undefined && value !== 'N/A') {
          // Handle different data types
          if (key === 'release_date') {
            // Already serialized as date string
            values.push({
              property: propId,
              value: value as string,
            });
          } else if (typeof value === 'number') {
            values.push({
              property: propId,
              value: String(value), // Don't use serializeNumber to avoid commas
            });
          } else if (Array.isArray(value) && value.length > 0) {
            values.push({
              property: propId,
              value: String(value[0]),
            });
          } else {
            values.push({
              property: propId,
              value: String(value),
            });
          }
        }
      }
    }
    
    return values;
  }
  
  private getRelationProperty(label: string): string | null {
    const map: Record<string, string> = {
      'PERFORMED_BY': 'performed_by',
      'COMPOSED_BY': 'composed_by',
      'PUBLISHES': 'publishes',
      'WRITES': 'writes',
      'EMBODIES': 'embodies',
      'ALIAS_OF': 'alias_of',
      'Composer': 'composed_by',
      'ComposerLyricist': 'composed_by',
      'Lyricist': 'writes',
    };
    
    return this.propertyIds.get(map[label] || '');
  }
  
  private async saveDryRun(nodes: any[], edges: any[], ops: any[]) {
    console.log(chalk.bold.cyan('\n📊 DRY RUN SUMMARY\n'));
    
    // Node breakdown
    const nodeTypes = new Map<string, number>();
    for (const node of nodes) {
      nodeTypes.set(node.type, (nodeTypes.get(node.type) || 0) + 1);
    }
    
    console.log(chalk.bold('Nodes by type:'));
    for (const [type, count] of nodeTypes.entries()) {
      console.log(`  ${type}: ${count}`);
    }
    console.log(chalk.green(`  Total: ${nodes.length}`));
    
    // Edge breakdown
    const edgeTypes = new Map<string, number>();
    for (const edge of edges) {
      edgeTypes.set(edge.label, (edgeTypes.get(edge.label) || 0) + 1);
    }
    
    console.log(chalk.bold('\nEdges by type:'));
    for (const [type, count] of edgeTypes.entries()) {
      console.log(`  ${type}: ${count}`);
    }
    console.log(chalk.green(`  Total: ${edges.length}`));
    
    console.log(chalk.bold('\nGRC-20 Conversion:'));
    console.log(`  Operations: ${ops.length}`);
    console.log(`  Entities: ${this.entityMap.size}`);
    console.log(`  Properties: ${this.propertyIds.size}`);
    console.log(`  Types: ${this.typeIds.size}`);
    
    // Save to files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = `output/grc20-${this.artistISNI}-${timestamp}`;
    
    fs.writeFileSync(`${prefix}-nodes.json`, JSON.stringify(nodes, null, 2));
    fs.writeFileSync(`${prefix}-edges.json`, JSON.stringify(edges, null, 2));
    fs.writeFileSync(`${prefix}-ops.json`, JSON.stringify(ops, null, 2));
    
    console.log(chalk.green(`\n✓ Data saved to ${prefix}-*.json`));
    console.log(chalk.yellow('\nTo mint, run with PRIVATE_KEY environment variable'));
  }
  
  private async mintToBlockchain(ops: any[]) {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('Missing PRIVATE_KEY environment variable');
    }
    
    const { address } = privateKeyToAccount(privateKey as `0x${string}`);
    console.log(chalk.yellow(`\nMinting from address: ${address}`));
    
    const walletClient = await getWalletClient({
      privateKey: privateKey as `0x${string}`,
    });
    
    // Deploy space
    console.log(chalk.cyan('Deploying space...'));
    const artistName = await this.getArtistName();
    const space = await Graph.createSpace({
      editorAddress: address,
      name: 'songverse-v1',
      description: 'Music catalog data from Quansic, MLC, and streaming platforms for transparent royalty distribution',
      network: 'TESTNET',
    });
    
    // Publish to IPFS
    console.log(chalk.cyan('Publishing to IPFS...'));
    const { cid } = await Ipfs.publishEdit({
      name: `Songverse v1: ${artistName} Music Catalog`,
      ops,
      author: address,
      network: 'TESTNET',
    });
    
    // Get calldata and submit transaction
    console.log(chalk.cyan('Submitting transaction...'));
    const result = await fetch(`${Graph.TESTNET_API_ORIGIN}/space/${space.id}/edit/calldata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cid }),
    });
    
    const { to, data } = await result.json();
    
    const txResult = await walletClient.sendTransaction({
      account: walletClient.account,
      to,
      value: 0n,
      data,
    });
    
    console.log(chalk.bold.green(`\n✅ MINTING COMPLETE!`));
    console.log(chalk.yellow(`Transaction: ${txResult}`));
    console.log(chalk.yellow(`Space ID: ${space.id}`));
    console.log(chalk.yellow(`Nodes: ${this.nodeCount}`));
    console.log(chalk.yellow(`Edges: ${this.edgeCount}`));
    console.log(chalk.cyan(`\nView on Geo Browser: https://testnet.geobrowser.io/space/${space.id}`));
  }
  
  private async getArtistName(): Promise<string> {
    const result = await db.execute(sql`
      SELECT name FROM quansic_artists WHERE id = ${this.artistISNI}
    `);
    return result.rows[0]?.name || 'Unknown Artist';
  }
}

// Main execution
if (import.meta.main) {
  const artistISNI = process.argv[2] || '0000000356358936';
  const forceRun = process.argv.includes('--no-dry-run');
  const dryRun = forceRun ? false : (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY === '');
  
  const pipeline = new ArtistToGRC20Pipeline(artistISNI);
  pipeline.process({ dryRun }).catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });
}

export { ArtistToGRC20Pipeline };