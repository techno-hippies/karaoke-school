const fs = require('fs');
const html = fs.readFileSync('output/grimes-graph.html', 'utf-8');
const match = html.match(/const graphData = ({[\s\S]*?});/);
const graphDataStr = match[1];
const graphData = eval(`(${graphDataStr})`);

// Check for duplicate node IDs
const nodeIds = graphData.nodes.map(n => n.data.id);
const duplicates = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);

if (duplicates.length > 0) {
  console.log('Duplicate node IDs found:', duplicates);
  
  // Show the duplicate nodes
  duplicates.forEach(dupId => {
    const nodes = graphData.nodes.filter(n => n.data.id === dupId);
    console.log(`\nDuplicate ID ${dupId}:`);
    nodes.forEach(n => console.log(`  ${n.data.label} (${n.data.type})`));
  });
} else {
  console.log('No duplicate node IDs found');
}

// Check total counts
console.log(`\nTotal nodes: ${graphData.nodes.length}`);
console.log(`Unique node IDs: ${new Set(nodeIds).size}`);
