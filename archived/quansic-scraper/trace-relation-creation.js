const fs = require('fs');
const html = fs.readFileSync('output/grimes-graph.html', 'utf-8');
const match = html.match(/const graphData = ({[\s\S]*?});/);
const graphData = eval(`(${match[1]})`);

// Build a map of what relations SHOULD be created
const expectedRelations = new Map();
graphData.edges.forEach(e => {
  const key = e.data.source;
  if (!expectedRelations.has(key)) {
    expectedRelations.set(key, []);
  }
  expectedRelations.get(key).push({
    label: e.data.label,
    target: e.data.target
  });
});

// Check a specific node that has duplicates
const problemNode = 'mlc_CLAIRE_ELISE_BOUCHER';
const problemEdges = expectedRelations.get(problemNode);
console.log(`${problemNode} should have ${problemEdges?.length || 0} edges`);

// Check how many unique targets
const uniqueTargets = new Set(problemEdges?.map(e => e.target));
console.log(`Unique targets: ${uniqueTargets.size}`);

// All edges are WRITES
console.log(`All WRITES: ${problemEdges?.every(e => e.label === 'WRITES')}`);

// So CLAIRE ELISE BOUCHER writes 121 works but they're all stored as separate edges
// This is correct - she has 121 WRITES relations
