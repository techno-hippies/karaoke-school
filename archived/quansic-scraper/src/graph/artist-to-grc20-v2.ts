#!/usr/bin/env bun

/**
 * ARTIST TO GRC-20 PIPELINE V2
 * 
 * Complete redesign to create properly connected entities
 * using embedded relations instead of separate operations
 */

import chalk from 'chalk';
import { db, initDb } from '../db/postgres';
import { sql } from 'drizzle-orm';
import { Graph, Ipfs, getWalletClient, Id } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import { normalizeTitle, normalizeCompanyName, normalizePersonName } from './normalize-text';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties?: Record<string, any>;
  entityId?: string; // GRC-20 entity ID after creation
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

class ArtistToGRC20PipelineV2 {
  private artistISNI: string;
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private nodeMap = new Map<string, GraphNode>();
  private propertyIds: Record<string, string> = {};
  private typeIds: Record<string, string> = {};
  
  constructor(artistISNI?: string) {
    this.artistISNI = artistISNI || '0000000356358936'; // Default to Grimes
  }
  
  async process(options: { dryRun?: boolean } = {}) {
    console.log(chalk.bold.cyan(`\n🎵 PROCESSING ARTIST ${this.artistISNI} FOR GRC-20 V2\n`));
    
    await initDb();
    
    // Step 1: Extract data
    await this.extractGraphData();
    console.log(chalk.green(`✓ Extracted ${this.nodes.length} nodes and ${this.edges.length} edges`));
    
    // Step 2: Create GRC-20 ops with proper relations
    const ops = await this.createConnectedOps();
    console.log(chalk.green(`✓ Created ${ops.length} GRC-20 operations with embedded relations`));
    
    if (options.dryRun !== false) {
      await this.saveDryRun(ops);
      return;
    }
    
    // Step 3: Mint to blockchain
    await this.mintToBlockchain(ops);
  }
  
  private async extractGraphData() {
    // Same extraction as before - get nodes and edges
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const addedNodes = new Set();
    
    // Get artist
    const artist = await db.execute(sql`
      SELECT * FROM quansic_artists WHERE id = ${this.artistISNI}
    `);
    
    if (artist.rows.length === 0) {
      throw new Error(`Artist with ISNI ${this.artistISNI} not found`);
    }
    
    const artistData = artist.rows[0] as any;
    const artistNodeId = `artist_${artistData.id}`;
    
    // Parse identifiers
    let identifiers: any = {};
    if (artistData.all_identifiers) {
      identifiers = typeof artistData.all_identifiers === 'string' 
        ? JSON.parse(artistData.all_identifiers) 
        : artistData.all_identifiers;
    }
    
    // Add artist node
    const artistNode: GraphNode = {
      id: artistNodeId,
      label: normalizePersonName(artistData.name),
      type: 'artist',
      properties: {
        isni: artistData.id,
        ipis: identifiers.ipis?.join(', ') || artistData.ipi || '',
        spotify_id: identifiers.spotifyIds?.[0] || artistData.spotify_id,
        apple_id: identifiers.appleIds?.[0] || artistData.apple_id,
        birthdate: artistData.birth_date,
        description: `${artistData.name} is a musician and artist known for experimental electronic music`
      }
    };
    nodes.push(artistNode);
    addedNodes.add(artistNodeId);
    
    // Get recordings
    const recordings = await db.execute(sql`
      SELECT 
        r.*,
        s.spotify_id as spotify_id_from_join,
        s.popularity,
        s.track_name
      FROM quansic_recordings r
      LEFT JOIN spotify_tracks s ON r.id = s.isrc
      WHERE r.artist_id = ${this.artistISNI}
      ORDER BY s.popularity DESC NULLS LAST
      LIMIT 75
    `);
    
    const recordingIds = recordings.rows.map(r => r.id);
    
    for (const rec of recordings.rows) {
      const nodeId = `rec_${rec.id}`;
      const recNode: GraphNode = {
        id: nodeId,
        label: normalizeTitle((rec.track_name || rec.title || rec.id)).substring(0, 40),
        type: 'recording',
        properties: {
          isrc: rec.id,
          duration_ms: rec.duration_ms,
          year: String(rec.year || ''), // Convert to string to avoid comma formatting
          spotify_id: rec.spotify_id || rec.spotify_id_from_join,
          apple_id: rec.apple_id,
          deezer_id: rec.deezer_id,
          description: `Recording from ${rec.year || 'unknown year'}`
        }
      };
      nodes.push(recNode);
      addedNodes.add(nodeId);
      
      // Recording -> Artist edge
      edges.push({
        source: nodeId,
        target: artistNodeId,
        label: 'PERFORMED_BY'
      });
    }
    
    // Get works
    if (recordingIds.length > 0) {
      const recordingIdString = recordingIds.map(id => `'${id}'`).join(',');
      const works = await db.execute(sql.raw(`
        SELECT 
          w.*,
          COUNT(DISTINCT rw.recording_isrc) as recording_count
        FROM quansic_works w
        LEFT JOIN quansic_recording_works rw ON w.id = rw.work_iswc
        WHERE w.artist_id = '${this.artistISNI}'
        AND EXISTS (
          SELECT 1 FROM quansic_recording_works rw2 
          WHERE rw2.work_iswc = w.id 
          AND rw2.recording_isrc IN (${recordingIdString})
        )
        GROUP BY w.id, w.artist_id, w.title, w.role, w.q1_score, w.created_at
      `));
      
      for (const work of works.rows) {
        const nodeId = `work_${work.id}`;
        const workNode: GraphNode = {
          id: nodeId,
          label: normalizeTitle(work.title)?.substring(0, 40) || work.id,
          type: 'work',
          properties: {
            iswc: work.id,
            description: work.title ? `"${work.title}" musical composition` : 'Musical composition'
          }
        };
        nodes.push(workNode);
        addedNodes.add(nodeId);
        
        // Work -> Artist edge
        edges.push({
          source: nodeId,
          target: artistNodeId,
          label: 'COMPOSED_BY'
        });
      }
    }
    
    // Add recording-work relationships from quansic_recording_works
    if (recordingIds.length > 0) {
      const recordingIdString = recordingIds.map(id => `'${id}'`).join(',');
      const recordingWorks = await db.execute(sql.raw(`
        SELECT * FROM quansic_recording_works 
        WHERE recording_isrc IN (${recordingIdString})
      `));
      
      for (const rw of recordingWorks.rows) {
        edges.push({
          source: `rec_${rw.recording_isrc}`,
          target: `work_${rw.work_iswc}`,
          label: 'EMBODIES'
        });
      }
    }
    
    // Add MLC writers as nodes and connect to works
    const mlcWriters = await db.execute(sql.raw(`
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
    `));
    
    for (const writer of mlcWriters.rows) {
      if (writer.writer_name && writer.writer_name.trim()) {
        const writerData = writer as any;
        const nodeId = `mlc_writer_${writerData.ipi || writerData.writer_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const writerNode: GraphNode = {
          id: nodeId,
          label: writerData.writer_name,
          type: 'mlc_writer',
          properties: {
            ipi: writerData.ipi,
            roles: writerData.roles,
            work_count: writerData.work_count,
            data_source: 'MLC'
          }
        };
        nodes.push(writerNode);
        addedNodes.add(nodeId);
        
        // Connect writer to their works
        if (writerData.work_ids && Array.isArray(writerData.work_ids)) {
          for (const workId of writerData.work_ids) {
            // Get work details
            const workData = await db.execute(sql`
              SELECT iswc, title FROM mlc_works WHERE id = ${workId} LIMIT 1
            `);
            
            if (workData.rows.length > 0) {
              const work = workData.rows[0];
              let targetNodeId = null;
              
              // Try ISWC-based node
              if (work.iswc) {
                const iswcNodeId = `work_${work.iswc}`;
                if (addedNodes.has(iswcNodeId)) {
                  targetNodeId = iswcNodeId;
                }
              }
              
              // MLC work node - create if needed
              if (!targetNodeId) {
                const mlcWorkNodeId = `mlc_work_${workId}`;
                if (addedNodes.has(mlcWorkNodeId)) {
                  targetNodeId = mlcWorkNodeId;
                } else if (work.title) {
                  // Try to find corroborated ISWC from Quansic
                  let corroboratedISWC = work.iswc;
                  let iswcSource = 'MLC';
                  
                  if (!corroboratedISWC) {
                    const quansicMatch = await db.execute(sql`
                      SELECT id, COUNT(*) OVER() as total_matches
                      FROM quansic_works 
                      WHERE UPPER(TRIM(title)) = UPPER(TRIM(${work.title}))
                        AND artist_id = '0000000356358936'
                      ORDER BY created_at
                      LIMIT 1
                    `);
                    if (quansicMatch.rows.length > 0) {
                      const match = quansicMatch.rows[0] as any;
                      corroboratedISWC = match.id;
                      iswcSource = match.total_matches > 1 
                        ? `Quansic (${match.total_matches} ISWCs - using primary)`
                        : 'Quansic (corroborated)';
                    }
                  }
                  
                  // Create MLC work node
                  const mlcWorkNode: GraphNode = {
                    id: mlcWorkNodeId,
                    label: work.title.substring(0, 40),
                    type: 'work',
                    properties: {
                      mlc_id: workId,
                      title: work.title,
                      iswc: corroboratedISWC || 'No ISWC',
                      iswc_source: corroboratedISWC ? iswcSource : 'None',
                      data_source: 'MLC'
                    }
                  };
                  nodes.push(mlcWorkNode);
                  addedNodes.add(mlcWorkNodeId);
                  targetNodeId = mlcWorkNodeId;
                  
                  // Connect MLC work to artist
                  edges.push({
                    source: mlcWorkNodeId,
                    target: artistNodeId,
                    label: 'COMPOSED_BY'
                  });
                }
              }
              
              // Create edge from writer to work
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
    
    // Add MLC publishers
    const mlcPublishers = await db.execute(sql`
      SELECT DISTINCT
        publisher_name,
        publisher_ipi as ipi,
        publisher_number as hfa_publisher_number,
        COUNT(DISTINCT work_id) as work_count,
        ARRAY_AGG(DISTINCT work_id) as work_ids
      FROM mlc_publishers
      WHERE publisher_name IS NOT NULL
      GROUP BY publisher_name, publisher_ipi, publisher_number
      ORDER BY work_count DESC
      LIMIT 20
    `);
    
    for (const publisher of mlcPublishers.rows) {
      const pubData = publisher as any;
      const nodeId = `publisher_${pubData.publisher_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const publisherNode: GraphNode = {
        id: nodeId,
        label: pubData.publisher_name,
        type: 'publisher',
        properties: {
          publisher_name: pubData.publisher_name,
          ipi: pubData.ipi,
          hfa_number: pubData.hfa_publisher_number,
          work_count: pubData.work_count,
          data_source: 'MLC'
        }
      };
      nodes.push(publisherNode);
      addedNodes.add(nodeId);
      
      // Create edges to works
      if (pubData.work_ids && Array.isArray(pubData.work_ids)) {
        for (const workId of pubData.work_ids) {
          const workData = await db.execute(sql`
            SELECT iswc, title FROM mlc_works WHERE id = ${workId} LIMIT 1
          `);
          
          if (workData.rows.length > 0) {
            const work = workData.rows[0];
            let connected = false;
            
            // Try ISWC node first
            if (work.iswc) {
              const iswcNodeId = `work_${work.iswc}`;
              if (addedNodes.has(iswcNodeId)) {
                edges.push({
                  source: nodeId,
                  target: iswcNodeId,
                  label: 'PUBLISHES'
                });
                connected = true;
              }
            }
            
            // If no ISWC connection, create MLC work node
            if (!connected && work.title) {
              const mlcWorkNodeId = `mlc_work_${workId}`;
              
              if (!addedNodes.has(mlcWorkNodeId)) {
                // Try to find corroborated ISWC from Quansic
                let corroboratedISWC = work.iswc;
                let iswcSource = 'MLC';
                
                if (!corroboratedISWC) {
                  const quansicMatch = await db.execute(sql`
                    SELECT id, COUNT(*) OVER() as total_matches
                    FROM quansic_works 
                    WHERE UPPER(TRIM(title)) = UPPER(TRIM(${work.title}))
                      AND artist_id = '0000000356358936'
                    ORDER BY created_at
                    LIMIT 1
                  `);
                  if (quansicMatch.rows.length > 0) {
                    const match = quansicMatch.rows[0] as any;
                    corroboratedISWC = match.id;
                    iswcSource = match.total_matches > 1 
                      ? `Quansic (${match.total_matches} ISWCs - using primary)`
                      : 'Quansic (corroborated)';
                  }
                }
                
                const mlcWorkNode: GraphNode = {
                  id: mlcWorkNodeId,
                  label: work.title.substring(0, 40),
                  type: 'work',
                  properties: {
                    mlc_id: workId,
                    title: work.title,
                    iswc: corroboratedISWC || 'No ISWC',
                    iswc_source: corroboratedISWC ? iswcSource : 'None',
                    data_source: 'MLC'
                  }
                };
                nodes.push(mlcWorkNode);
                addedNodes.add(mlcWorkNodeId);
                
                // Connect MLC work to artist
                edges.push({
                  source: mlcWorkNodeId,
                  target: artistNodeId,
                  label: 'COMPOSED_BY'
                });
              }
              
              // Connect publisher to MLC work
              edges.push({
                source: nodeId,
                target: mlcWorkNodeId,
                label: 'PUBLISHES'
              });
            }
          }
        }
      }
    }
    
    // Add contributors from works (similar to create-graph-viz.ts)
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
        const contribData = contrib as any;
        const nodeId = `contrib_${contribData.contributor_name?.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const contribNode: GraphNode = {
          id: nodeId,
          label: contribData.contributor_name,
          type: 'contributor',
          properties: {
            role: contribData.contributor_role,
            work_count: contribData.work_count,
            data_source: 'Quansic'
          }
        };
        nodes.push(contribNode);
        addedNodes.add(nodeId);
        
        // Connect to works
        if (contribData.work_ids && Array.isArray(contribData.work_ids)) {
          for (const workId of contribData.work_ids) {
            const workNodeId = `work_${workId}`;
            if (addedNodes.has(workNodeId)) {
              edges.push({
                source: nodeId,
                target: workNodeId,
                label: contribData.contributor_role || 'CONTRIBUTED_TO'
              });
            }
          }
        }
      }
    }
    
    // Add alternative names
    const altNames = await db.execute(sql`
      SELECT DISTINCT name as alternative_name 
      FROM quansic_artist_aliases 
      WHERE artist_id = ${this.artistISNI}
    `);
    
    let altNameIndex = 0;
    for (const alt of altNames.rows) {
      const altData = alt as any;
      if (altData.alternative_name && altData.alternative_name.trim()) {
        const nodeId = `altname_${this.artistISNI}_${altNameIndex++}`;
        const altNode: GraphNode = {
          id: nodeId,
          label: altData.alternative_name,
          type: 'alternative_name',
          properties: {
            alternative_name: altData.alternative_name,
            data_source: 'Quansic'
          }
        };
        nodes.push(altNode);
        addedNodes.add(nodeId);
        
        // Connect to artist
        edges.push({
          source: nodeId,
          target: artistNodeId,
          label: 'ALIAS_OF'
        });
      }
    }
    
    // Store for later use
    this.nodes = nodes;
    this.edges = edges;
    nodes.forEach(n => this.nodeMap.set(n.id, n));
  }
  
  private async createConnectedOps(): Promise<any[]> {
    const ops: any[] = [];
    
    // Step 1: Create schema (properties and types)
    this.createSchema(ops);
    
    // Step 2: Create entities in dependency order with embedded relations
    
    // First create the artist (no dependencies)
    const artistNode = this.nodes.find(n => n.type === 'artist')!;
    
    // Collect all alternative names as values
    const artistValues = this.getNodeValues(artistNode);
    const altNameNodes = this.nodes.filter(n => n.type === 'alternative_name');
    for (const altNode of altNameNodes) {
      if (altNode.label && altNode.label.trim()) {
        artistValues.push({
          property: this.propertyIds.alternative_names,
          value: altNode.label
        });
      }
    }
    
    const { id: artistEntityId, ops: artistOps } = Graph.createEntity({
      name: artistNode.label,
      description: artistNode.properties?.description || 'Music artist',
      types: [this.typeIds.artist],
      values: artistValues
    });
    artistNode.entityId = artistEntityId;
    ops.push(...artistOps);
    
    // Create works (depend on artist)
    const workNodes = this.nodes.filter(n => n.type === 'work');
    for (const workNode of workNodes) {
      const workRelations: any = {};
      
      // Find COMPOSED_BY edges for this work
      const composedByEdges = this.edges.filter(e => 
        e.source === workNode.id && e.label === 'COMPOSED_BY'
      );
      
      if (composedByEdges.length > 0) {
        // For simplicity, just use the first one (should be artist)
        const targetNode = this.nodeMap.get(composedByEdges[0].target);
        if (targetNode?.entityId) {
          workRelations[this.propertyIds.composed_by] = {
            toEntity: targetNode.entityId
          };
        }
      }
      
      const { id: workEntityId, ops: workOps } = Graph.createEntity({
        name: workNode.label,
        description: workNode.properties?.description || 'Musical work',
        types: [this.typeIds.work],
        values: this.getNodeValues(workNode),
        relations: workRelations
      });
      workNode.entityId = workEntityId;
      ops.push(...workOps);
    }
    
    // Create recordings (depend on artist and works)
    const recordingNodes = this.nodes.filter(n => n.type === 'recording');
    for (const recNode of recordingNodes) {
      const recRelations: any = {};
      
      // Find PERFORMED_BY edges
      const performedByEdges = this.edges.filter(e => 
        e.source === recNode.id && e.label === 'PERFORMED_BY'
      );
      
      if (performedByEdges.length > 0) {
        const targetNode = this.nodeMap.get(performedByEdges[0].target);
        if (targetNode?.entityId) {
          recRelations[this.propertyIds.performed_by] = {
            toEntity: targetNode.entityId
          };
        }
      }
      
      // Find RECORDING_OF edges (recording -> work)
      const recordingOfEdges = this.edges.filter(e => 
        e.source === recNode.id && e.label === 'EMBODIES'
      );
      
      if (recordingOfEdges.length > 0) {
        const targetNode = this.nodeMap.get(recordingOfEdges[0].target);
        if (targetNode?.entityId) {
          recRelations[this.propertyIds.recording_of] = {
            toEntity: targetNode.entityId
          };
        }
      }
      
      const { id: recEntityId, ops: recOps } = Graph.createEntity({
        name: recNode.label,
        description: recNode.properties?.description || 'Recording',
        types: [this.typeIds.recording],
        values: this.getNodeValues(recNode),
        relations: recRelations
      });
      recNode.entityId = recEntityId;
      ops.push(...recOps);
    }
    
    return ops;
  }
  
  private createSchema(ops: any[]) {
    // Properties
    const properties = [
      { key: 'isni', name: 'ISNI', type: 'STRING' },
      { key: 'isrc', name: 'ISRC', type: 'STRING' },
      { key: 'iswc', name: 'ISWC', type: 'STRING' },
      { key: 'spotify_id', name: 'Spotify ID', type: 'STRING' },
      { key: 'apple_id', name: 'Apple Music ID', type: 'STRING' },
      { key: 'deezer_id', name: 'Deezer ID', type: 'STRING' },
      { key: 'alternative_names', name: 'Alternative Names', type: 'STRING' },
      { key: 'duration_ms', name: 'Duration (ms)', type: 'NUMBER' },
      { key: 'year', name: 'Year', type: 'STRING' }, // Store as STRING to avoid comma formatting
      { key: 'birthdate', name: 'Date of Birth', type: 'STRING' },
      { key: 'ipis', name: 'IPI Numbers', type: 'STRING' },
      // Relation properties
      { key: 'performed_by', name: 'Performed By', type: 'RELATION' },
      { key: 'composed_by', name: 'Composed By', type: 'RELATION' },
      { key: 'recording_of', name: 'Recording Of', type: 'RELATION' },
    ];
    
    for (const prop of properties) {
      const { id, ops: propOps } = Graph.createProperty({
        name: prop.name,
        dataType: prop.type as any,
      });
      this.propertyIds[prop.key] = id;
      ops.push(...propOps);
    }
    
    // Types
    const types = [
      { key: 'artist', name: 'Music Artist', props: ['isni', 'spotify_id', 'apple_id', 'birthdate', 'ipis', 'alternative_names'] },
      { key: 'recording', name: 'Recording', props: ['isrc', 'duration_ms', 'year', 'spotify_id', 'apple_id', 'deezer_id', 'performed_by', 'recording_of'] },
      { key: 'work', name: 'Musical Work', props: ['iswc', 'composed_by'] },
      { key: 'mlc_writer', name: 'Writer', props: [] },
      { key: 'publisher', name: 'Publisher', props: [] },
      { key: 'contributor', name: 'Contributor', props: [] },
    ];
    
    for (const type of types) {
      const propIds = type.props.map(p => this.propertyIds[p]).filter(Boolean);
      const { id, ops: typeOps } = Graph.createType({
        name: type.name,
        properties: propIds,
      });
      this.typeIds[type.key] = id;
      ops.push(...typeOps);
    }
  }
  
  private getNodeValues(node: GraphNode): any[] {
    const values: any[] = [];
    
    if (node.properties) {
      for (const [key, value] of Object.entries(node.properties)) {
        // Skip description - it's handled separately
        if (key === 'description') continue;
        
        const propId = this.propertyIds[key];
        if (propId && value !== null && value !== undefined && value !== 'N/A') {
          if (typeof value === 'number') {
            values.push({
              property: propId,
              value: String(value),
            });
          } else if (Array.isArray(value) && value.length > 0) {
            // For arrays, take the first value
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
  
  private async saveDryRun(ops: any[]) {
    console.log(chalk.bold.cyan('\n📊 DRY RUN SUMMARY\n'));
    
    // Count by type
    const nodeTypes = new Map<string, number>();
    this.nodes.forEach(n => {
      nodeTypes.set(n.type, (nodeTypes.get(n.type) || 0) + 1);
    });
    
    console.log(chalk.bold('Nodes:'));
    nodeTypes.forEach((count, type) => {
      console.log(`  ${type}: ${count}`);
    });
    console.log(`  Total: ${this.nodes.length}`);
    
    // Edge summary
    const edgeTypes = new Map<string, number>();
    this.edges.forEach(e => {
      edgeTypes.set(e.label, (edgeTypes.get(e.label) || 0) + 1);
    });
    
    console.log(chalk.bold('\nEdges:'));
    edgeTypes.forEach((count, type) => {
      console.log(`  ${type}: ${count}`);
    });
    console.log(`  Total: ${this.edges.length}`);
    
    console.log(chalk.bold('\nGRC-20 Operations:'));
    console.log(`  Total ops: ${ops.length}`);
    console.log(`  Properties created: ${Object.keys(this.propertyIds).length}`);
    console.log(`  Types created: ${Object.keys(this.typeIds).length}`);
    console.log(`  Entities with relations: ${this.nodes.filter(n => n.entityId).length}`);
    
    // Save to files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = `output/grc20-v2-${this.artistISNI}-${timestamp}`;
    
    fs.writeFileSync(`${prefix}-ops.json`, JSON.stringify(ops, null, 2));
    fs.writeFileSync(`${prefix}-graph.json`, JSON.stringify({
      nodes: this.nodes,
      edges: this.edges
    }, null, 2));
    
    console.log(chalk.green(`\n✓ Data saved to ${prefix}-*.json`));
    console.log(chalk.cyan(`\n📊 Graph Stats: ${this.nodes.length} nodes, ${this.edges.length} edges`));
    console.log(chalk.cyan('\n🔗 Relations are now embedded in entities!'));
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
    const space = await Graph.createSpace({
      editorAddress: address,
      name: 'songverse-v2',
      network: 'TESTNET',
    });
    
    // Publish to IPFS
    console.log(chalk.cyan('Publishing to IPFS...'));
    const { cid } = await Ipfs.publishEdit({
      name: `Songverse v2: Connected Music Graph`,
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
    console.log(chalk.cyan(`\nView on Geo Browser: https://testnet.geobrowser.io/space/${space.id}`));
    console.log(chalk.green('\n🔗 All entities are now properly connected with navigable relations!'));
  }
}

// Main execution
if (import.meta.main) {
  const artistISNI = process.argv[2] || '0000000356358936';
  const forceRun = process.argv.includes('--no-dry-run');
  const dryRun = forceRun ? false : (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY === '');
  
  const pipeline = new ArtistToGRC20PipelineV2(artistISNI);
  pipeline.process({ dryRun }).catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });
}

export { ArtistToGRC20PipelineV2 };