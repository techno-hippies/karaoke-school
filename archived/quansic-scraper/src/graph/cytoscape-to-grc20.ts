#!/usr/bin/env bun

/**
 * CYTOSCAPE TO GRC-20 CONVERTER
 * 
 * Takes the existing grimes-graph.html (322 nodes, 808 edges)
 * and converts it to GRC-20 format for minting
 */

import { Graph, Ipfs, getWalletClient, Id } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import chalk from 'chalk';
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
    source: string;
    target: string;
    label: string;
  };
}

class CytoscapeToGRC20Converter {
  private entityIdMap = new Map<string, string>(); // Cytoscape ID -> GRC-20 Entity ID
  private propertyIds = new Map<string, string>();
  private typeIds = new Map<string, string>();
  
  async convertAndMint() {
    console.log(chalk.bold.cyan('\n🎵 CONVERTING CYTOSCAPE GRAPH TO GRC-20\n'));
    
    // Read the HTML file and extract the graph data
    const html = await fs.readFile('output/grimes-graph.html', 'utf-8');
    
    // Extract the graphData JavaScript object
    const graphDataMatch = html.match(/const graphData = ({[\s\S]*?});/);
    if (!graphDataMatch) {
      throw new Error('Could not find graphData in HTML file');
    }
    
    // Parse the graph data (it's already valid JS object notation)
    const graphDataStr = graphDataMatch[1];
    const graphData = eval(`(${graphDataStr})`); // Using eval because it's JS object notation, not JSON
    
    console.log(chalk.yellow(`Found ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`));
    
    // Get wallet
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.log(chalk.red('Missing PRIVATE_KEY environment variable'));
      console.log(chalk.yellow('For dry run, continuing without wallet...'));
      return this.dryRun(graphData);
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
    
    // Create all the ops
    const allOps = await this.createGRC20Ops(graphData);
    
    // Publish to IPFS
    console.log(chalk.cyan('\nPublishing to IPFS...'));
    const { cid } = await Ipfs.publishEdit({
      name: 'Grimes Complete Music Graph Import',
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
    console.log(chalk.cyan(`\nView on Geo Browser: https://testnet.geobrowser.io/space/${space.id}`));
  }
  
  async dryRun(graphData: any) {
    console.log(chalk.yellow('\n🔍 DRY RUN - Analyzing conversion...\n'));
    
    const allOps = await this.createGRC20Ops(graphData);
    
    // Count by type
    const nodeTypes = new Map<string, number>();
    for (const node of graphData.nodes) {
      const type = node.data.type;
      nodeTypes.set(type, (nodeTypes.get(type) || 0) + 1);
    }
    
    const edgeTypes = new Map<string, number>();
    for (const edge of graphData.edges) {
      const label = edge.data.label;
      edgeTypes.set(label, (edgeTypes.get(label) || 0) + 1);
    }
    
    console.log(chalk.bold('Node Types:'));
    for (const [type, count] of nodeTypes.entries()) {
      console.log(`  ${type}: ${count}`);
    }
    
    console.log(chalk.bold('\nEdge Types:'));
    for (const [type, count] of edgeTypes.entries()) {
      console.log(`  ${type}: ${count}`);
    }
    
    console.log(chalk.bold('\nConversion Summary:'));
    console.log(`  Total ops to be created: ${allOps.length}`);
    console.log(`  Entities: ${this.entityIdMap.size}`);
    console.log(`  Properties: ${this.propertyIds.size}`);
    console.log(`  Types: ${this.typeIds.size}`);
    
    // Save ops to file for inspection
    await fs.writeFile(
      'output/grc20-ops.json',
      JSON.stringify(allOps, null, 2)
    );
    console.log(chalk.green('\n✓ Ops saved to output/grc20-ops.json for inspection'));
    
    console.log(chalk.yellow('\nTo mint for real, set PRIVATE_KEY environment variable and run again'));
  }
  
  async createGRC20Ops(graphData: any): Promise<any[]> {
    const ops: any[] = [];
    
    // Step 1: Create property types
    console.log(chalk.cyan('Creating property types...'));
    const properties = [
      // Core identifiers
      { key: 'isni', name: 'ISNI', type: 'STRING' },
      { key: 'isrc', name: 'ISRC', type: 'STRING' },
      { key: 'iswc', name: 'ISWC', type: 'STRING' },
      { key: 'ipi', name: 'IPI', type: 'STRING' },
      { key: 'ipis', name: 'IPIs', type: 'STRING' },
      { key: 'ipn', name: 'IPN', type: 'STRING' },
      { key: 'ipns', name: 'IPNs', type: 'STRING' },
      { key: 'upc', name: 'UPC', type: 'STRING' },
      
      // Platform IDs
      { key: 'spotify_id', name: 'Spotify ID', type: 'STRING' },
      { key: 'apple_id', name: 'Apple Music ID', type: 'STRING' },
      { key: 'deezer_id', name: 'Deezer ID', type: 'STRING' },
      { key: 'amazon_ids', name: 'Amazon IDs', type: 'STRING' },
      { key: 'musicbrainz_id', name: 'MusicBrainz ID', type: 'STRING' },
      { key: 'discogs_ids', name: 'Discogs IDs', type: 'STRING' },
      { key: 'wikidata_id', name: 'Wikidata ID', type: 'STRING' },
      
      // Metadata
      { key: 'date_of_birth', name: 'Date of Birth', type: 'STRING' },
      { key: 'nationality', name: 'Nationality', type: 'STRING' },
      { key: 'duration_ms', name: 'Duration (ms)', type: 'NUMBER' },
      { key: 'year', name: 'Release Year', type: 'STRING' }, // STRING to avoid commas
      { key: 'work_count', name: 'Work Count', type: 'NUMBER' },
      { key: 'language', name: 'Language', type: 'STRING' },
      { key: 'role', name: 'Role', type: 'STRING' },
      { key: 'title', name: 'Title', type: 'STRING' },
      { key: 'data_source', name: 'Data Source', type: 'STRING' },
      
      // Relation properties
      { key: 'performed_by', name: 'Performed By', type: 'RELATION' },
      { key: 'composed_by', name: 'Composed By', type: 'RELATION' },
      { key: 'published_by', name: 'Published By', type: 'RELATION' },
      { key: 'writes', name: 'Writes', type: 'RELATION' },
      { key: 'recording_of', name: 'Recording Of', type: 'RELATION' }, // Better than 'embodies'
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
    
    // Step 2: Create entity types
    console.log(chalk.cyan('Creating entity types...'));
    const types = [
      { key: 'artist', name: 'Music Artist', props: ['isni', 'ipi', 'spotify_id', 'apple_id'] },
      { key: 'recording', name: 'Recording', props: ['isrc', 'duration_ms', 'year', 'spotify_id'] },
      { key: 'work', name: 'Musical Work', props: ['iswc'] },
      { key: 'publisher', name: 'Publisher', props: ['ipi', 'work_count'] },
      { key: 'mlc_writer', name: 'MLC Writer', props: ['ipi', 'work_count'] },
      { key: 'contributor', name: 'Contributor', props: ['role', 'work_count'] },
      { key: 'alternative_name', name: 'Alternative Name', props: ['language'] },
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
    
    // Step 3: First collect all relationships for each node
    console.log(chalk.cyan('Analyzing relationships...'));
    const nodeRelations = new Map<string, any[]>(); // node id -> relations
    
    // Map edge labels to property keys
    const labelToProp: Record<string, string> = {
      'PERFORMED_BY': 'performed_by',
      'COMPOSED_BY': 'composed_by',
      'PUBLISHES': 'published_by',
      'WRITES': 'writes',
      'EMBODIES': 'recording_of',
      'ALIAS_OF': 'alias_of',
      'Composer': 'composed_by',
      'ComposerLyricist': 'composed_by',
      'Lyricist': 'writes',
    };
    
    // Collect outgoing relations for each node
    for (const edge of graphData.edges) {
      const sourceId = edge.data.source;
      const targetId = edge.data.target;
      const label = edge.data.label;
      
      const propKey = labelToProp[label];
      if (!propKey) continue;
      
      if (!nodeRelations.has(sourceId)) {
        nodeRelations.set(sourceId, []);
      }
      
      nodeRelations.get(sourceId)!.push({
        property: propKey,
        target: targetId,
      });
    }
    
    // Step 4: Create entities WITH their relations embedded
    console.log(chalk.cyan('Creating entities with embedded relations...'));
    const nodeGroups = new Map<string, CytoscapeNode[]>();
    
    // Group nodes by type
    for (const node of graphData.nodes) {
      const type = node.data.type;
      if (!nodeGroups.has(type)) {
        nodeGroups.set(type, []);
      }
      nodeGroups.get(type)!.push(node);
    }
    
    // Process each type group
    for (const [type, nodes] of nodeGroups.entries()) {
      console.log(chalk.gray(`  Creating ${nodes.length} ${type} entities...`));
      const typeId = this.typeIds.get(type);
      
      if (!typeId) {
        console.log(chalk.yellow(`  Warning: No type ID for ${type}, creating generic entities`));
      }
      
      for (const node of nodes) {
        const values: any[] = [];
        
        // Map Cytoscape properties to GRC-20 values
        if (node.data.properties) {
          for (const [key, value] of Object.entries(node.data.properties)) {
            const propId = this.propertyIds.get(key);
            if (propId && value !== null && value !== undefined && value !== 'N/A') {
              // Handle different value types
              if (typeof value === 'number') {
                values.push({
                  property: propId,
                  value: Graph.serializeNumber(value),
                });
              } else if (Array.isArray(value)) {
                // Add ALL values in arrays (like multiple IPIs, spotify IDs, etc)
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
        
        // Build relations object for this entity
        const relations: any = {};
        const entityRelations = nodeRelations.get(node.data.id) || [];
        
        // We need to create entities in order so targets exist
        // For now, we'll store the relation info and create them in a second pass
        
        const { id: entityId, ops: entityOps } = Graph.createEntity({
          name: node.data.label,
          types: typeId ? [typeId] : [],
          values,
          // Relations will be added in second pass
        });
        
        this.entityIdMap.set(node.data.id, entityId);
        ops.push(...entityOps);
      }
    }
    
    // Step 4: Create relationships from edges
    console.log(chalk.cyan('Creating relationships...'));
    const edgeGroups = new Map<string, CytoscapeEdge[]>();
    
    // Group edges by label
    for (const edge of graphData.edges) {
      const label = edge.data.label;
      if (!edgeGroups.has(label)) {
        edgeGroups.set(label, []);
      }
      edgeGroups.get(label)!.push(edge);
    }
    
    // Process each edge type
    for (const [label, edges] of edgeGroups.entries()) {
      console.log(chalk.gray(`  Creating ${edges.length} ${label} relationships...`));
      
      // Map edge labels to property keys
      const labelToProp: Record<string, string> = {
        'PERFORMED_BY': 'performed_by',
        'COMPOSED_BY': 'composed_by',
        'PUBLISHES': 'published_by',
        'WRITES': 'writes',
        'EMBODIES': 'recording_of', // Fix the terminology
        'ALIAS_OF': 'alias_of',
        'Composer': 'composed_by',
        'ComposerLyricist': 'composed_by',
        'Lyricist': 'writes',
      };
      
      const propKey = labelToProp[label] || 'related_to';
      const propId = this.propertyIds.get(propKey);
      
      if (!propId) {
        console.log(chalk.yellow(`  Warning: No property for relationship ${label}`));
        continue;
      }
      
      for (const edge of edges) {
        const sourceEntityId = this.entityIdMap.get(edge.data.source);
        const targetEntityId = this.entityIdMap.get(edge.data.target);
        
        if (!sourceEntityId || !targetEntityId) {
          console.log(chalk.yellow(`  Warning: Missing entity for edge ${edge.data.source} -> ${edge.data.target}`));
          continue;
        }
        
        // In GRC-20, relationships are stored as entity values
        // We need to update the source entity with the relationship
        // This is a simplified approach - in production you'd batch these
        ops.push({
          type: 'triple',
          action: 'set',
          entity: sourceEntityId,
          property: propId,
          value: targetEntityId,
        });
      }
    }
    
    console.log(chalk.green(`✓ Created ${ops.length} total operations`));
    return ops;
  }
}

// Run converter
if (import.meta.main) {
  const converter = new CytoscapeToGRC20Converter();
  converter.convertAndMint().catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });
}

export { CytoscapeToGRC20Converter };