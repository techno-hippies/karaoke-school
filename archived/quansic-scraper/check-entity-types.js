const fs = require('fs');
const html = fs.readFileSync('output/grimes-graph.html', 'utf-8');
const match = html.match(/const graphData = ({[\s\S]*?});/);
const graphData = eval(`(${match[1]})`);

const ops = JSON.parse(fs.readFileSync('output/grc20-ops-proper-2025-09-18T09-33-30-533Z.json', 'utf-8'));

// Check which entities are actual music entities vs schema entities
const musicEntityIds = new Set();
const schemaEntityIds = new Set();

// Get Cytoscape node IDs
const cytoscapeNodeIds = new Set(graphData.nodes.map(n => n.data.id));

ops.filter(op => op.type === 'UPDATE_ENTITY').forEach(op => {
  const nameValue = op.entity?.values?.find(v => v.property === 'a126ca53-0c8e-48d5-b888-82c734c38935')?.value;
  if (nameValue) {
    // Check if this name matches a Cytoscape node
    const matchesNode = graphData.nodes.some(n => n.data.label === nameValue);
    if (matchesNode) {
      musicEntityIds.add(op.entity.id);
    } else {
      schemaEntityIds.add(op.entity.id);
    }
  }
});

console.log(`Music entities: ${musicEntityIds.size}`);
console.log(`Schema entities: ${schemaEntityIds.size}`);

// Count relations from music entities only
const musicRelations = ops.filter(op => {
  if (op.type !== 'CREATE_RELATION') return false;
  return musicEntityIds.has(op.relation?.fromEntity);
});

console.log(`Relations from music entities: ${musicRelations.length}`);
