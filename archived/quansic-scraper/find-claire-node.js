const fs = require('fs');
const html = fs.readFileSync('output/grimes-graph.html', 'utf-8');
const match = html.match(/const graphData = ({[\s\S]*?});/);
const graphData = eval(`(${match[1]})`);

// Find CLAIRE ELISE BOUCHER node
const claire = graphData.nodes.find(n => n.data.label === 'CLAIRE ELISE BOUCHER');
console.log('CLAIRE node ID:', claire?.data.id);
console.log('CLAIRE node type:', claire?.data.type);

// Count her edges
const claireEdges = graphData.edges.filter(e => e.data.source === claire?.data.id);
console.log(`CLAIRE has ${claireEdges.length} outgoing edges`);

// All should be WRITES
const edgeTypes = {};
claireEdges.forEach(e => {
  edgeTypes[e.data.label] = (edgeTypes[e.data.label] || 0) + 1;
});
console.log('Edge types:', edgeTypes);
