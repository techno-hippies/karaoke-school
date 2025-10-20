#!/usr/bin/env bun

/**
 * GRC-20 MINTING VISUALIZATION SERVER
 * 
 * Interactive web interface to visualize what will be minted
 * Shows entity completeness, relationships, and issues
 */

const kuzu = require('kuzu');
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const DB_PATH = './kuzu-music.db';
const PORT = 3456;

export class GRC20Visualizer {
  private kuzuDb: any;
  private conn: any;
  
  constructor() {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('Kuzu database not found. Run sync first!');
    }
    this.kuzuDb = new kuzu.Database(DB_PATH);
    this.conn = new kuzu.Connection(this.kuzuDb);
  }
  
  async close() {
    await this.conn.close();
  }
  
  /**
   * Get minting graph data for visualization
   */
  async getMintingGraph() {
    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeMap = new Map();
    
    // Get Grimes as root node
    const grimes = await this.conn.query(`
      MATCH (a:Artist {id: '0000000356358936'})
      RETURN a.id as id, a.name as name, a.ipis as ipis, 
             a.birth_date as birth_date, a.spotify_id as spotify_id
    `);
    const grimesData = await grimes.getAll();
    
    if (grimesData.length > 0) {
      const g = grimesData[0];
      const hasIPI = g.ipis && g.ipis.length > 0;
      nodes.push({
        data: {
          id: g.id,
          label: g.name,
          type: 'artist',
          ready: hasIPI,
          ipis: g.ipis?.join(', ') || 'MISSING',
          birth_date: g.birth_date || 'unknown',
          spotify_id: g.spotify_id || 'none'
        },
        classes: hasIPI ? 'ready' : 'blocked'
      });
      nodeMap.set(g.id, true);
    }
    
    // Get all works
    const works = await this.conn.query(`
      MATCH (a:Artist {id: '0000000356358936'})<-[c:COMPOSED_BY]-(w:Work)
      RETURN w.id as id, w.title as title, w.iswcs as iswcs
    `);
    const worksData = await works.getAll();
    
    for (const w of worksData) {
      const hasISWC = w.iswcs && w.iswcs.length > 0 && w.iswcs[0] !== 'null';
      nodes.push({
        data: {
          id: w.id,
          label: w.title,
          type: 'work',
          ready: hasISWC,
          iswc: hasISWC ? w.iswcs[0] : 'MISSING'
        },
        classes: hasISWC ? 'ready' : 'blocked'
      });
      nodeMap.set(w.id, true);
      
      edges.push({
        data: {
          id: `${w.id}-grimes`,
          source: w.id,
          target: '0000000356358936',
          label: 'COMPOSED_BY',
          relationship: 'composed'
        }
      });
    }
    
    // Get recordings for each work
    for (const w of worksData) {
      const recordings = await this.conn.query(`
        MATCH (w:Work {id: '${w.id}'})<-[:RECORDING_OF]-(r:Recording)
        RETURN r.id as id, r.title as title, r.isrc as isrc, 
               r.spotify_id as spotify_id, r.duration_ms as duration
      `);
      const recordingsData = await recordings.getAll();
      
      for (const r of recordingsData) {
        if (!nodeMap.has(r.id)) {
          const hasISRC = r.isrc && r.isrc !== r.id;
          nodes.push({
            data: {
              id: r.id,
              label: r.title,
              type: 'recording',
              ready: hasISRC,
              isrc: r.isrc || 'MISSING',
              spotify_id: r.spotify_id || 'none',
              duration: r.duration ? `${Math.round(r.duration / 1000)}s` : 'unknown'
            },
            classes: hasISRC ? 'ready' : 'partial'
          });
          nodeMap.set(r.id, true);
        }
        
        edges.push({
          data: {
            id: `${r.id}-${w.id}`,
            source: r.id,
            target: w.id,
            label: 'RECORDING_OF',
            relationship: 'recording'
          }
        });
      }
      
      // Get performers for recordings
      const performers = await this.conn.query(`
        MATCH (w:Work {id: '${w.id}'})<-[:RECORDING_OF]-(r:Recording)-[:PERFORMED_BY]->(a:Artist)
        WHERE a.id <> '0000000356358936'
        RETURN DISTINCT a.id as id, a.name as name, r.id as recording_id
      `);
      const performersData = await performers.getAll();
      
      for (const p of performersData) {
        if (!nodeMap.has(p.id)) {
          nodes.push({
            data: {
              id: p.id,
              label: p.name,
              type: 'collaborator',
              ready: false
            },
            classes: 'collaborator'
          });
          nodeMap.set(p.id, true);
        }
        
        edges.push({
          data: {
            id: `${p.recording_id}-${p.id}`,
            source: p.recording_id,
            target: p.id,
            label: 'PERFORMED_BY',
            relationship: 'performed'
          }
        });
      }
      
      // Get publishers
      const publishers = await this.conn.query(`
        MATCH (w:Work {id: '${w.id}'})-[p:PUBLISHED_BY]->(pub:Publisher)
        RETURN pub.id as id, pub.name as name, p.share as share
      `);
      const publishersData = await publishers.getAll();
      
      for (const p of publishersData) {
        if (!nodeMap.has(p.id)) {
          nodes.push({
            data: {
              id: p.id,
              label: `${p.name} (${p.share}%)`,
              type: 'publisher',
              ready: true,
              share: p.share
            },
            classes: 'publisher'
          });
          nodeMap.set(p.id, true);
        }
        
        edges.push({
          data: {
            id: `${w.id}-${p.id}`,
            source: w.id,
            target: p.id,
            label: `PUBLISHED ${p.share}%`,
            relationship: 'published'
          }
        });
      }
    }
    
    return { nodes, edges };
  }
  
  /**
   * Generate HTML visualization
   */
  generateHTML(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>GRC-20 Minting Readiness - Grimes Music Graph</title>
    <meta charset="utf-8">
    <style>
        body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
            color: #fff;
            overflow: hidden;
        }
        
        #header {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(10px);
            padding: 20px;
            z-index: 1000;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        
        h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
            background: linear-gradient(90deg, #ff00ff, #00ffff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .subtitle {
            color: #aaa;
            font-size: 14px;
            margin-top: 5px;
        }
        
        #cy {
            position: absolute;
            top: 80px;
            left: 0;
            right: 350px;
            bottom: 0;
            background: radial-gradient(circle at center, #2a2a3e 0%, #1a1a2e 100%);
        }
        
        #sidebar {
            position: absolute;
            top: 80px;
            right: 0;
            width: 350px;
            bottom: 0;
            background: rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            border-left: 1px solid rgba(255,255,255,0.1);
            padding: 20px;
            overflow-y: auto;
        }
        
        .legend {
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .legend h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #888;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            margin: 8px 0;
            font-size: 13px;
        }
        
        .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            margin-right: 10px;
            border: 2px solid rgba(255,255,255,0.2);
        }
        
        .stats {
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .stat-item {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            font-size: 14px;
        }
        
        .stat-value {
            font-weight: bold;
            color: #00ffff;
        }
        
        #details {
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            padding: 15px;
            min-height: 200px;
        }
        
        #details h3 {
            margin: 0 0 10px 0;
            font-size: 16px;
            color: #fff;
        }
        
        .detail-item {
            margin: 8px 0;
            font-size: 13px;
            color: #aaa;
        }
        
        .detail-item strong {
            color: #fff;
        }
        
        .ready-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            margin-left: 10px;
        }
        
        .ready-badge.ready {
            background: #00ff00;
            color: #000;
        }
        
        .ready-badge.blocked {
            background: #ff0000;
            color: #fff;
        }
        
        .ready-badge.partial {
            background: #ffaa00;
            color: #000;
        }
        
        .controls {
            position: absolute;
            bottom: 20px;
            left: 20px;
            z-index: 1000;
        }
        
        button {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.3);
            color: #fff;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            margin-right: 10px;
            font-size: 13px;
            transition: all 0.3s;
        }
        
        button:hover {
            background: rgba(255,255,255,0.2);
            border-color: #00ffff;
        }
        
        .loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 18px;
            color: #00ffff;
        }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js"></script>
</head>
<body>
    <div id="header">
        <h1>🚀 GRC-20 Minting Readiness</h1>
        <div class="subtitle">Grimes Music Graph - Blockchain Deployment Validation</div>
    </div>
    
    <div id="cy">
        <div class="loading">Loading graph data...</div>
    </div>
    
    <div id="sidebar">
        <div class="legend">
            <h3>Legend</h3>
            <div class="legend-item">
                <div class="legend-color" style="background: #00ff00;"></div>
                <span>Ready to Mint</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #ff0000;"></div>
                <span>Blocked (Missing Data)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #ffaa00;"></div>
                <span>Partial Data</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #ff00ff;"></div>
                <span>Artist</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #00ffff;"></div>
                <span>Work/Composition</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #ffff00;"></div>
                <span>Recording</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #00ff00;"></div>
                <span>Publisher</span>
            </div>
        </div>
        
        <div class="stats">
            <h3>Statistics</h3>
            <div class="stat-item">
                <span>Total Entities:</span>
                <span class="stat-value" id="total-entities">0</span>
            </div>
            <div class="stat-item">
                <span>Ready to Mint:</span>
                <span class="stat-value" id="ready-count">0</span>
            </div>
            <div class="stat-item">
                <span>Blocked:</span>
                <span class="stat-value" id="blocked-count">0</span>
            </div>
            <div class="stat-item">
                <span>Relationships:</span>
                <span class="stat-value" id="edge-count">0</span>
            </div>
        </div>
        
        <div id="details">
            <h3>Entity Details</h3>
            <div style="color: #888; font-size: 13px;">Click on a node to see details</div>
        </div>
    </div>
    
    <div class="controls">
        <button onclick="cy.fit()">Fit to Screen</button>
        <button onclick="toggleLayout()">Change Layout</button>
        <button onclick="filterReady()">Show Only Ready</button>
        <button onclick="showAll()">Show All</button>
    </div>
    
    <script>
        let cy;
        let currentLayout = 'breadthfirst';
        let allElements;
        
        async function loadGraph() {
            const response = await fetch('/api/minting-graph');
            const data = await response.json();
            
            document.getElementById('total-entities').textContent = data.nodes.length;
            document.getElementById('edge-count').textContent = data.edges.length;
            
            const readyCount = data.nodes.filter(n => n.data.ready).length;
            const blockedCount = data.nodes.filter(n => !n.data.ready).length;
            
            document.getElementById('ready-count').textContent = readyCount;
            document.getElementById('blocked-count').textContent = blockedCount;
            
            allElements = { nodes: data.nodes, edges: data.edges };
            
            cy = cytoscape({
                container: document.getElementById('cy'),
                elements: data,
                style: [
                    {
                        selector: 'node',
                        style: {
                            'label': 'data(label)',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'font-size': '12px',
                            'color': '#fff',
                            'text-outline-color': '#000',
                            'text-outline-width': 2,
                            'border-width': 2,
                            'border-color': '#fff'
                        }
                    },
                    {
                        selector: 'node[type="artist"]',
                        style: {
                            'background-color': '#ff00ff',
                            'shape': 'star',
                            'width': 50,
                            'height': 50
                        }
                    },
                    {
                        selector: 'node[type="work"]',
                        style: {
                            'background-color': '#00ffff',
                            'shape': 'diamond',
                            'width': 40,
                            'height': 40
                        }
                    },
                    {
                        selector: 'node[type="recording"]',
                        style: {
                            'background-color': '#ffff00',
                            'shape': 'ellipse',
                            'width': 35,
                            'height': 35
                        }
                    },
                    {
                        selector: 'node[type="publisher"]',
                        style: {
                            'background-color': '#00ff00',
                            'shape': 'hexagon',
                            'width': 35,
                            'height': 35
                        }
                    },
                    {
                        selector: 'node[type="collaborator"]',
                        style: {
                            'background-color': '#ff00aa',
                            'shape': 'triangle',
                            'width': 30,
                            'height': 30
                        }
                    },
                    {
                        selector: 'node.ready',
                        style: {
                            'border-color': '#00ff00',
                            'border-width': 3
                        }
                    },
                    {
                        selector: 'node.blocked',
                        style: {
                            'border-color': '#ff0000',
                            'border-width': 3,
                            'border-style': 'dashed'
                        }
                    },
                    {
                        selector: 'node.partial',
                        style: {
                            'border-color': '#ffaa00',
                            'border-width': 3
                        }
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 2,
                            'line-color': '#666',
                            'target-arrow-color': '#666',
                            'target-arrow-shape': 'triangle',
                            'curve-style': 'bezier',
                            'label': 'data(label)',
                            'font-size': '10px',
                            'color': '#aaa',
                            'text-rotation': 'autorotate'
                        }
                    },
                    {
                        selector: 'edge[relationship="composed"]',
                        style: {
                            'line-color': '#ff00ff',
                            'target-arrow-color': '#ff00ff'
                        }
                    },
                    {
                        selector: 'edge[relationship="recording"]',
                        style: {
                            'line-color': '#00ffff',
                            'target-arrow-color': '#00ffff'
                        }
                    },
                    {
                        selector: 'edge[relationship="performed"]',
                        style: {
                            'line-color': '#ffff00',
                            'target-arrow-color': '#ffff00'
                        }
                    },
                    {
                        selector: 'edge[relationship="published"]',
                        style: {
                            'line-color': '#00ff00',
                            'target-arrow-color': '#00ff00'
                        }
                    },
                    {
                        selector: 'node:selected',
                        style: {
                            'border-width': 5,
                            'border-color': '#fff'
                        }
                    }
                ],
                layout: {
                    name: 'concentric',
                    concentric: function(node) {
                        return node.data('type') === 'artist' ? 2 : 1;
                    },
                    levelWidth: function(nodes) {
                        return 1;
                    },
                    minNodeSpacing: 50,
                    animate: true
                }
            });
            
            cy.on('tap', 'node', function(evt) {
                const node = evt.target;
                const data = node.data();
                
                let details = '<h3>' + data.label + '</h3>';
                details += '<span class="ready-badge ' + (data.ready ? 'ready' : 'blocked') + '">';
                details += data.ready ? 'READY TO MINT' : 'BLOCKED';
                details += '</span>';
                
                details += '<div class="detail-item"><strong>Type:</strong> ' + data.type + '</div>';
                details += '<div class="detail-item"><strong>ID:</strong> ' + data.id + '</div>';
                
                if (data.type === 'artist') {
                    details += '<div class="detail-item"><strong>IPIs:</strong> ' + (data.ipis || 'MISSING') + '</div>';
                    details += '<div class="detail-item"><strong>Birth Date:</strong> ' + data.birth_date + '</div>';
                    details += '<div class="detail-item"><strong>Spotify ID:</strong> ' + data.spotify_id + '</div>';
                } else if (data.type === 'work') {
                    details += '<div class="detail-item"><strong>ISWC:</strong> ' + data.iswc + '</div>';
                } else if (data.type === 'recording') {
                    details += '<div class="detail-item"><strong>ISRC:</strong> ' + data.isrc + '</div>';
                    details += '<div class="detail-item"><strong>Duration:</strong> ' + data.duration + '</div>';
                    details += '<div class="detail-item"><strong>Spotify ID:</strong> ' + data.spotify_id + '</div>';
                } else if (data.type === 'publisher') {
                    details += '<div class="detail-item"><strong>Share:</strong> ' + data.share + '%</div>';
                }
                
                const edges = node.connectedEdges();
                details += '<div class="detail-item"><strong>Connections:</strong> ' + edges.length + '</div>';
                
                document.getElementById('details').innerHTML = details;
            });
        }
        
        function toggleLayout() {
            currentLayout = currentLayout === 'breadthfirst' ? 'cose' : 'breadthfirst';
            cy.layout({
                name: currentLayout,
                animate: true,
                animationDuration: 1000
            }).run();
        }
        
        function filterReady() {
            cy.elements().hide();
            cy.nodes('[ready="true"]').show();
            cy.nodes('[ready="true"]').connectedEdges().show();
        }
        
        function showAll() {
            cy.elements().show();
        }
        
        loadGraph();
    </script>
</body>
</html>`;
  }
  
  /**
   * Start web server
   */
  async startServer() {
    const html = this.generateHTML();
    
    Bun.serve({
      port: PORT,
      fetch: async (req) => {
        const url = new URL(req.url);
        
        if (url.pathname === '/') {
          return new Response(html, {
            headers: { 'Content-Type': 'text/html' }
          });
        }
        
        if (url.pathname === '/api/minting-graph') {
          const graphData = await this.getMintingGraph();
          return new Response(JSON.stringify(graphData), {
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        return new Response('Not Found', { status: 404 });
      }
    });
    
    console.log(chalk.bold.green(`\n🌐 GRC-20 Minting Visualization Server Started!`));
    console.log(chalk.cyan(`\n   Open in browser: http://localhost:${PORT}`));
    console.log(chalk.gray(`   Press Ctrl+C to stop\n`));
  }
}

// CLI interface
async function main() {
  console.log(chalk.bold.magenta(`
╔════════════════════════════════════════╗
║   GRC-20 MINTING VISUALIZATION         ║
║   Interactive Blockchain Readiness     ║
╚════════════════════════════════════════╝
  `));
  
  const visualizer = new GRC20Visualizer();
  
  try {
    await visualizer.startServer();
    
    // Keep server running
    await new Promise(() => {});
    
  } catch (error) {
    console.error(chalk.red('Visualization failed:'), error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export default GRC20Visualizer;