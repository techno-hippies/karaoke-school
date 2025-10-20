const fs = require('fs');
const ops = JSON.parse(fs.readFileSync('output/grc20-ops-proper-2025-09-18T09-33-30-533Z.json', 'utf-8'));

// Get all entity IDs we created
const entityIds = new Set();
ops.filter(op => op.type === 'UPDATE_ENTITY').forEach(op => {
  // Check if this is an entity by looking for the name property
  const hasName = op.entity?.values?.some(v => v.property === 'a126ca53-0c8e-48d5-b888-82c734c38935');
  if (hasName) {
    entityIds.add(op.entity.id);
  }
});

console.log(`Found ${entityIds.size} entities`);

// Count relations that are from entities
const entityRelations = ops.filter(op => {
  if (op.type !== 'CREATE_RELATION') return false;
  return entityIds.has(op.relation?.fromEntity);
});

console.log(`Relations from entities: ${entityRelations.length}`);

// Find relations that are NOT from entities
const nonEntityRelations = ops.filter(op => {
  if (op.type !== 'CREATE_RELATION') return false;
  return !entityIds.has(op.relation?.fromEntity);
});

console.log(`Relations NOT from entities: ${nonEntityRelations.length}`);

// Sample non-entity relations
console.log('\nSample non-entity relations:');
nonEntityRelations.slice(0, 3).forEach(rel => {
  console.log(`  From: ${rel.relation.fromEntity.substring(0, 8)}...`);
});
