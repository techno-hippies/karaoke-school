const fs = require('fs');
const ops = JSON.parse(fs.readFileSync('output/grc20-ops-proper-2025-09-18T09-19-14-717Z.json', 'utf-8'));

// Find property creation ops
const propertyOps = ops.filter(op => op.type === 'CREATE_PROPERTY');

// Map property IDs to names by looking at UPDATE_ENTITY ops for properties
const propertyMap = {};
propertyOps.forEach(op => {
  const propId = op.property.id;
  // Find the UPDATE_ENTITY that sets this property's name
  const updateOp = ops.find(u => 
    u.type === 'UPDATE_ENTITY' && 
    u.entity?.id === propId
  );
  if (updateOp) {
    const nameValue = updateOp.entity.values.find(v => v.value && typeof v.value === 'string' && !v.value.includes('-'));
    if (nameValue) {
      propertyMap[propId] = nameValue.value;
    }
  }
});

// Show what the Genesis relations are
console.log('Property b73f455f-9cfb-4606-8394-8e3f5bd63e7e =', propertyMap['b73f455f-9cfb-4606-8394-8e3f5bd63e7e']);
console.log('Property 31607487-8d73-437b-96d4-2717a214a175 =', propertyMap['31607487-8d73-437b-96d4-2717a214a175']);

// List all relation properties
console.log('\nAll relation properties:');
Object.entries(propertyMap).forEach(([id, name]) => {
  if (name && name.includes('By') || name && name.includes('Of') || name === 'Writes' || name === 'Publishes') {
    console.log(`  ${name}: ${id}`);
  }
});
