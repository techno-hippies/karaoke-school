const fs = require('fs');
const html = fs.readFileSync('output/grimes-graph.html', 'utf-8');
const match = html.match(/const graphData = ({[\s\S]*?});/);
const graphData = eval(`(${match[1]})`);

const ops = JSON.parse(fs.readFileSync('output/grc20-ops-proper-2025-09-18T09-19-14-717Z.json', 'utf-8'));

// Count edges in HTML by type
const edgeTypes = {};
graphData.edges.forEach(e => {
  edgeTypes[e.data.label] = (edgeTypes[e.data.label] || 0) + 1;
});

console.log('Edges in Cytoscape HTML:');
Object.entries(edgeTypes).forEach(([type, count]) => {
  console.log(`  ${type}: ${count}`);
});
console.log(`  TOTAL: ${graphData.edges.length}`);

// Count relations in ops
const relationOps = ops.filter(op => op.type === 'CREATE_RELATION');
console.log(`\nRelations in GRC-20 ops: ${relationOps.length}`);

// Check for missing edges
if (relationOps.length < graphData.edges.length) {
  console.log(`\n⚠️ MISSING ${graphData.edges.length - relationOps.length} edges!`);
}
