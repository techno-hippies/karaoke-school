#!/usr/bin/env bun

/**
 * INTERACTIVE GRAPH VISUALIZATION GENERATOR
 * 
 * Creates an interactive HTML visualization of the music data graph
 * using Cytoscape.js for better exploration and analysis
 * 
 * Usage: bun run generate-graph-viz.ts
 */

import chalk from 'chalk';
import { db, initDb } from './src/db/postgres';
import { sql } from 'drizzle-orm';
import fs from 'fs/promises';

interface CytoscapeNode {
  data: {
    id: string;
    label: string;
    type: string;
    properties?: Record<string, any>;
  };
}

interface CytoscapeEdge {
  data: {
    id: string;
    source: string;
    target: string;
    label: string;
    properties?: Record<string, any>;
  };
}

async function generateCytoscapeData() {
  await initDb();
  
  const nodes: CytoscapeNode[] = [];
  const edges: CytoscapeEdge[] = [];
  
  console.log(chalk.cyan('Generating graph data...'));
  
  // Add Artist node (central)
  nodes.push({
    data: {
      id: 'artist_0000000356358936',
      label: 'Grimes',
      type: 'artist',
      properties: {
        isni: '0000000356358936',
        ipi: '00633996999'
      }
    }
  });
  
  // Add Recording nodes (limited for performance)
  const recordings = await db.execute(sql`
    SELECT 
      r.*,
      s.spotify_id,
      s.popularity,
      COUNT(DISTINCT rw.work_iswc) as work_count
    FROM quansic_recordings r
    LEFT JOIN spotify_tracks s ON r.id = s.isrc
    LEFT JOIN quansic_recording_works rw ON r.id = rw.recording_isrc
    GROUP BY r.id, r.artist_id, r.isrc, r.title, r.duration_ms, r.year, 
             r.spotify_id, r.apple_id, r.deezer_id, r.created_at, 
             s.spotify_id, s.popularity
    ORDER BY s.popularity DESC NULLS LAST
    LIMIT 50
  `);
  
  for (const rec of recordings.rows) {
    nodes.push({
      data: {
        id: `rec_${rec.id}`,
        label: rec.title?.substring(0, 30) || rec.id,
        type: 'recording',
        properties: {
          isrc: rec.id,
          year: rec.year,
          popularity: rec.popularity || 0,
          hasSpotify: !!rec.spotify_id,
          workCount: rec.work_count
        }
      }
    });
    
    // Add edge to artist
    edges.push({
      data: {
        id: `edge_rec_${rec.id}_artist`,
        source: `rec_${rec.id}`,
        target: 'artist_0000000356358936',
        label: 'PERFORMED_BY'
      }
    });
  }
  
  // Add Work nodes
  const works = await db.execute(sql`
    SELECT 
      w.*,
      COUNT(DISTINCT rw.recording_isrc) as recording_count,
      COUNT(DISTINCT wc.id) as contributor_count
    FROM quansic_works w
    LEFT JOIN quansic_recording_works rw ON w.id = rw.work_iswc
    LEFT JOIN quansic_work_contributors wc ON w.id = wc.work_iswc
    WHERE w.id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM quansic_recording_works rw2 
      WHERE rw2.work_iswc = w.id 
      AND rw2.recording_isrc IN (
        SELECT id FROM quansic_recordings ORDER BY id LIMIT 50
      )
    )
    GROUP BY w.id, w.artist_id, w.title, w.role, w.q1_score, w.created_at
  `);
  
  for (const work of works.rows) {
    nodes.push({
      data: {
        id: `work_${work.id}`,
        label: work.title?.substring(0, 30) || work.id,
        type: 'work',
        properties: {
          iswc: work.id,
          recordingCount: work.recording_count,
          contributorCount: work.contributor_count,
          q1Score: work.q1_score
        }
      }
    });
    
    // Add edge to artist
    edges.push({
      data: {
        id: `edge_work_${work.id}_artist`,
        source: `work_${work.id}`,
        target: 'artist_0000000356358936',
        label: 'COMPOSED_BY'
      }
    });
  }
  
  // Add Recording-Work relationships
  const recordingWorks = await db.execute(sql`
    SELECT * FROM quansic_recording_works 
    WHERE recording_isrc IN (
      SELECT id FROM quansic_recordings ORDER BY id LIMIT 50
    )
  `);
  
  for (const rw of recordingWorks.rows) {
    edges.push({
      data: {
        id: `edge_rw_${rw.recording_isrc}_${rw.work_iswc}`,
        source: `rec_${rw.recording_isrc}`,
        target: `work_${rw.work_iswc}`,
        label: 'EMBODIES',
        properties: {
          q1Score: rw.q1_score,
          q2Score: rw.q2_score
        }
      }
    });
  }
  
  // Add some key contributors
  const contributors = await db.execute(sql`
    SELECT DISTINCT 
      contributor_name,
      contributor_role,
      COUNT(DISTINCT work_iswc) as work_count
    FROM quansic_work_contributors
    WHERE work_iswc IN (
      SELECT DISTINCT work_iswc FROM quansic_recording_works 
      WHERE recording_isrc IN (
        SELECT id FROM quansic_recordings ORDER BY id LIMIT 50
      )
    )
    GROUP BY contributor_name, contributor_role
    ORDER BY work_count DESC
    LIMIT 20
  `);
  
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
  }
  
  return { nodes, edges };
}

async function generateHTML(nodes: CytoscapeNode[], edges: CytoscapeEdge[]) {
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Grimes Music Graph Visualization</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://unpkg.com/cytoscape@3.29.2/dist/cytoscape.min.js"></script>
    <script src="https://unpkg.com/layout-base/layout-base.js"></script>
    <script src="https://unpkg.com/cose-base/cose-base.js"></script>
    <script src="https://unpkg.com/cytoscape-fcose/cytoscape-fcose.js"></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            background: #0f0f0f;
            color: #fff;
        }
        
        #header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        
        #header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        
        #controls {
            background: #1a1a1a;
            padding: 15px;
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            align-items: center;
            border-bottom: 1px solid #333;
        }
        
        button {
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s;
        }
        
        button:hover {
            background: #5a67d8;
            transform: translateY(-1px);
        }
        
        select {
            background: #2a2a2a;
            color: white;
            border: 1px solid #444;
            padding: 8px;
            border-radius: 4px;
            font-size: 14px;
        }
        
        #cy {
            width: 100%;
            height: calc(100vh - 140px);
            background: #0f0f0f;
        }
        
        #info {
            position: fixed;
            top: 140px;
            right: 20px;
            background: rgba(26, 26, 26, 0.95);
            padding: 15px;
            border-radius: 8px;
            max-width: 300px;
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #333;
            display: none;
            backdrop-filter: blur(10px);
        }
        
        #info h3 {
            margin-top: 0;
            color: #667eea;
        }
        
        #info p {
            margin: 5px 0;
            font-size: 14px;
            color: #ccc;
        }
        
        #info .property {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            border-bottom: 1px solid #333;
        }
        
        #info .property-key {
            color: #888;
            font-size: 12px;
        }
        
        #info .property-value {
            color: #fff;
            font-weight: 500;
        }
        
        #stats {
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: rgba(26, 26, 26, 0.95);
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 14px;
            border: 1px solid #333;
            backdrop-filter: blur(10px);
        }
        
        .legend {
            position: fixed;
            top: 140px;
            left: 20px;
            background: rgba(26, 26, 26, 0.95);
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #333;
            backdrop-filter: blur(10px);
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            margin: 8px 0;
            font-size: 14px;
        }
        
        .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            margin-right: 10px;
        }
    </style>
</head>
<body>
    <div id="header">
        <h1>🎵 Grimes Music Graph Visualization</h1>
    </div>
    
    <div id="controls">
        <button onclick="resetView()">Reset View</button>
        <button onclick="toggleLayout('fcose')">Force Layout</button>
        <button onclick="toggleLayout('circle')">Circle Layout</button>
        <button onclick="toggleLayout('breadthfirst')">Tree Layout</button>
        <button onclick="filterByType('all')">Show All</button>
        <button onclick="filterByType('recording')">Recordings Only</button>
        <button onclick="filterByType('work')">Works Only</button>
        <button onclick="exportImage()">Export Image</button>
    </div>
    
    <div class="legend">
        <h4 style="margin-top: 0; color: #667eea;">Node Types</h4>
        <div class="legend-item">
            <div class="legend-color" style="background: #ff6b6b;"></div>
            <span>Artist</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: #4ecdc4;"></div>
            <span>Recording</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: #45b7d1;"></div>
            <span>Work (Composition)</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: #f9ca24;"></div>
            <span>Contributor</span>
        </div>
    </div>
    
    <div id="cy"></div>
    
    <div id="info"></div>
    
    <div id="stats">
        Nodes: ${nodes.length} | Edges: ${edges.length}
    </div>
    
    <script>
        // Graph data
        const graphData = {
            nodes: ${JSON.stringify(nodes, null, 2)},
            edges: ${JSON.stringify(edges, null, 2)}
        };
        
        // Initialize Cytoscape
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
                        'font-size': '12px',
                        'color': '#fff',
                        'text-outline-width': 2,
                        'text-outline-color': '#000',
                        'background-opacity': 0.9,
                        'border-width': 2,
                        'border-opacity': 0.8
                    }
                },
                {
                    selector: 'node[type="artist"]',
                    style: {
                        'background-color': '#ff6b6b',
                        'border-color': '#ff5252',
                        'width': 80,
                        'height': 80,
                        'font-size': '16px',
                        'font-weight': 'bold'
                    }
                },
                {
                    selector: 'node[type="recording"]',
                    style: {
                        'background-color': '#4ecdc4',
                        'border-color': '#3db5ac',
                        'width': 40,
                        'height': 40
                    }
                },
                {
                    selector: 'node[type="work"]',
                    style: {
                        'background-color': '#45b7d1',
                        'border-color': '#3498db',
                        'width': 50,
                        'height': 50
                    }
                },
                {
                    selector: 'node[type="contributor"]',
                    style: {
                        'background-color': '#f9ca24',
                        'border-color': '#f0b90b',
                        'width': 35,
                        'height': 35,
                        'shape': 'diamond'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#444',
                        'target-arrow-color': '#666',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'label': 'data(label)',
                        'font-size': '10px',
                        'color': '#888',
                        'text-rotation': 'autorotate',
                        'text-margin-y': -10
                    }
                },
                {
                    selector: 'edge[label="PERFORMED_BY"]',
                    style: {
                        'line-color': '#4ecdc4',
                        'target-arrow-color': '#4ecdc4'
                    }
                },
                {
                    selector: 'edge[label="COMPOSED_BY"]',
                    style: {
                        'line-color': '#45b7d1',
                        'target-arrow-color': '#45b7d1'
                    }
                },
                {
                    selector: 'edge[label="EMBODIES"]',
                    style: {
                        'line-color': '#9b59b6',
                        'target-arrow-color': '#9b59b6',
                        'line-style': 'dashed'
                    }
                }
            ],
            layout: {
                name: 'fcose',
                animate: true,
                randomize: true,
                nodeRepulsion: 4500,
                idealEdgeLength: 100,
                edgeElasticity: 0.45,
                nestingFactor: 0.1,
                numIter: 2500,
                tile: true
            },
            wheelSensitivity: 0.2
        });
        
        // Node click handler
        cy.on('tap', 'node', function(evt) {
            const node = evt.target;
            const data = node.data();
            const info = document.getElementById('info');
            
            let html = '<h3>' + data.label + '</h3>';
            html += '<div class="property"><span class="property-key">Type</span><span class="property-value">' + data.type + '</span></div>';
            
            if (data.properties) {
                for (const [key, value] of Object.entries(data.properties)) {
                    html += '<div class="property"><span class="property-key">' + key + '</span><span class="property-value">' + value + '</span></div>';
                }
            }
            
            info.innerHTML = html;
            info.style.display = 'block';
        });
        
        // Click on background to hide info
        cy.on('tap', function(evt) {
            if (evt.target === cy) {
                document.getElementById('info').style.display = 'none';
            }
        });
        
        // Control functions
        function resetView() {
            cy.fit();
            cy.zoom(1);
            cy.center();
        }
        
        function toggleLayout(layoutName) {
            const layoutOptions = {
                name: layoutName,
                animate: true,
                animationDuration: 1000
            };
            
            if (layoutName === 'fcose') {
                layoutOptions.nodeRepulsion = 4500;
                layoutOptions.idealEdgeLength = 100;
            }
            
            cy.layout(layoutOptions).run();
        }
        
        function filterByType(type) {
            if (type === 'all') {
                cy.elements().show();
            } else {
                cy.elements().hide();
                cy.nodes('[type="' + type + '"]').show();
                cy.nodes('[type="artist"]').show();
                cy.edges().forEach(edge => {
                    if (edge.source().visible() && edge.target().visible()) {
                        edge.show();
                    }
                });
            }
        }
        
        function exportImage() {
            const png = cy.png({ output: 'blob', bg: '#0f0f0f', scale: 2 });
            const url = URL.createObjectURL(png);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'grimes-music-graph.png';
            link.click();
        }
        
        // Initial fit
        setTimeout(() => {
            resetView();
        }, 500);
    </script>
</body>
</html>`;
  
  return html;
}

async function main() {
  console.log(chalk.bold.magenta(`
╔════════════════════════════════════════╗
║   INTERACTIVE GRAPH VISUALIZER         ║
║   Cytoscape.js Music Network           ║
╚════════════════════════════════════════╝
  `));
  
  try {
    console.log(chalk.yellow('\n📊 Fetching graph data...\n'));
    const { nodes, edges } = await generateCytoscapeData();
    
    console.log(chalk.green(`✓ Generated ${nodes.length} nodes and ${edges.length} edges`));
    
    console.log(chalk.yellow('\n📝 Creating HTML visualization...\n'));
    const html = await generateHTML(nodes, edges);
    
    await fs.writeFile('output/graph-visualization.html', html);
    
    console.log(chalk.bold.green('✅ Visualization Complete!'));
    console.log(chalk.cyan(`
Open the interactive graph:
  file://${process.cwd()}/output/graph-visualization.html
  
Features:
  - Click nodes to see properties
  - Drag to pan, scroll to zoom
  - Multiple layout algorithms
  - Filter by node type
  - Export as image
    `));
    
  } catch (error) {
    console.error(chalk.red('Visualization error:'), error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();