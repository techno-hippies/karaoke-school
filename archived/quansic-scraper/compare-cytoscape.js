const fs = require('fs');
const html = fs.readFileSync('output/grimes-graph.html', 'utf-8');
const match = html.match(/const graphData = ({[\s\S]*?});/);
const graphData = eval(`(${match[1]})`);

// Find Genesis recording
const genesis = graphData.nodes.find(n => n.data.label === 'Genesis' && n.data.type === 'recording');
console.log('Genesis in Cytoscape HTML:', JSON.stringify(genesis, null, 2));

// Find its edges
const genesisEdges = graphData.edges.filter(e => 
  e.data.source === genesis.data.id || e.data.target === genesis.data.id
);
console.log('\nGenesis edges:', genesisEdges.length);
genesisEdges.forEach(e => {
  const source = graphData.nodes.find(n => n.data.id === e.data.source);
  const target = graphData.nodes.find(n => n.data.id === e.data.target);
  console.log(`  ${source?.data.label} --[${e.data.label}]--> ${target?.data.label}`);
});

// Check Ju Pan Wei
const juPanWei = graphData.nodes.find(n => n.data.label === 'Ju Pan Wei');
console.log('\nJu Pan Wei in Cytoscape:', juPanWei?.data.id);
const juPanWeiEdges = graphData.edges.filter(e => 
  e.data.source === juPanWei?.data.id || e.data.target === juPanWei?.data.id
);
console.log('Ju Pan Wei edges:', juPanWeiEdges.length);
juPanWeiEdges.forEach(e => {
  const source = graphData.nodes.find(n => n.data.id === e.data.source);
  const target = graphData.nodes.find(n => n.data.id === e.data.target);
  console.log(`  ${source?.data.label} --[${e.data.label}]--> ${target?.data.label}`);
});
