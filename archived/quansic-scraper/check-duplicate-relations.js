const fs = require('fs');
const html = fs.readFileSync('output/grimes-graph.html', 'utf-8');
const match = html.match(/const graphData = ({[\s\S]*?});/);
const graphData = eval(`(${match[1]})`);

// Count unique edges in Cytoscape
const uniqueEdges = new Set();
const duplicateEdges = [];
graphData.edges.forEach(e => {
  const key = `${e.data.source}-${e.data.label}->${e.data.target}`;
  if (uniqueEdges.has(key)) {
    duplicateEdges.push(key);
  }
  uniqueEdges.add(key);
});

console.log(`Cytoscape edges: ${graphData.edges.length}`);
console.log(`Unique edges: ${uniqueEdges.size}`);
console.log(`Duplicate edges: ${duplicateEdges.length}`);

if (duplicateEdges.length > 0) {
  console.log('\nSample duplicates:');
  duplicateEdges.slice(0, 5).forEach(d => console.log(`  ${d}`));
}

// Check for specific duplicate patterns
const edgesBySource = {};
graphData.edges.forEach(e => {
  const key = e.data.source;
  if (!edgesBySource[key]) edgesBySource[key] = [];
  edgesBySource[key].push(e);
});

// Find sources with many edges
const sourcesWithManyEdges = Object.entries(edgesBySource)
  .filter(([_, edges]) => edges.length > 10)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 3);

console.log('\nSources with most edges:');
sourcesWithManyEdges.forEach(([source, edges]) => {
  const node = graphData.nodes.find(n => n.data.id === source);
  console.log(`  ${node?.data.label}: ${edges.length} edges`);
  
  // Group by label
  const byLabel = {};
  edges.forEach(e => {
    byLabel[e.data.label] = (byLabel[e.data.label] || 0) + 1;
  });
  Object.entries(byLabel).forEach(([label, count]) => {
    if (count > 1) console.log(`    ${label}: ${count} times`);
  });
});
