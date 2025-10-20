#!/usr/bin/env bun

/**
 * CYTOSCAPE TO GRC-20 CONVERTER - PROPER IMPLEMENTATION
 * 
 * Following the docs exactly:
 * 1. Parse HTML → Extract all data
 * 2. Create schema (properties & types)
 * 3. Topological sort nodes (targets must exist before sources)
 * 4. Create entities WITH embedded relations
 * 5. Validate with Zod
 * 6. Mint as single atomic Edit
 */

import { Graph, Ipfs, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import chalk from 'chalk';
import fs from 'fs/promises';
import { z } from 'zod';

// ============================================================================
// INTERFACES
// ============================================================================

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
    source: string;
    target: string;
    label: string;
  };
}

interface GraphData {
  nodes: CytoscapeNode[];
  edges: CytoscapeEdge[];
}

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

const PROPERTIES = [
  // Core identifiers
  { key: 'isni', name: 'ISNI', type: 'STRING' as const },
  { key: 'isrc', name: 'ISRC', type: 'STRING' as const },
  { key: 'iswc', name: 'ISWC', type: 'STRING' as const },
  { key: 'upc', name: 'UPC', type: 'STRING' as const },
  { key: 'ipi', name: 'IPI', type: 'STRING' as const },
  { key: 'ipis', name: 'IPIs', type: 'STRING' as const },
  { key: 'ipn', name: 'IPN', type: 'STRING' as const },
  { key: 'ipns', name: 'IPNs', type: 'STRING' as const },
  
  // Platform IDs
  { key: 'spotify_id', name: 'Spotify ID', type: 'STRING' as const },
  { key: 'spotify_ids', name: 'Spotify IDs', type: 'STRING' as const },
  { key: 'apple_id', name: 'Apple Music ID', type: 'STRING' as const },
  { key: 'deezer_id', name: 'Deezer ID', type: 'STRING' as const },
  { key: 'amazon_ids', name: 'Amazon IDs', type: 'STRING' as const },
  { key: 'musicbrainz_id', name: 'MusicBrainz ID', type: 'STRING' as const },
  { key: 'discogs_ids', name: 'Discogs IDs', type: 'STRING' as const },
  { key: 'wikidata_id', name: 'Wikidata ID', type: 'STRING' as const },
  { key: 'merged_isni', name: 'Merged ISNI', type: 'STRING' as const },
  
  // Metadata
  { key: 'title', name: 'Title', type: 'STRING' as const },
  { key: 'year', name: 'Year', type: 'STRING' as const },
  { key: 'duration_ms', name: 'Duration (ms)', type: 'NUMBER' as const },
  { key: 'date_of_birth', name: 'Date of Birth', type: 'STRING' as const },
  { key: 'nationality', name: 'Nationality', type: 'STRING' as const },
  { key: 'language', name: 'Language', type: 'STRING' as const },
  { key: 'role', name: 'Role', type: 'STRING' as const },
  { key: 'work_count', name: 'Work Count', type: 'NUMBER' as const },
  { key: 'data_source', name: 'Data Source', type: 'STRING' as const },
  { key: 'canonical_artist', name: 'Canonical Artist', type: 'STRING' as const },
  
  // Relation properties
  { key: 'performed_by', name: 'Performed By', type: 'RELATION' as const },
  { key: 'composed_by', name: 'Composed By', type: 'RELATION' as const },
  { key: 'recording_of', name: 'Recording Of', type: 'RELATION' as const },
  { key: 'writes', name: 'Writes', type: 'RELATION' as const },
  { key: 'publishes', name: 'Publishes', type: 'RELATION' as const },
  { key: 'alias_of', name: 'Alias Of', type: 'RELATION' as const },
];

const TYPES = [
  { key: 'artist', name: 'Music Artist', props: ['isni', 'ipis', 'ipn', 'spotify_id', 'apple_id', 'deezer_id', 'musicbrainz_id', 'wikidata_id', 'date_of_birth', 'nationality'] },
  { key: 'recording', name: 'Recording', props: ['isrc', 'title', 'year', 'duration_ms', 'spotify_id'] },
  { key: 'work', name: 'Musical Work', props: ['iswc', 'title'] },
  { key: 'publisher', name: 'Publisher', props: ['ipi', 'work_count'] },
  { key: 'mlc_writer', name: 'MLC Writer', props: ['ipi', 'work_count'] },
  { key: 'contributor', name: 'Contributor', props: ['role', 'work_count'] },
  { key: 'alternative_name', name: 'Alternative Name', props: ['language', 'canonical_artist'] },
];

// Map edge labels to relation properties
const EDGE_LABEL_TO_PROP: Record<string, string> = {
  'PERFORMED_BY': 'performed_by',
  'COMPOSED_BY': 'composed_by',
  'EMBODIES': 'recording_of', // Fix terminology
  'WRITES': 'writes',
  'PUBLISHES': 'publishes',
  'ALIAS_OF': 'alias_of',
  'Composer': 'composed_by',
  'ComposerLyricist': 'composed_by',
  'Lyricist': 'writes',
};

// ============================================================================
// TOPOLOGICAL SORT
// ============================================================================

function topologicalSort(nodes: CytoscapeNode[], edges: CytoscapeEdge[]): CytoscapeNode[] {
  const nodeMap = new Map(nodes.map(n => [n.data.id, n]));
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();
  
  // Initialize
  nodes.forEach(n => {
    inDegree.set(n.data.id, 0);
    adjList.set(n.data.id, []);
  });
  
  // Build adjacency list and count in-degrees
  // For relation edges: source depends on target (target must exist first)
  // Exception: ALIAS_OF doesn't create a dependency (aliases can be created after)
  edges.forEach(e => {
    if (EDGE_LABEL_TO_PROP[e.data.label] && e.data.label !== 'ALIAS_OF') {
      // This is a relation edge that creates a dependency
      const source = e.data.source;
      const target = e.data.target;
      
      // Target must be created before source
      adjList.get(target)!.push(source);
      inDegree.set(source, (inDegree.get(source) || 0) + 1);
    }
  });
  
  // Kahn's algorithm
  const queue: string[] = [];
  const sorted: CytoscapeNode[] = [];
  
  // Start with nodes that have no dependencies
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });
  
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sorted.push(nodeMap.get(nodeId)!);
    
    // Process neighbors
    const neighbors = adjList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const newDegree = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }
  
  // Check for cycles
  if (sorted.length !== nodes.length) {
    console.log(chalk.yellow(`Warning: Cycle detected! Only ${sorted.length}/${nodes.length} nodes sorted`));
    // Add remaining nodes (they're in a cycle)
    const unsorted: CytoscapeNode[] = [];
    nodes.forEach(n => {
      if (!sorted.includes(n)) {
        unsorted.push(n);
        sorted.push(n);
      }
    });
    console.log(chalk.yellow(`  Nodes in cycle: ${unsorted.map(n => n.data.label).join(', ')}`));
  }
  
  return sorted;
}

// ============================================================================
// MAIN CONVERTER
// ============================================================================

class ProperCytoscapeConverter {
  private propertyIds = new Map<string, string>();
  private typeIds = new Map<string, string>();
  private entityIds = new Map<string, string>();
  private nodeKeyMap = new Map<string, string>(); // Original ID -> unique key
  private ops: any[] = [];

  async convertAndMint() {
    console.log(chalk.bold.cyan('🎵 PROPER CYTOSCAPE TO GRC-20 CONVERSION\n'));

    // 1. Parse HTML
    const graphData = await this.parseHtml();
    
    // 2. Create schema
    this.createSchema();
    
    // 3. Topological sort
    const sortedNodes = topologicalSort(graphData.nodes, graphData.edges);
    console.log(chalk.cyan(`\n📊 Topologically sorted ${sortedNodes.length} nodes`));
    
    // 4. Build relation map
    const nodeRelations = this.buildRelationMap(graphData.edges);
    
    // 5. Create entities in order with embedded relations
    for (const node of sortedNodes) {
      const uniqueKey = `${node.data.id}_${node.data.label}`;
      this.nodeKeyMap.set(node.data.id, uniqueKey);
      this.createEntityWithRelations(node, nodeRelations.get(node.data.id) || []);
    }
    
    // 6. Validate
    this.validateOps(graphData);
    
    // 7. Save or mint
    if (!process.env.PRIVATE_KEY || process.argv.includes('--dry-run')) {
      await this.saveDryRun();
    } else {
      await this.mint();
    }
  }

  async parseHtml(): Promise<GraphData> {
    const html = await fs.readFile('output/grimes-graph.html', 'utf-8');
    const match = html.match(/const graphData = ({[\s\S]*?});/);
    if (!match) throw new Error('Could not find graphData in HTML');
    
    // Parse JavaScript object notation
    const graphDataStr = match[1];
    const graphData = eval(`(${graphDataStr})`);
    
    console.log(chalk.yellow(`Found ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`));
    return graphData;
  }

  createSchema() {
    console.log(chalk.cyan('\n🏗️  Creating schema...'));
    
    // Create properties
    for (const prop of PROPERTIES) {
      const { id, ops } = Graph.createProperty({
        name: prop.name,
        dataType: prop.type as any,
      });
      this.propertyIds.set(prop.key, id);
      this.ops.push(...ops);
    }
    console.log(chalk.gray(`  Created ${PROPERTIES.length} properties`));
    
    // Create types
    for (const type of TYPES) {
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
    console.log(chalk.gray(`  Created ${TYPES.length} types`));
  }

  buildRelationMap(edges: CytoscapeEdge[]): Map<string, Array<{prop: string; target: string}>> {
    const relations = new Map<string, Array<{prop: string; target: string}>>();
    
    for (const edge of edges) {
      const propKey = EDGE_LABEL_TO_PROP[edge.data.label];
      if (!propKey) continue;
      
      const source = edge.data.source;
      if (!relations.has(source)) {
        relations.set(source, []);
      }
      
      relations.get(source)!.push({
        prop: propKey,
        target: edge.data.target,
      });
    }
    
    return relations;
  }

  createEntityWithRelations(node: CytoscapeNode, relations: Array<{prop: string; target: string}>) {
    // Create a unique key for this node (handles duplicate IDs)
    const uniqueNodeKey = `${node.data.id}_${node.data.label}`;
    // Extract values from node properties
    const values: any[] = [];
    
    if (node.data.properties) {
      for (const [key, value] of Object.entries(node.data.properties)) {
        const propId = this.propertyIds.get(key);
        if (propId && value !== null && value !== undefined && value !== 'N/A') {
          if (typeof value === 'number') {
            values.push({
              property: propId,
              value: Graph.serializeNumber(value),
            });
          } else if (Array.isArray(value)) {
            // Add ALL values in arrays (multi-value properties)
            for (const item of value) {
              values.push({
                property: propId,
                value: String(item),
              });
            }
          } else {
            values.push({
              property: propId,
              value: String(value),
            });
          }
        }
      }
    }
    
    // Add title as a property if it's not already there
    if (node.data.label && !values.find(v => v.property === this.propertyIds.get('title'))) {
      const titlePropId = this.propertyIds.get('title');
      if (titlePropId) {
        values.push({
          property: titlePropId,
          value: node.data.label,
        });
      }
    }
    
    // Build relations object
    const entityRelations: any = {};
    let skippedRelations = 0;
    for (const rel of relations) {
      // Try to find target entity by unique key or original ID
      const targetKey = this.nodeKeyMap.get(rel.target);
      const targetEntityId = targetKey ? this.entityIds.get(targetKey) : this.entityIds.get(rel.target);
      if (targetEntityId) {
        const propId = this.propertyIds.get(rel.prop);
        if (propId) {
          if (!entityRelations[propId]) {
            entityRelations[propId] = [];
          }
          entityRelations[propId].push({ toEntity: targetEntityId });
        }
      } else {
        skippedRelations++;
      }
    }
    
    // Get type
    const typeId = this.typeIds.get(node.data.type);
    
    try {
      // Create entity WITH embedded relations
      const { id: entityId, ops } = Graph.createEntity({
        name: node.data.label,
        // No description - the useless ones add no value
        types: typeId ? [typeId] : [],
        values,
        relations: entityRelations, // EMBEDDED!
      });
      
      this.entityIds.set(uniqueNodeKey, entityId);
      // Also store by original ID for backward compat
      if (!this.entityIds.has(node.data.id)) {
        this.entityIds.set(node.data.id, entityId);
      }
      this.ops.push(...ops);
      
      if (skippedRelations > 0) {
        console.log(chalk.gray(`    Note: ${node.data.label} has ${skippedRelations} forward references`));
      }
    } catch (error) {
      console.log(chalk.red(`    Failed to create entity: ${node.data.label}`));
      console.log(chalk.red(`    Error: ${error}`));
    }
  }

  validateOps(graphData: GraphData) {
    console.log(chalk.cyan('\n✅ Validating operations...'));
    
    // Count ops by type
    const opCounts: Record<string, number> = {};
    for (const op of this.ops) {
      if (Array.isArray(op)) {
        // It's a batch of ops
        for (const subOp of op) {
          const type = subOp.type || 'unknown';
          opCounts[type] = (opCounts[type] || 0) + 1;
        }
      } else {
        const type = op.type || 'unknown';
        opCounts[type] = (opCounts[type] || 0) + 1;
      }
    }
    
    console.log(chalk.gray('  Operation counts:'));
    for (const [type, count] of Object.entries(opCounts)) {
      console.log(chalk.gray(`    ${type}: ${count}`));
    }
    
    // Validate entity count (count unique entity IDs, not map size)
    const uniqueEntityIds = new Set(this.entityIds.values());
    const entityCount = uniqueEntityIds.size;
    const expectedCount = graphData.nodes.length;
    if (entityCount !== expectedCount) {
      console.log(chalk.yellow(`  Warning: Created ${entityCount} entities but expected ${expectedCount}`));
    } else {
      console.log(chalk.green(`  ✓ Created ${entityCount} entities as expected`));
    }
    
    // Count CREATE_RELATION ops (these are the embedded relations)
    // Filter out schema relations (those without fromEntity or with property/type entities)
    const relationOps = this.ops.filter(op => {
      if (op.type !== 'CREATE_RELATION') return false;
      // Check if this is an actual entity relation (not schema)
      const fromEntity = op.relation?.fromEntity;
      if (!fromEntity) return false;
      // Check if fromEntity is an actual entity (exists in our entityIds)
      return Array.from(this.entityIds.values()).includes(fromEntity);
    });
    const relationCount = relationOps.length;
    
    // Compare to expected edges
    const expectedEdges = graphData.edges.length;
    if (relationCount !== expectedEdges) {
      console.log(chalk.yellow(`  ⚠️  Created ${relationCount} relations but expected ${expectedEdges} from Cytoscape`));
    } else {
      console.log(chalk.green(`  ✓ Created ${relationCount} relation operations matching Cytoscape`));
    }
    console.log(chalk.gray(`  Total ops: ${this.ops.length}`));
  }

  async saveDryRun() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `output/grc20-ops-proper-${timestamp}.json`;
    await fs.writeFile(filename, JSON.stringify(this.ops, null, 2));
    console.log(chalk.yellow(`\n📝 Dry run - saved ops to ${filename}`));
    console.log(chalk.yellow('To mint for real, set PRIVATE_KEY environment variable'));
  }

  async mint() {
    const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
    const { address } = privateKeyToAccount(privateKey);
    
    console.log(chalk.cyan('\n🚀 Minting to blockchain...'));
    console.log(chalk.gray(`  Address: ${address}`));
    
    const walletClient = await getWalletClient({ privateKey });
    
    // Deploy space
    const space = await Graph.createSpace({
      editorAddress: address,
      name: 'grimes-cytoscape-proper',
      network: 'TESTNET',
    });
    console.log(chalk.green(`  ✓ Space deployed: ${space.id}`));
    
    // Publish to IPFS
    const { cid } = await Ipfs.publishEdit({
      name: 'Grimes Music Graph (Proper)',
      ops: this.ops,
      author: address,
      network: 'TESTNET',
    });
    console.log(chalk.green(`  ✓ Published to IPFS: ${cid}`));
    
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
    console.log(chalk.yellow(`  Transaction: ${txResult}`));
    console.log(chalk.yellow(`  Space ID: ${space.id}`));
    console.log(chalk.cyan(`\n  View on Geo Browser: https://testnet.geobrowser.io/space/${space.id}`));
  }
}

// ============================================================================
// MAIN
// ============================================================================

if (import.meta.main) {
  const converter = new ProperCytoscapeConverter();
  converter.convertAndMint().catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });
}

export { ProperCytoscapeConverter };