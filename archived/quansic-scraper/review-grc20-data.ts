#!/usr/bin/env bun

/**
 * REVIEW GRC-20 DATA BEFORE MINTING
 * 
 * Analyzes the dry-run output to check for data quality issues
 */

import chalk from 'chalk';
import fs from 'fs';

const reviewData = (prefix: string) => {
  console.log(chalk.bold.cyan('\n🔍 GRC-20 DATA REVIEW\n'));
  
  // Load the data files
  const nodes = JSON.parse(fs.readFileSync(`${prefix}-nodes.json`, 'utf-8'));
  const edges = JSON.parse(fs.readFileSync(`${prefix}-edges.json`, 'utf-8'));
  const ops = JSON.parse(fs.readFileSync(`${prefix}-ops.json`, 'utf-8'));
  
  console.log(chalk.bold('Summary:'));
  console.log(`  Nodes: ${nodes.length}`);
  console.log(`  Edges: ${edges.length}`);
  console.log(`  Operations: ${ops.length}`);
  console.log();
  
  // Check for data issues
  const issues: string[] = [];
  
  // Check for formatting issues in numbers
  nodes.forEach((node: any) => {
    if (node.properties) {
      Object.entries(node.properties).forEach(([key, value]) => {
        if (typeof value === 'string' && /^\d{1,3}(,\d{3})+$/.test(value as string)) {
          issues.push(`Node ${node.id} has comma-formatted number in ${key}: ${value}`);
        }
      });
    }
  });
  
  // Check for duplicate nodes
  const nodeIds = nodes.map((n: any) => n.id);
  const duplicateNodes = nodeIds.filter((id: string, idx: number) => nodeIds.indexOf(id) !== idx);
  if (duplicateNodes.length > 0) {
    issues.push(`Duplicate node IDs: ${duplicateNodes.join(', ')}`);
  }
  
  // Check for duplicate edges
  const edgeKeys = edges.map((e: any) => `${e.source}-${e.label}-${e.target}`);
  const duplicateEdges = edgeKeys.filter((key: string, idx: number) => edgeKeys.indexOf(key) !== idx);
  if (duplicateEdges.length > 0) {
    issues.push(`Duplicate edges: ${duplicateEdges.length} duplicates found`);
  }
  
  // Check for missing ISWCs in works
  const works = nodes.filter((n: any) => n.type === 'work');
  const worksWithoutISWC = works.filter((w: any) => 
    !w.properties?.iswc || w.properties.iswc === 'No ISWC'
  );
  console.log(chalk.bold('Work Analysis:'));
  console.log(`  Total works: ${works.length}`);
  console.log(`  Works with ISWC: ${works.length - worksWithoutISWC.length}`);
  console.log(`  Works without ISWC: ${worksWithoutISWC.length}`);
  console.log();
  
  // Node type breakdown
  console.log(chalk.bold('Node Types:'));
  const typeCount = new Map<string, number>();
  nodes.forEach((n: any) => {
    typeCount.set(n.type, (typeCount.get(n.type) || 0) + 1);
  });
  Array.from(typeCount.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  console.log();
  
  // Edge type breakdown
  console.log(chalk.bold('Edge Types:'));
  const edgeTypeCount = new Map<string, number>();
  edges.forEach((e: any) => {
    edgeTypeCount.set(e.label, (edgeTypeCount.get(e.label) || 0) + 1);
  });
  Array.from(edgeTypeCount.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  console.log();
  
  // Report issues
  if (issues.length > 0) {
    console.log(chalk.yellow.bold('⚠️  Data Issues Found:'));
    issues.forEach(issue => {
      console.log(chalk.yellow(`  - ${issue}`));
    });
    console.log();
  } else {
    console.log(chalk.green.bold('✅ No data quality issues found'));
    console.log();
  }
  
  // Sample data check
  console.log(chalk.bold('Sample Data:'));
  const sampleRecording = nodes.find((n: any) => n.type === 'recording');
  if (sampleRecording) {
    console.log('Sample Recording:', JSON.stringify(sampleRecording, null, 2));
  }
  console.log();
  
  // Comparison with expected values
  console.log(chalk.bold('Comparison with Cytoscape visualization:'));
  console.log('  Expected: 322 nodes, 808 edges (includes 147 duplicate COMPOSED_BY)');
  console.log(`  Got: ${nodes.length} nodes, ${edges.length} edges (all unique)`);
  const uniqueExpected = 808 - 147;
  const diff = edges.length - uniqueExpected;
  if (Math.abs(diff) < 20) {
    console.log(chalk.green(`  ✓ Edge count within acceptable range (${diff > 0 ? '+' : ''}${diff})`));
  } else {
    console.log(chalk.yellow(`  ⚠ Edge count differs by ${diff}`));
  }
  console.log();
  
  // Final recommendation
  console.log(chalk.bold('Recommendation:'));
  if (issues.length === 0 && nodes.length >= 320 && nodes.length <= 330) {
    console.log(chalk.green('✅ Data looks good for minting'));
    console.log(chalk.cyan('\nTo mint, run:'));
    console.log(chalk.white(`  PRIVATE_KEY="0x..." bun run src/graph/artist-to-grc20.ts ${process.argv[2] || '0000000356358936'} --no-dry-run`));
  } else {
    console.log(chalk.yellow('⚠️  Review issues above before minting'));
  }
};

// Main
if (import.meta.main) {
  const pattern = process.argv[2] || 'output/grc20-0000000356358936-*';
  
  // Find most recent files matching pattern
  const files = fs.readdirSync('output').filter(f => 
    f.startsWith('grc20-0000000356358936-') && f.endsWith('-nodes.json')
  ).sort().reverse();
  
  if (files.length === 0) {
    console.error(chalk.red('No GRC-20 output files found. Run the pipeline first:'));
    console.error(chalk.white('  bun run src/graph/artist-to-grc20.ts'));
    process.exit(1);
  }
  
  const latest = files[0].replace('-nodes.json', '');
  console.log(chalk.gray(`Using files: output/${latest}-*.json`));
  
  reviewData(`output/${latest}`);
}

export { reviewData };