#!/usr/bin/env bun

/**
 * REUSABLE GRAPH VISUALIZATION CREATOR
 * 
 * Generic tool to create interactive graph visualizations for any artist
 * 
 * Usage: 
 *   bun run create-graph-viz.ts [ISNI]
 *   bun run create-graph-viz.ts 0000000356358936  # For Grimes
 */

import chalk from 'chalk';
import { db, initDb } from './src/db/postgres';
import { sql } from 'drizzle-orm';
import fs from 'fs/promises';

interface GraphConfig {
  artistISNI?: string;
  maxNodes?: number;
  includeContributors?: boolean;
  includeReleases?: boolean;
}

class MusicGraphVisualizer {
  private config: GraphConfig;
  
  constructor(config: GraphConfig = {}) {
    this.config = {
      artistISNI: config.artistISNI || '0000000356358936',
      maxNodes: config.maxNodes || 100,
      includeContributors: config.includeContributors !== false,
      includeReleases: config.includeReleases !== false,
    };
  }
  
  async generateGraphData() {
    await initDb();
    
    const nodes = [];
    const edges = [];
    const addedNodes = new Set();
    
    // Get artist info
    const artist = await db.execute(sql`
      SELECT * FROM quansic_artists WHERE id = ${this.config.artistISNI}
    `);
    
    if (artist.rows.length === 0) {
      throw new Error(`Artist with ISNI ${this.config.artistISNI} not found`);
    }
    
    const artistData = artist.rows[0];
    const artistNodeId = `artist_${artistData.id}`;
    
    // Parse all identifiers from JSON
    let allIPIs = [];
    let identifiers: any = {};
    if (artistData.all_identifiers) {
      identifiers = typeof artistData.all_identifiers === 'string' 
        ? JSON.parse(artistData.all_identifiers) 
        : artistData.all_identifiers;
      allIPIs = identifiers.ipis || [];
    }
    
    // Add central artist node with ALL data
    addedNodes.add(artistNodeId);
    nodes.push({
      data: {
        id: artistNodeId,
        label: artistData.name,
        type: 'artist',
        properties: {
          // Primary identifiers
          isni: artistData.id,
          ipis: allIPIs, // Both: 00633996999, 00633997013
          ipn: identifiers.ipns?.[0] || null, // 10692725
          
          // Streaming platforms
          spotify_id: identifiers.spotifyIds?.[0] || artistData.spotify_id,
          apple_id: identifiers.appleIds?.[0] || null, // 2756920
          deezer_id: identifiers.deezerIds?.[0] || null, // 807493
          amazon_ids: identifiers.amazonIds || [], // B004AQ761G, B016VB19BA
          
          // Music databases
          musicbrainz_id: identifiers.musicBrainzIds?.[0] || artistData.musicbrainz_id,
          discogs_ids: identifiers.discogsIds || [], // 3396407, 1993487
          wikidata_id: identifiers.wikidataIds?.[0] || artistData.wikidata_id, // Q117970
          
          // Additional identifiers
          merged_isni: identifiers.mergedIsnis?.[0] || null, // 0000000383876405
          
          // Metadata
          date_of_birth: artistData.date_of_birth || '1988-03-17',
          nationality: artistData.nationality || 'CA',
          type: 'Person',
          
          data_source: 'Quansic'
        }
      }
    });
    
    // Add alternative names as nodes
    const altNames = await db.execute(sql`
      SELECT name, language FROM quansic_artist_aliases 
      WHERE artist_id = ${this.config.artistISNI}
    `);
    
    for (const altName of altNames.rows) {
      const nodeId = `altname_${altName.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      addedNodes.add(nodeId);
      nodes.push({
        data: {
          id: nodeId,
          label: altName.name,
          type: 'alternative_name',
          properties: {
            language: altName.language || 'unknown',
            canonical_artist: artistData.name
          }
        }
      });
      
      edges.push({
        data: {
          id: `edge_${nodeId}_${artistNodeId}`,
          source: nodeId,
          target: artistNodeId,
          label: 'ALIAS_OF'
        }
      });
    }
    
    // Add recordings
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
      WHERE r.artist_id = ${this.config.artistISNI}
      GROUP BY r.id, r.artist_id, r.isrc, r.title, r.duration_ms, r.year,
               r.spotify_id, r.apple_id, r.deezer_id, r.created_at,
               s.spotify_id, s.popularity, s.track_name
      ORDER BY s.popularity DESC NULLS LAST
      LIMIT ${Math.floor(this.config.maxNodes! / 2)}
    `);
    
    const recordingIds = recordings.rows.map(r => r.id);
    
    // Get recording-work relationships for remix detection
    const recordingWorksData = recordingIds.length > 0 ? await db.execute(sql`
      SELECT recording_isrc, work_iswc 
      FROM quansic_recording_works 
      WHERE recording_isrc = ANY(ARRAY[${sql.raw(recordingIds.map(id => `'${id}'`).join(','))}])
    `) : { rows: [] };
    
    for (const rec of recordings.rows) {
      const nodeId = `rec_${rec.id}`;
      addedNodes.add(nodeId);
      const properties: any = {
        isrc: rec.id,
        year: rec.year,
        duration_ms: rec.duration_ms
      };
      
      // Add streaming platform IDs if available
      if (rec.spotify_id) properties.spotify_id = rec.spotify_id;
      if (rec.apple_id) properties.apple_id = rec.apple_id;
      if (rec.deezer_id) properties.deezer_id = rec.deezer_id;
      
      nodes.push({
        data: {
          id: nodeId,
          label: (rec.track_name || rec.title || rec.id).substring(0, 40),
          type: 'recording',
          properties
        }
      });
      
      // For remixes, try to find and connect to the original work
      const isRemix = rec.title.match(/remix|edit|mix|version/i);
      if (isRemix && !recordingWorksData.rows.find((rw: any) => rw.recording_isrc === rec.id)) {
        // Extract base title (remove remix/edit suffixes and remixer names)
        const baseTitle = rec.title
          .replace(/\s*[\(\[]?.*[Rr]emix.*$/i, '')  // Remove anything from remix onwards
          .replace(/\s*-\s*.*$/i, '')                // Remove anything after dash
          .trim();
        
        // Try to find the work for this song in both Quansic and MLC
        const workMatch = await db.execute(sql`
          SELECT id as work_iswc FROM (
            SELECT id FROM quansic_works 
            WHERE UPPER(TRIM(title)) = UPPER(TRIM(${baseTitle}))
            UNION
            SELECT COALESCE(iswc, id) as id FROM mlc_works
            WHERE UPPER(TRIM(title)) = UPPER(TRIM(${baseTitle}))
          ) combined
          LIMIT 1
        `);
        
        if (workMatch.rows.length > 0) {
          const workId = workMatch.rows[0].work_iswc;
          
          // Try both node ID formats (work_ and mlc_work_)
          let workNodeId = `work_${workId}`;
          if (!addedNodes.has(workNodeId)) {
            workNodeId = `mlc_work_${workId}`;
          }
          
          // Connect remix recording to work if it exists
          if (addedNodes.has(workNodeId)) {
            edges.push({
              data: {
                source: nodeId,
                target: workNodeId,
                label: 'EMBODIES (remix)'
              }
            });
          }
        }
      }
      
      edges.push({
        data: {
          id: `edge_${nodeId}_${artistNodeId}`,
          source: nodeId,
          target: artistNodeId,
          label: 'PERFORMED_BY'
        }
      });
    }
    
    // Add works
    if (recordingIds.length > 0) {
      const recordingIdString = recordingIds.map(id => `'${id}'`).join(',');
      const works = await db.execute(sql.raw(`
        SELECT 
          w.*,
          COUNT(DISTINCT rw.recording_isrc) as recording_count,
          COUNT(DISTINCT wc.id) as contributor_count,
          COUNT(DISTINCT m.id) as mlc_match_count
        FROM quansic_works w
        LEFT JOIN quansic_recording_works rw ON w.id = rw.work_iswc
        LEFT JOIN quansic_work_contributors wc ON w.id = wc.work_iswc
        LEFT JOIN mlc_works m ON UPPER(TRIM(w.title)) = UPPER(TRIM(m.title))
        WHERE w.artist_id = '${this.config.artistISNI}'
        AND EXISTS (
          SELECT 1 FROM quansic_recording_works rw2 
          WHERE rw2.work_iswc = w.id 
          AND rw2.recording_isrc IN (${recordingIdString})
        )
        GROUP BY w.id, w.artist_id, w.title, w.role, w.q1_score, w.created_at
      `));
      
      for (const work of works.rows) {
        const nodeId = `work_${work.id}`;
        addedNodes.add(nodeId);
        nodes.push({
          data: {
            id: nodeId,
            label: (work.title || work.id).substring(0, 40),
            type: 'work',
            properties: {
              iswc: work.id,
              title: work.title
              // Only immutable properties for on-chain minting
            }
          }
        });
        
        edges.push({
          data: {
            id: `edge_${nodeId}_${artistNodeId}`,
            source: nodeId,
            target: artistNodeId,
            label: 'COMPOSED_BY'
          }
        });
      }
      
      // Add recording-work relationships
      const recordingWorks = await db.execute(sql.raw(`
        SELECT * FROM quansic_recording_works 
        WHERE recording_isrc IN (${recordingIdString})
      `));
      
      for (const rw of recordingWorks.rows) {
        edges.push({
          data: {
            id: `edge_rw_${rw.recording_isrc}_${rw.work_iswc}`,
            source: `rec_${rw.recording_isrc}`,
            target: `work_${rw.work_iswc}`,
            label: 'EMBODIES'
            // No properties needed - the relationship itself is the data
          }
        });
      }
    }
    
    // Add MLC writers as nodes and connect to works
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
          data: {
            id: nodeId,
            label: writerData.writer_name,
            type: 'mlc_writer',
            properties: {
              ipi: writerData.ipi,
              roles: writerData.roles,
              work_count: writerData.work_count,
              data_source: 'MLC'
            }
          }
        });
        
        // Connect writer to their works
        if (writerData.work_ids && Array.isArray(writerData.work_ids)) {
          for (const workId of writerData.work_ids) {
            // Try to find existing work nodes
            let targetNodeId = null;
            
            // Get work details
            const workData = await db.execute(sql`
              SELECT iswc, title FROM mlc_works WHERE id = ${workId} LIMIT 1
            `);
            
            if (workData.rows.length > 0) {
              const work = workData.rows[0];
              
              // Strategy 1: Try ISWC-based node
              if (work.iswc) {
                const iswcNodeId = `work_${work.iswc}`;
                if (addedNodes.has(iswcNodeId)) {
                  targetNodeId = iswcNodeId;
                }
              }
              
              // Strategy 2: MLC work node - create if needed
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
                      ORDER BY created_at
                      LIMIT 1
                    `);
                    if (quansicMatch.rows.length > 0) {
                      const match = quansicMatch.rows[0] as any;
                      corroboratedISWC = match.id;
                      iswcSource = match.total_matches > 1 
                        ? `Quansic (${match.total_matches} ISWCs found - using primary)`
                        : 'Quansic (corroborated)';
                    }
                  }
                  
                  // Create MLC work node if it doesn't exist
                  nodes.push({
                    data: {
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
                    }
                  });
                  addedNodes.add(mlcWorkNodeId);
                  targetNodeId = mlcWorkNodeId;
                  
                  // Connect MLC work to artist
                  edges.push({
                    data: {
                      source: mlcWorkNodeId,
                      target: artistNodeId,
                      label: 'COMPOSED_BY'
                    }
                  });
                }
              }
              
              // Create edge from writer to work
              if (targetNodeId) {
                edges.push({
                  data: {
                    source: nodeId,
                    target: targetNodeId,
                    label: 'WRITES'
                  }
                });
              }
            }
          }
        }
      }
    }
    
    // Add MLC publishers with IPIs and create edges to works
    const mlcPublishers = await db.execute(sql`
      SELECT DISTINCT
        publisher_name,
        publisher_ipi,
        administrator_name,
        administrator_ipi,
        publisher_number,
        COUNT(DISTINCT work_id) as work_count,
        ARRAY_AGG(DISTINCT work_id) as work_ids
      FROM mlc_publishers
      WHERE publisher_ipi IS NOT NULL 
         OR administrator_ipi IS NOT NULL
      GROUP BY publisher_name, publisher_ipi, 
               administrator_name, administrator_ipi,
               publisher_number
      ORDER BY work_count DESC
      LIMIT 25
    `);
    
    for (const pub of mlcPublishers.rows) {
      const pubData = pub as any;
      const nodeId = `publisher_${pubData.publisher_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      if (!addedNodes.has(nodeId)) {
        nodes.push({
          data: {
            id: nodeId,
            label: pubData.publisher_name,
            type: 'publisher',
            properties: {
              work_count: pubData.work_count,
              publisher_ipi: pubData.publisher_ipi || 'N/A',
              administrator: pubData.administrator_name || 'N/A',
              administrator_ipi: pubData.administrator_ipi || 'N/A',
              publisher_number: pubData.publisher_number || 'N/A',
              data_source: 'MLC'
            }
          }
        });
        addedNodes.add(nodeId);
        
        // Create edges to works using multiple strategies
        if (pubData.work_ids && Array.isArray(pubData.work_ids)) {
          for (const workId of pubData.work_ids) {
            let connected = false;
            
            // Strategy 1: Try ISWC-based work node
            const workData = await db.execute(sql`
              SELECT iswc, title FROM mlc_works WHERE id = ${workId} LIMIT 1
            `);
            
            if (workData.rows.length > 0) {
              const work = workData.rows[0];
              
              // Try ISWC node first
              if (work.iswc) {
                const iswcNodeId = `work_${work.iswc}`;
                if (addedNodes.has(iswcNodeId)) {
                  edges.push({
                    data: {
                      source: nodeId,
                      target: iswcNodeId,
                      label: 'PUBLISHES'
                    }
                  });
                  connected = true;
                }
              }
              
              // Strategy 2: If no ISWC connection, create MLC work node
              if (!connected && work.title) {
                const mlcWorkNodeId = `mlc_work_${workId}`;
                
                // Add the MLC work node if not exists
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
                  
                  nodes.push({
                    data: {
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
                    }
                  });
                  addedNodes.add(mlcWorkNodeId);
                }
                
                // Connect publisher to MLC work
                edges.push({
                  data: {
                    source: nodeId,
                    target: mlcWorkNodeId,
                    label: 'PUBLISHES'
                  }
                });
                
                // Try to connect MLC work to artist
                edges.push({
                  data: {
                    source: mlcWorkNodeId,
                    target: artistNodeId,
                    label: 'COMPOSED_BY'
                  }
                });
              }
            }
          }
        }
      }
    }
    
    // Add contributors if requested
    if (this.config.includeContributors && recordingIds.length > 0) {
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
        const nodeId = `contrib_${contrib.contributor_name?.replace(/[^a-zA-Z0-9]/g, '_')}`;
        nodes.push({
          data: {
            id: nodeId,
            label: contrib.contributor_name,
            type: 'contributor',
            properties: {
              role: contrib.contributor_role,
              workCount: contrib.work_count
            }
          }
        });
        
        // Add edges to works
        if (contrib.work_ids) {
          for (const workId of contrib.work_ids.slice(0, 5)) {
            edges.push({
              data: {
                id: `edge_${nodeId}_work_${workId}`,
                source: nodeId,
                target: `work_${workId}`,
                label: contrib.contributor_role
              }
            });
          }
        }
      }
    }
    
    return { nodes, edges, artistName: artistData.name };
  }
  
  generateHTML(nodes: any[], edges: any[], artistName: string) {
    // HTML template with improved styling and features
    return `<!DOCTYPE html>
<html>
<head>
    <title>${artistName} - Music Graph Network</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://unpkg.com/cytoscape@3.29.2/dist/cytoscape.min.js"></script>
    <script src="https://unpkg.com/layout-base/layout-base.js"></script>
    <script src="https://unpkg.com/cose-base/cose-base.js"></script>
    <script src="https://unpkg.com/cytoscape-fcose/cytoscape-fcose.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%);
            color: #fff;
            overflow: hidden;
        }
        
        #header {
            background: rgba(15, 15, 35, 0.9);
            padding: 15px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
        }
        
        #header h1 {
            font-size: 24px;
            font-weight: 600;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        #controls {
            display: flex;
            gap: 10px;
        }
        
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        
        #cy {
            width: 100vw;
            height: calc(100vh - 60px);
            background: radial-gradient(ellipse at center, #1a1a3e 0%, #0f0f23 100%);
        }
        
        #info {
            position: fixed;
            top: 80px;
            right: 20px;
            background: rgba(26, 26, 58, 0.95);
            padding: 20px;
            border-radius: 12px;
            max-width: 320px;
            max-height: 500px;
            overflow-y: auto;
            border: 1px solid rgba(102, 126, 234, 0.3);
            display: none;
            backdrop-filter: blur(20px);
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }
        
        #info h3 {
            margin: 0 0 15px 0;
            color: #a78bfa;
            font-size: 18px;
        }
        
        .property {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .property-key {
            color: #9ca3af;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .property-value {
            color: #fff;
            font-weight: 500;
            font-size: 14px;
        }
        
        #stats {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(26, 26, 58, 0.95);
            padding: 12px 20px;
            border-radius: 20px;
            font-size: 13px;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(102, 126, 234, 0.3);
            display: flex;
            gap: 20px;
        }
        
        .stat {
            display: flex;
            gap: 5px;
        }
        
        .stat-label {
            color: #9ca3af;
        }
        
        .stat-value {
            color: #a78bfa;
            font-weight: 600;
        }
        
        .legend {
            position: fixed;
            top: 80px;
            left: 20px;
            background: rgba(26, 26, 58, 0.95);
            padding: 20px;
            border-radius: 12px;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(102, 126, 234, 0.3);
        }
        
        .legend h4 {
            margin: 0 0 15px 0;
            color: #a78bfa;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            margin: 10px 0;
            font-size: 13px;
        }
        
        .legend-color {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            margin-right: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        
        #search {
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(26, 26, 58, 0.95);
            padding: 10px 20px;
            border-radius: 25px;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(102, 126, 234, 0.3);
        }
        
        #search input {
            background: transparent;
            border: none;
            color: white;
            outline: none;
            width: 200px;
            font-size: 14px;
        }
        
        #search input::placeholder {
            color: #9ca3af;
        }
    </style>
</head>
<body>
    <div id="header">
        <h1>🎵 ${artistName} Music Network</h1>
        <div id="controls">
            <button onclick="resetView()">Reset</button>
            <button onclick="toggleLayout('fcose')">Force</button>
            <button onclick="toggleLayout('circle')">Circle</button>
            <button onclick="toggleLayout('concentric')">Concentric</button>
            <button onclick="exportImage()">Export</button>
        </div>
    </div>
    
    <div id="search">
        <input type="text" placeholder="Search nodes..." onkeyup="searchNodes(this.value)">
    </div>
    
    <div class="legend">
        <h4>Node Types</h4>
        <div class="legend-item">
            <div class="legend-color" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);"></div>
            <span>Artist</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);"></div>
            <span>Recording</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);"></div>
            <span>Work</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);"></div>
            <span>Contributor</span>
        </div>
    </div>
    
    <div id="cy"></div>
    <div id="info"></div>
    
    <div id="stats">
        <div class="stat">
            <span class="stat-label">Nodes:</span>
            <span class="stat-value">${nodes.length}</span>
        </div>
        <div class="stat">
            <span class="stat-label">Edges:</span>
            <span class="stat-value">${edges.length}</span>
        </div>
    </div>
    
    <script>
        const graphData = {
            nodes: ${JSON.stringify(nodes, null, 2)},
            edges: ${JSON.stringify(edges, null, 2)}
        };
        
        const cy = cytoscape({
            container: document.getElementById('cy'),
            elements: graphData,
            style: [
                {
                    selector: 'node',
                    style: {
                        'label': 'data(label)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'font-size': '11px',
                        'color': '#fff',
                        'text-outline-width': 2,
                        'text-outline-color': '#0f0f23',
                        'background-opacity': 1,
                        'border-width': 3,
                        'border-opacity': 0.8
                    }
                },
                {
                    selector: 'node[type="artist"]',
                    style: {
                        'background-color': '#f5576c',
                        'border-color': '#f093fb',
                        'width': 100,
                        'height': 100,
                        'font-size': '16px',
                        'font-weight': 'bold'
                    }
                },
                {
                    selector: 'node[type="recording"]',
                    style: {
                        'background-color': '#00f2fe',
                        'border-color': '#4facfe',
                        'width': 45,
                        'height': 45
                    }
                },
                {
                    selector: 'node[type="work"]',
                    style: {
                        'background-color': '#38f9d7',
                        'border-color': '#43e97b',
                        'width': 55,
                        'height': 55,
                        'shape': 'pentagon'
                    }
                },
                {
                    selector: 'node[type="contributor"]',
                    style: {
                        'background-color': '#fee140',
                        'border-color': '#fa709a',
                        'width': 40,
                        'height': 40,
                        'shape': 'diamond'
                    }
                },
                {
                    selector: 'node[type="alternative_name"]',
                    style: {
                        'background-color': '#764ba2',
                        'border-color': '#667eea',
                        'width': 35,
                        'height': 35,
                        'shape': 'roundrectangle'
                    }
                },
                {
                    selector: 'node[type="mlc_writer"]',
                    style: {
                        'background-color': '#ff8787',
                        'border-color': '#ff6b6b',
                        'width': 45,
                        'height': 45,
                        'shape': 'hexagon'
                    }
                },
                {
                    selector: 'node[type="publisher"]',
                    style: {
                        'background-color': '#dcedc1',
                        'border-color': '#a8e6cf',
                        'width': 50,
                        'height': 50,
                        'shape': 'octagon'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': 'rgba(255, 255, 255, 0.2)',
                        'target-arrow-color': 'rgba(255, 255, 255, 0.4)',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'label': 'data(label)',
                        'font-size': '9px',
                        'color': 'rgba(255, 255, 255, 0.6)',
                        'text-rotation': 'autorotate',
                        'text-margin-y': -10
                    }
                },
                {
                    selector: '.highlighted',
                    style: {
                        'background-color': '#fff',
                        'border-color': '#667eea',
                        'border-width': 4,
                        'z-index': 9999
                    }
                }
            ],
            layout: {
                name: 'fcose',
                animate: true,
                randomize: true,
                nodeRepulsion: 6500,
                idealEdgeLength: 120,
                edgeElasticity: 0.45,
                nestingFactor: 0.1,
                numIter: 2500,
                tile: true,
                tilingPaddingVertical: 10,
                tilingPaddingHorizontal: 10
            },
            wheelSensitivity: 0.15
        });
        
        cy.on('tap', 'node', function(evt) {
            const node = evt.target;
            const data = node.data();
            const info = document.getElementById('info');
            
            let html = '<h3>' + data.label + '</h3>';
            html += '<div class="property"><span class="property-key">Type</span><span class="property-value">' + data.type + '</span></div>';
            
            if (data.properties) {
                for (const [key, value] of Object.entries(data.properties)) {
                    const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
                    html += '<div class="property"><span class="property-key">' + formattedKey + '</span><span class="property-value">' + value + '</span></div>';
                }
            }
            
            const connectedEdges = node.connectedEdges().length;
            html += '<div class="property"><span class="property-key">Connections</span><span class="property-value">' + connectedEdges + '</span></div>';
            
            info.innerHTML = html;
            info.style.display = 'block';
            
            // Highlight connected nodes
            cy.elements().removeClass('highlighted');
            node.addClass('highlighted');
            node.neighborhood().addClass('highlighted');
        });
        
        cy.on('tap', function(evt) {
            if (evt.target === cy) {
                document.getElementById('info').style.display = 'none';
                cy.elements().removeClass('highlighted');
            }
        });
        
        function resetView() {
            cy.fit();
            cy.zoom(1);
            cy.center();
        }
        
        function toggleLayout(layoutName) {
            const layoutOptions = {
                name: layoutName,
                animate: true,
                animationDuration: 1500
            };
            
            if (layoutName === 'fcose') {
                Object.assign(layoutOptions, {
                    nodeRepulsion: 6500,
                    idealEdgeLength: 120
                });
            }
            
            cy.layout(layoutOptions).run();
        }
        
        function searchNodes(query) {
            if (!query) {
                cy.elements().removeClass('highlighted');
                return;
            }
            
            cy.elements().removeClass('highlighted');
            const matches = cy.nodes().filter(node => 
                node.data('label').toLowerCase().includes(query.toLowerCase())
            );
            matches.addClass('highlighted');
            
            if (matches.length === 1) {
                cy.animate({
                    center: { eles: matches },
                    zoom: 2
                }, {
                    duration: 500
                });
            }
        }
        
        function exportImage() {
            const png = cy.png({ 
                output: 'blob', 
                bg: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)', 
                scale: 3 
            });
            const url = URL.createObjectURL(png);
            const link = document.createElement('a');
            link.href = url;
            link.download = '${artistName.toLowerCase().replace(/\s+/g, '-')}-music-graph.png';
            link.click();
        }
        
        setTimeout(() => resetView(), 500);
    </script>
</body>
</html>`;
  }
  
  async saveVisualization(artistName: string, html: string) {
    const filename = `output/${artistName.toLowerCase().replace(/\s+/g, '-')}-graph.html`;
    await fs.writeFile(filename, html);
    return filename;
  }
}

async function main() {
  const artistISNI = process.argv[2] || '0000000356358936';
  
  console.log(chalk.bold.magenta(`
╔════════════════════════════════════════╗
║   MUSIC GRAPH VISUALIZATION GENERATOR  ║
║   Interactive Network Explorer         ║
╚════════════════════════════════════════╝
  `));
  
  try {
    const visualizer = new MusicGraphVisualizer({
      artistISNI,
      maxNodes: 150,
      includeContributors: true,
      includeReleases: false
    });
    
    console.log(chalk.yellow(`\n📊 Generating graph for ISNI: ${artistISNI}\n`));
    
    const { nodes, edges, artistName } = await visualizer.generateGraphData();
    
    console.log(chalk.green(`✓ Generated ${nodes.length} nodes and ${edges.length} edges`));
    
    const html = visualizer.generateHTML(nodes, edges, artistName);
    const filename = await visualizer.saveVisualization(artistName, html);
    
    console.log(chalk.bold.green('\n✅ Visualization Complete!'));
    console.log(chalk.cyan(`
Open: file://${process.cwd()}/${filename}

Features:
  🔍 Search for any node
  🎨 Multiple layout algorithms  
  📊 Click nodes for detailed properties
  🖼️ Export high-resolution images
  ⚡ Real-time graph exploration
    `));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();