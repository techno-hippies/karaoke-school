const fs = require('fs');
const html = fs.readFileSync('output/grimes-graph.html', 'utf-8');
const match = html.match(/const graphData = ({[\s\S]*?});/);
const graphDataStr = match[1];
const graphData = eval(`(${graphDataStr})`);

// Find nodes in question
const problemNodes = ['Грајмс', 'Граимс', '格萊姆斯', 'Граймс', 'گرایمز', 'גריימס', 'ไกรมส์', '그라임스', 'Գրայմս', 'جرايمس', 'Ju Pan Wei'];
const nodeIds = graphData.nodes
  .filter(n => problemNodes.includes(n.data.label))
  .map(n => n.data.id);

// Find edges involving these nodes
const edges = graphData.edges.filter(e => 
  nodeIds.includes(e.data.source) || nodeIds.includes(e.data.target)
);

console.log('Problem node IDs:', nodeIds);
console.log('\nEdges:');
edges.forEach(e => {
  const sourceNode = graphData.nodes.find(n => n.data.id === e.data.source);
  const targetNode = graphData.nodes.find(n => n.data.id === e.data.target);
  console.log(`  ${sourceNode?.data.label} --[${e.data.label}]--> ${targetNode?.data.label}`);
});
