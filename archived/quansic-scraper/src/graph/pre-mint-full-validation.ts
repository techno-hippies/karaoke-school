#!/usr/bin/env bun

/**
 * FULL PRE-MINT VALIDATION
 * 
 * Matches the exact logic of create-graph-viz.ts to validate
 * ALL 322 nodes and 808 edges before minting to GRC-20
 */

import chalk from 'chalk';
import { db, initDb } from '../db/postgres';
import { sql } from 'drizzle-orm';
import fs from 'fs';

interface ValidationNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
  issues: string[];
}

interface ValidationEdge {
  source: string;
  target: string;
  label: string;
}

class FullPreMintValidator {
  private nodes: ValidationNode[] = [];
  private edges: ValidationEdge[] = [];
  private nodeMap = new Map<string, ValidationNode>();
  private issues: string[] = [];
  private artistISNI = '0000000356358936';
  
  async validate() {
    console.log(chalk.bold.cyan('\n🔍 FULL PRE-MINT VALIDATION (Matching create-graph-viz.ts)\n'));
    
    await initDb();
    
    // Follow exact same order as create-graph-viz.ts
    await this.addArtistNode();
    await this.addAlternativeNames();
    await this.addRecordings();
    await this.addWorks();
    await this.addMLCWriters();
    await this.addMLCPublishers();
    await this.addContributors();
    
    this.analyzeGraph();
    this.generateReport();
    await this.generateHTML();
  }
  
  private async addArtistNode() {
    console.log(chalk.yellow('Adding artist node...'));
    
    const artist = await db.execute(sql`
      SELECT * FROM quansic_artists WHERE id = ${this.artistISNI}
    `);
    
    if (artist.rows.length === 0) {
      throw new Error('Grimes not found');
    }
    
    const artistData = artist.rows[0] as any;
    
    // Parse identifiers
    let identifiers: any = {};
    if (artistData.all_identifiers) {
      identifiers = typeof artistData.all_identifiers === 'string' 
        ? JSON.parse(artistData.all_identifiers) 
        : artistData.all_identifiers;
    }
    
    const node: ValidationNode = {
      id: `artist_${artistData.id}`,
      label: artistData.name,
      type: 'artist',
      properties: {
        isni: artistData.id,
        ipis: identifiers.ipis || [],
        spotify_id: identifiers.spotifyIds?.[0] || artistData.spotify_id,
        apple_id: identifiers.appleIds?.[0],
        deezer_id: identifiers.deezerIds?.[0],
        musicbrainz_id: identifiers.musicBrainzIds?.[0],
        wikidata_id: identifiers.wikidataIds?.[0]
      },
      issues: []
    };
    
    // Validate critical fields
    if (!node.properties.ipis || node.properties.ipis.length === 0) {
      node.issues.push('Missing IPI numbers - critical for royalties');
    }
    
    this.nodes.push(node);
    this.nodeMap.set(node.id, node);
  }
  
  private async addAlternativeNames() {
    console.log(chalk.yellow('Adding alternative names...'));
    
    const altNames = await db.execute(sql`
      SELECT name, language FROM quansic_artist_aliases 
      WHERE artist_id = ${this.artistISNI}
    `);
    
    for (const altName of altNames.rows) {
      const nodeId = `altname_${altName.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const node: ValidationNode = {
        id: nodeId,
        label: altName.name,
        type: 'alternative_name',
        properties: {
          language: altName.language || 'unknown'
        },
        issues: []
      };
      
      this.nodes.push(node);
      this.nodeMap.set(nodeId, node);
      
      this.edges.push({
        source: nodeId,
        target: `artist_${this.artistISNI}`,
        label: 'ALIAS_OF'
      });
    }
  }
  
  private async addRecordings() {
    console.log(chalk.yellow('Adding recordings...'));
    
    const recordings = await db.execute(sql`
      SELECT 
        r.*,
        s.spotify_id,
        s.popularity,
        s.track_name
      FROM quansic_recordings r
      LEFT JOIN spotify_tracks s ON r.id = s.isrc
      WHERE r.artist_id = ${this.artistISNI}
      ORDER BY s.popularity DESC NULLS LAST
      LIMIT 75
    `);
    
    for (const rec of recordings.rows) {
      const nodeId = `rec_${rec.id}`;
      const node: ValidationNode = {
        id: nodeId,
        label: (rec.track_name || rec.title || rec.id).substring(0, 40),
        type: 'recording',
        properties: {
          isrc: rec.id,
          year: rec.year,
          duration_ms: rec.duration_ms,
          spotify_id: rec.spotify_id
        },
        issues: []
      };
      
      if (!rec.spotify_id) {
        node.issues.push('No Spotify enrichment');
      }
      
      this.nodes.push(node);
      this.nodeMap.set(nodeId, node);
      
      this.edges.push({
        source: nodeId,
        target: `artist_${this.artistISNI}`,
        label: 'PERFORMED_BY'
      });
    }
  }
  
  private async addWorks() {
    console.log(chalk.yellow('Adding works...'));
    
    // Get ALL works, not just those with recordings
    const works = await db.execute(sql`
      SELECT 
        w.*,
        COUNT(DISTINCT rw.recording_isrc) as recording_count
      FROM quansic_works w
      LEFT JOIN quansic_recording_works rw ON w.id = rw.work_iswc
      GROUP BY w.id, w.title, w.iswc, w.artist_id, w.created_at
    `);
    
    for (const work of works.rows) {
      const nodeId = `work_${work.id}`;
      const node: ValidationNode = {
        id: nodeId,
        label: work.title?.substring(0, 40) || work.id,
        type: 'work',
        properties: {
          iswc: work.iswc || work.id,
          recording_count: work.recording_count
        },
        issues: []
      };
      
      if (!work.iswc || work.iswc === work.id) {
        node.issues.push('No standard ISWC');
      }
      
      this.nodes.push(node);
      this.nodeMap.set(nodeId, node);
      
      // Connect to recordings
      const recordings = await db.execute(sql`
        SELECT recording_isrc FROM quansic_recording_works 
        WHERE work_iswc = ${work.id}
      `);
      
      for (const rec of recordings.rows) {
        const recNodeId = `rec_${rec.recording_isrc}`;
        if (this.nodeMap.has(recNodeId)) {
          this.edges.push({
            source: recNodeId,
            target: nodeId,
            label: 'EMBODIES'
          });
        }
      }
      
      // Connect to artist if composer
      const isComposer = await db.execute(sql`
        SELECT 1 FROM quansic_work_contributors 
        WHERE work_iswc = ${work.id} 
        AND contributor_isni = ${this.artistISNI}
        LIMIT 1
      `);
      
      if (isComposer.rows.length > 0) {
        this.edges.push({
          source: nodeId,
          target: `artist_${this.artistISNI}`,
          label: 'COMPOSED_BY'
        });
      }
    }
  }
  
  private async addMLCWriters() {
    console.log(chalk.yellow('Adding MLC writers...'));
    
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
      const writerData = writer as any;
      if (!writerData.writer_name?.trim()) continue;
      
      const nodeId = `mlc_writer_${writerData.ipi || writerData.writer_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const node: ValidationNode = {
        id: nodeId,
        label: writerData.writer_name,
        type: 'mlc_writer',
        properties: {
          ipi: writerData.ipi,
          work_count: writerData.work_count
        },
        issues: []
      };
      
      if (!writerData.ipi) {
        node.issues.push('Missing IPI');
      }
      
      this.nodes.push(node);
      this.nodeMap.set(nodeId, node);
      
      // Connect to works
      if (writerData.work_ids && Array.isArray(writerData.work_ids)) {
        for (const workId of writerData.work_ids) {
          // Check if we need to create MLC work node
          const workData = await db.execute(sql`
            SELECT iswc, title FROM mlc_works WHERE id = ${workId} LIMIT 1
          `);
          
          if (workData.rows.length > 0) {
            const work = workData.rows[0] as any;
            let targetNodeId = null;
            
            // Try to find existing work node
            if (work.iswc) {
              const iswcNodeId = `work_${work.iswc}`;
              if (this.nodeMap.has(iswcNodeId)) {
                targetNodeId = iswcNodeId;
              }
            }
            
            // Create MLC work node if needed
            if (!targetNodeId && work.title) {
              const mlcWorkNodeId = `mlc_work_${workId}`;
              if (!this.nodeMap.has(mlcWorkNodeId)) {
                const mlcNode: ValidationNode = {
                  id: mlcWorkNodeId,
                  label: work.title.substring(0, 40),
                  type: 'work',
                  properties: {
                    mlc_id: workId,
                    iswc: work.iswc || 'No ISWC',
                    data_source: 'MLC'
                  },
                  issues: []
                };
                
                if (!work.iswc) {
                  mlcNode.issues.push('Missing ISWC');
                }
                
                this.nodes.push(mlcNode);
                this.nodeMap.set(mlcWorkNodeId, mlcNode);
                
                // Connect to artist
                this.edges.push({
                  source: mlcWorkNodeId,
                  target: `artist_${this.artistISNI}`,
                  label: 'COMPOSED_BY'
                });
              }
              targetNodeId = mlcWorkNodeId;
            }
            
            if (targetNodeId) {
              this.edges.push({
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
  
  private async addMLCPublishers() {
    console.log(chalk.yellow('Adding MLC publishers...'));
    
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
      
      const node: ValidationNode = {
        id: nodeId,
        label: pubData.publisher_name,
        type: 'publisher',
        properties: {
          publisher_ipi: pubData.publisher_ipi || 'N/A',
          administrator_ipi: pubData.administrator_ipi,
          work_count: pubData.work_count
        },
        issues: []
      };
      
      if (!pubData.publisher_ipi && !pubData.administrator_ipi) {
        node.issues.push('No IPI for royalty distribution');
      }
      
      this.nodes.push(node);
      this.nodeMap.set(nodeId, node);
      
      // Connect to works
      if (pubData.work_ids && Array.isArray(pubData.work_ids)) {
        for (const workId of pubData.work_ids.slice(0, 10)) {
          // Similar logic to find/create work nodes
          const workData = await db.execute(sql`
            SELECT iswc, title FROM mlc_works WHERE id = ${workId} LIMIT 1
          `);
          
          if (workData.rows.length > 0) {
            const work = workData.rows[0] as any;
            let targetNodeId = null;
            
            if (work.iswc) {
              const iswcNodeId = `work_${work.iswc}`;
              if (this.nodeMap.has(iswcNodeId)) {
                targetNodeId = iswcNodeId;
              }
            }
            
            if (!targetNodeId) {
              const mlcWorkNodeId = `mlc_work_${workId}`;
              if (this.nodeMap.has(mlcWorkNodeId)) {
                targetNodeId = mlcWorkNodeId;
              }
            }
            
            if (targetNodeId) {
              this.edges.push({
                source: nodeId,
                target: targetNodeId,
                label: 'PUBLISHES'
              });
            }
          }
        }
      }
    }
  }
  
  private async addContributors() {
    console.log(chalk.yellow('Adding contributors...'));
    
    const contributors = await db.execute(sql`
      SELECT 
        contributor_name,
        contributor_role,
        COUNT(DISTINCT work_iswc) as work_count,
        ARRAY_AGG(DISTINCT work_iswc) as work_ids
      FROM quansic_work_contributors
      WHERE contributor_name != 'Grimes'
        AND contributor_isni != ${this.artistISNI}
      GROUP BY contributor_name, contributor_role
      ORDER BY work_count DESC
      LIMIT 15
    `);
    
    for (const contrib of contributors.rows) {
      const contribData = contrib as any;
      const nodeId = `contrib_${contribData.contributor_name?.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      const node: ValidationNode = {
        id: nodeId,
        label: contribData.contributor_name,
        type: 'contributor',
        properties: {
          role: contribData.contributor_role,
          work_count: contribData.work_count
        },
        issues: []
      };
      
      this.nodes.push(node);
      this.nodeMap.set(nodeId, node);
      
      // Connect to works
      if (contribData.work_ids && Array.isArray(contribData.work_ids)) {
        for (const workId of contribData.work_ids.slice(0, 5)) {
          const workNodeId = `work_${workId}`;
          if (this.nodeMap.has(workNodeId)) {
            this.edges.push({
              source: nodeId,
              target: workNodeId,
              label: contribData.contributor_role
            });
          }
        }
      }
    }
  }
  
  private analyzeGraph() {
    // Count orphaned nodes (no edges)
    const nodesWithEdges = new Set<string>();
    for (const edge of this.edges) {
      nodesWithEdges.add(edge.source);
      nodesWithEdges.add(edge.target);
    }
    
    for (const node of this.nodes) {
      if (!nodesWithEdges.has(node.id)) {
        node.issues.push('Orphaned node - no connections');
        this.issues.push(`Orphaned: ${node.label} (${node.type})`);
      }
    }
  }
  
  private generateReport() {
    console.log(chalk.bold.cyan('\n📊 FULL PRE-MINT VALIDATION REPORT\n'));
    
    const stats = {
      totalNodes: this.nodes.length,
      totalEdges: this.edges.length,
      nodesWithIssues: this.nodes.filter(n => n.issues.length > 0).length,
      orphanedNodes: this.issues.filter(i => i.includes('Orphaned')).length
    };
    
    console.log(chalk.bold('Graph Statistics:'));
    console.log(`  Nodes: ${chalk.green(stats.totalNodes)} (target: 322)`);
    console.log(`  Edges: ${chalk.green(stats.totalEdges)} (target: 808)`);
    console.log(`  Nodes with issues: ${chalk.yellow(stats.nodesWithIssues)}`);
    console.log(`  Orphaned nodes: ${chalk.yellow(stats.orphanedNodes)}`);
    
    // Node type breakdown
    const nodeTypes = new Map<string, number>();
    for (const node of this.nodes) {
      nodeTypes.set(node.type, (nodeTypes.get(node.type) || 0) + 1);
    }
    
    console.log(chalk.bold('\nNode Types:'));
    for (const [type, count] of nodeTypes.entries()) {
      console.log(`  ${type}: ${count}`);
    }
    
    // Edge type breakdown
    const edgeTypes = new Map<string, number>();
    for (const edge of this.edges) {
      edgeTypes.set(edge.label, (edgeTypes.get(edge.label) || 0) + 1);
    }
    
    console.log(chalk.bold('\nEdge Types:'));
    for (const [type, count] of edgeTypes.entries()) {
      console.log(`  ${type}: ${count}`);
    }
    
    // Critical issues
    const criticalNodes = this.nodes.filter(n => 
      n.issues.some(i => i.includes('critical') || i.includes('IPI'))
    );
    
    if (criticalNodes.length > 0) {
      console.log(chalk.red('\n❌ Critical Issues:'));
      for (const node of criticalNodes.slice(0, 10)) {
        console.log(`  ${node.label}: ${node.issues.join(', ')}`);
      }
    }
    
    // Readiness
    const readinessScore = ((stats.totalNodes - stats.nodesWithIssues) / stats.totalNodes) * 100;
    console.log(chalk.bold.cyan('\n🎯 MINTING READINESS:'));
    console.log(`  Score: ${readinessScore.toFixed(1)}%`);
    
    if (stats.totalNodes < 300 || stats.totalEdges < 700) {
      console.log(chalk.yellow('  ⚠️ Graph smaller than expected - missing data'));
    } else if (stats.orphanedNodes > 10) {
      console.log(chalk.yellow('  ⚠️ Many orphaned nodes - check relationships'));
    } else {
      console.log(chalk.green('  ✅ Ready for testnet minting'));
    }
  }
  
  private async generateHTML() {
    // Similar HTML generation as pre-mint-validation but with full data
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Full GRC-20 Pre-Mint Validation</title>
    <meta charset="utf-8">
    <script src="https://unpkg.com/cytoscape@3.29.2/dist/cytoscape.min.js"></script>
    <style>
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        #header { 
            background: #1a1a3e; 
            color: white; 
            padding: 20px;
        }
        #stats {
            display: flex;
            gap: 20px;
            margin-top: 10px;
        }
        .stat {
            padding: 10px;
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
            color: white;
        }
        #cy { 
            height: calc(100vh - 150px); 
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%);
        }
    </style>
</head>
<body>
    <div id="header">
        <h1>Full GRC-20 Pre-Mint Validation</h1>
        <div id="stats">
            <div class="stat">Nodes: ${this.nodes.length}</div>
            <div class="stat">Edges: ${this.edges.length}</div>
            <div class="stat">Issues: ${this.nodes.filter(n => n.issues.length > 0).length}</div>
        </div>
    </div>
    <div id="cy"></div>
    <script>
        const graphData = {
            nodes: ${JSON.stringify(this.nodes.map(n => ({ data: n })), null, 2)},
            edges: ${JSON.stringify(this.edges.map(e => ({ data: e })), null, 2)}
        };
        
        const cy = cytoscape({
            container: document.getElementById('cy'),
            elements: graphData,
            style: [
                {
                    selector: 'node',
                    style: {
                        'label': 'data(label)',
                        'color': '#ffffff',
                        'text-outline-width': 2,
                        'text-outline-color': '#0f0f23',
                        'font-size': '11px',
                        'background-color': ele => ele.data('issues').length > 0 ? '#f59e0b' : '#10b981',
                        'border-width': 3,
                        'border-color': ele => ele.data('issues').length > 0 ? '#d97706' : '#059669',
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'label': 'data(label)',
                        'color': '#ffffff',
                        'text-outline-width': 1,
                        'text-outline-color': '#0f0f23',
                        'curve-style': 'bezier',
                        'target-arrow-shape': 'triangle',
                        'line-color': '#888',
                        'target-arrow-color': '#888',
                        'font-size': '10px'
                    }
                }
            ],
            layout: {
                name: 'cose',
                animate: false
            }
        });
    </script>
</body>
</html>`;
    
    const outputPath = 'output/full-pre-mint-validation.html';
    fs.writeFileSync(outputPath, html);
    console.log(chalk.green(`\n✓ Visualization saved to: ${outputPath}`));
  }
}

// Run validation
if (import.meta.main) {
  const validator = new FullPreMintValidator();
  validator.validate().catch(error => {
    console.error(chalk.red('Validation error:'), error);
    process.exit(1);
  });
}

export { FullPreMintValidator };