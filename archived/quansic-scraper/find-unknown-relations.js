const fs = require('fs');
const ops = JSON.parse(fs.readFileSync('output/grc20-ops-proper-2025-09-18T09-33-30-533Z.json', 'utf-8'));

// Find the unknown property IDs
const unknownProps = new Set();
ops.filter(op => op.type === 'CREATE_RELATION').forEach(op => {
  const propId = op.relation.type;
  // Check if this is one of our known property IDs
  const updateOp = ops.find(u => u.type === 'UPDATE_ENTITY' && u.entity?.id === propId);
  if (!updateOp) {
    unknownProps.add(propId);
  }
});

console.log('Unknown property IDs:', Array.from(unknownProps));

// Get a sample unknown relation
const sampleUnknown = ops.find(op => 
  op.type === 'CREATE_RELATION' && unknownProps.has(op.relation.type)
);

console.log('\nSample unknown relation:', JSON.stringify(sampleUnknown, null, 2));

// Check if these IDs match any of our property definitions
const propertyDefs = ops.filter(op => op.type === 'CREATE_PROPERTY');
console.log('\nProperty definitions:', propertyDefs.length);

// Check if unknown matches any property ID
const firstUnknown = Array.from(unknownProps)[0];
const matchingProp = propertyDefs.find(p => p.property.id === firstUnknown);
console.log('Matches a property def:', !!matchingProp);
