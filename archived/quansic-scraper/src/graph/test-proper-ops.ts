#!/usr/bin/env bun

import { Graph } from '@graphprotocol/grc-20';
import chalk from 'chalk';

// Create a minimal entity with embedded relations
async function testProperEntity() {
  console.log(chalk.cyan('Testing proper entity creation...'));
  
  // Create properties
  const { id: nameProp, ops: namePropOps } = Graph.createProperty({
    name: 'Name',
    dataType: 'STRING',
  });
  
  const { id: friendProp, ops: friendPropOps } = Graph.createProperty({
    name: 'Friend Of',
    dataType: 'RELATION',
  });
  
  // Create type
  const { id: personType, ops: personTypeOps } = Graph.createType({
    name: 'Person',
    properties: [nameProp, friendProp],
  });
  
  // Create first entity (no relations yet)
  const { id: entity1, ops: entity1Ops } = Graph.createEntity({
    name: 'Alice',
    types: [personType],
    values: [
      { property: nameProp, value: 'Alice Smith' }
    ],
  });
  
  // Create second entity WITH relation to first
  const { id: entity2, ops: entity2Ops } = Graph.createEntity({
    name: 'Bob',
    types: [personType],
    values: [
      { property: nameProp, value: 'Bob Jones' }
    ],
    relations: {
      [friendProp]: { toEntity: entity1 }
    },
  });
  
  // Log the ops
  console.log('\nProperty ops:', JSON.stringify(namePropOps, null, 2));
  console.log('\nEntity with relation ops:', JSON.stringify(entity2Ops, null, 2));
  
  return {
    namePropOps,
    friendPropOps,
    personTypeOps,
    entity1Ops,
    entity2Ops,
  };
}

testProperEntity();
