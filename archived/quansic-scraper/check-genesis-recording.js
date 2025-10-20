const fs = require('fs');
const ops = JSON.parse(fs.readFileSync('output/grc20-ops-proper-2025-09-18T09-19-14-717Z.json', 'utf-8'));

// Find Genesis recording entity
const genesisRecording = ops.find(op => 
  op.type === 'UPDATE_ENTITY' && 
  op.entity?.values?.some(v => v.value === 'CA21O1200002') // ISRC for Genesis recording
);

console.log('Genesis Recording entity:', JSON.stringify(genesisRecording, null, 2));

// Find relations FROM Genesis recording
const genesisEntityId = genesisRecording?.entity?.id;
if (genesisEntityId) {
  const relationsFrom = ops.filter(op => 
    op.type === 'CREATE_RELATION' && 
    op.relation?.fromEntity === genesisEntityId
  );
  console.log(`\nRelations FROM Genesis recording (${genesisEntityId}):`, relationsFrom.length);
  
  const relationsTo = ops.filter(op => 
    op.type === 'CREATE_RELATION' && 
    op.relation?.toEntity === genesisEntityId
  );
  console.log(`Relations TO Genesis recording:`, relationsTo.length);
}
