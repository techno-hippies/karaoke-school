const fs = require('fs');
const ops = JSON.parse(fs.readFileSync('output/grc20-ops-proper-2025-09-18T09-19-14-717Z.json', 'utf-8'));

// Build property map
const propertyMap = {};
ops.filter(op => op.type === 'CREATE_PROPERTY').forEach(op => {
  const propId = op.property.id;
  const updateOp = ops.find(u => u.type === 'UPDATE_ENTITY' && u.entity?.id === propId);
  if (updateOp) {
    const nameValue = updateOp.entity.values.find(v => v.value && typeof v.value === 'string' && !v.value.includes('-'));
    if (nameValue) propertyMap[propId] = nameValue.value;
  }
});

// Count relations by mapped name
const relationCounts = {};
ops.filter(op => op.type === 'CREATE_RELATION').forEach(op => {
  const propName = propertyMap[op.relation.type] || op.relation.type;
  relationCounts[propName] = (relationCounts[propName] || 0) + 1;
});

console.log('GRC-20 Relations by name:');
Object.entries(relationCounts).sort((a,b) => b[1] - a[1]).forEach(([name, count]) => {
  console.log(`  ${name}: ${count}`);
});

// Unknown type
const unknownType = '8f151ba4-de20-4e3c-9cb4-99ddf96f48f1';
console.log(`\nUnknown type ${unknownType} maps to:`, propertyMap[unknownType] || 'NOT FOUND');

// Find what entity this creates
const sampleRelation = ops.find(op => op.type === 'CREATE_RELATION' && op.relation.type === unknownType);
console.log('Sample relation with unknown type:', JSON.stringify(sampleRelation, null, 2));
