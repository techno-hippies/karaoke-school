const fs = require('fs');
const ops = JSON.parse(fs.readFileSync('output/grc20-ops-proper-2025-09-18T09-33-30-533Z.json', 'utf-8'));

// Build property map
const propMap = {};
ops.filter(op => op.type === 'CREATE_PROPERTY').forEach(op => {
  const propId = op.property.id;
  const updateOp = ops.find(u => u.type === 'UPDATE_ENTITY' && u.entity?.id === propId);
  if (updateOp) {
    const nameValue = updateOp.entity.values.find(v => v.value && typeof v.value === 'string' && !v.value.includes('-'));
    if (nameValue) propMap[propId] = nameValue.value;
  }
});

// Count relations by property type
const relationsByProp = {};
ops.filter(op => op.type === 'CREATE_RELATION').forEach(op => {
  const propName = propMap[op.relation.type] || 'UNKNOWN';
  relationsByProp[propName] = (relationsByProp[propName] || 0) + 1;
});

console.log('Our relations by type:');
Object.entries(relationsByProp).forEach(([prop, count]) => {
  console.log(`  ${prop}: ${count}`);
});

// Compare to Cytoscape
console.log('\nExpected from Cytoscape:');
console.log('  WRITES: 167');
console.log('  COMPOSED_BY: 297');
console.log('  PERFORMED_BY: 75');
console.log('  PUBLISHES: 178');
console.log('  EMBODIES: 48');
console.log('  ALIAS_OF: 30');
console.log('  Composer/Lyricist: 14');
