const fs = require('fs');
const ops = JSON.parse(fs.readFileSync('output/grc20-ops-proper-2025-09-18T09-19-14-717Z.json', 'utf-8'));

// Find the phantom type
const phantomType = '8f151ba4-de20-4e3c-9cb4-99ddf96f48f1';

// Check if this is a property that was created
const propCreate = ops.find(op => op.type === 'CREATE_PROPERTY' && op.property?.id === phantomType);
console.log('Property creation for phantom type:', propCreate ? 'FOUND' : 'NOT FOUND');

// Find first few phantom relations to see pattern
const phantomRels = ops.filter(op => op.type === 'CREATE_RELATION' && op.relation.type === phantomType).slice(0, 3);

console.log('\nFirst 3 phantom relations:');
phantomRels.forEach(rel => {
  // Find what entities these are
  const fromEntity = ops.find(op => op.type === 'UPDATE_ENTITY' && op.entity?.id === rel.relation.fromEntity);
  const toEntity = ops.find(op => op.type === 'UPDATE_ENTITY' && op.entity?.id === rel.relation.toEntity);
  
  const fromName = fromEntity?.entity.values.find(v => v.property === 'a126ca53-0c8e-48d5-b888-82c734c38935')?.value;
  const toName = toEntity?.entity.values.find(v => v.property === 'a126ca53-0c8e-48d5-b888-82c734c38935')?.value;
  
  console.log(`  ${fromName || rel.relation.fromEntity} -> ${toName || rel.relation.toEntity}`);
});

// Check the relation entity field
console.log('\nRelation entity field:', phantomRels[0]?.relation.entity);
