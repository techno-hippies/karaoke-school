#!/usr/bin/env bun

/**
 * VALIDATION AND TESTING FOR GRC-20 DATA
 * 
 * Based on SDK documentation to ensure we're creating valid data
 */

import { z } from 'zod';
import { Graph, Id } from '@graphprotocol/grc-20';
import chalk from 'chalk';

// Based on SDK: dataType: 'TEXT' | 'NUMBER' | 'TIME' | 'POINT' | 'CHECKBOX' | 'RELATION'
const DataTypeSchema = z.enum(['TEXT', 'NUMBER', 'TIME', 'POINT', 'CHECKBOX', 'RELATION']);

// Property creation schema from SDK
const PropertySchema = z.object({
  name: z.string().min(1),
  dataType: DataTypeSchema
});

// Type creation schema from SDK
const TypeSchema = z.object({
  name: z.string().min(1),
  properties: z.array(z.string()), // Array of property IDs
  cover: z.string().optional() // Optional cover image ID
});

// Value schema from SDK
const ValueSchema = z.object({
  property: z.string(), // Property ID
  value: z.string(), // All values are strings
  options: z.object({
    type: z.enum(['text', 'number']),
    language: z.string().optional(), // For text
    unit: z.string().optional() // For number
  }).optional()
});

// Relation schema from SDK
const RelationSchema = z.object({
  toEntity: z.string(), // Target entity ID
  id: z.string().optional(), // Optional relation ID
  position: z.string().optional(), // Optional position
  values: z.array(ValueSchema).optional() // Optional relation properties
});

// Entity creation schema from SDK
const EntitySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  types: z.array(z.string()), // Array of type IDs
  cover: z.string().optional(), // Optional cover image ID
  values: z.array(ValueSchema).optional(),
  relations: z.record(z.string(), z.union([
    RelationSchema,
    z.array(RelationSchema) // Can be array for multiple relations
  ])).optional()
});

// Test minimal working example from SDK docs
export async function testMinimalExample() {
  console.log(chalk.bold.cyan('\n🧪 Testing Minimal GRC-20 Example\n'));
  
  const ops: any[] = [];
  
  try {
    // 1. Create a simple text property
    const namePropertyData = PropertySchema.parse({
      name: 'Name',
      dataType: 'TEXT'
    });
    
    const { id: namePropertyId, ops: namePropOps } = Graph.createProperty(namePropertyData);
    ops.push(...namePropOps);
    console.log(chalk.green('✓ Created Name property'));
    
    // 2. Create a simple number property
    const agePropertyData = PropertySchema.parse({
      name: 'Age',
      dataType: 'NUMBER'
    });
    
    const { id: agePropertyId, ops: agePropOps } = Graph.createProperty(agePropertyData);
    ops.push(...agePropOps);
    console.log(chalk.green('✓ Created Age property'));
    
    // 3. Create a Person type
    const personTypeData = TypeSchema.parse({
      name: 'Person',
      properties: [namePropertyId, agePropertyId]
    });
    
    const { id: personTypeId, ops: personTypeOps } = Graph.createType(personTypeData);
    ops.push(...personTypeOps);
    console.log(chalk.green('✓ Created Person type'));
    
    // 4. Create a simple entity
    const personEntityData = EntitySchema.parse({
      name: 'Test Person',
      description: 'A test person entity',
      types: [personTypeId],
      values: [
        {
          property: namePropertyId,
          value: 'John Doe'
        },
        {
          property: agePropertyId,
          value: Graph.serializeNumber(30)
        }
      ]
    });
    
    const { id: personId, ops: personOps } = Graph.createEntity(personEntityData);
    ops.push(...personOps);
    console.log(chalk.green('✓ Created Person entity'));
    
    console.log(chalk.bold.green('\n✅ All validations passed!'));
    console.log(`Total ops: ${ops.length}`);
    
    return { success: true, ops };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log(chalk.red('\n❌ Validation failed:'));
      console.log(error.errors);
    } else {
      console.log(chalk.red('\n❌ SDK error:'));
      console.log(error);
    }
    return { success: false, error };
  }
}

// Test music-specific example
export async function testMusicExample() {
  console.log(chalk.bold.cyan('\n🎵 Testing Music GRC-20 Example\n'));
  
  const ops: any[] = [];
  
  try {
    // Music-specific properties
    const properties = [
      { key: 'isni', name: 'ISNI', dataType: 'TEXT' as const },
      { key: 'spotify_id', name: 'Spotify ID', dataType: 'TEXT' as const },
      { key: 'year', name: 'Year', dataType: 'TEXT' as const }, // TEXT to avoid commas
      { key: 'performed_by', name: 'Performed By', dataType: 'RELATION' as const },
      { key: 'recording_of', name: 'Recording Of', dataType: 'RELATION' as const }
    ];
    
    const propertyIds: Record<string, string> = {};
    
    for (const prop of properties) {
      const validated = PropertySchema.parse({
        name: prop.name,
        dataType: prop.dataType
      });
      
      const { id, ops: propOps } = Graph.createProperty(validated);
      propertyIds[prop.key] = id;
      ops.push(...propOps);
      console.log(chalk.green(`✓ Created ${prop.name} property`));
    }
    
    // Create Artist type
    const artistTypeData = TypeSchema.parse({
      name: 'Artist',
      properties: [propertyIds.isni, propertyIds.spotify_id]
    });
    
    const { id: artistTypeId, ops: artistTypeOps } = Graph.createType(artistTypeData);
    ops.push(...artistTypeOps);
    console.log(chalk.green('✓ Created Artist type'));
    
    // Create Recording type
    const recordingTypeData = TypeSchema.parse({
      name: 'Recording',
      properties: [propertyIds.year, propertyIds.spotify_id, propertyIds.performed_by]
    });
    
    const { id: recordingTypeId, ops: recordingTypeOps } = Graph.createType(recordingTypeData);
    ops.push(...recordingTypeOps);
    console.log(chalk.green('✓ Created Recording type'));
    
    // Create artist entity
    const artistData = EntitySchema.parse({
      name: 'Test Artist',
      description: 'A test music artist',
      types: [artistTypeId],
      values: [
        {
          property: propertyIds.isni,
          value: '0000000000000000'
        },
        {
          property: propertyIds.spotify_id,
          value: 'test_spotify_id'
        }
      ]
    });
    
    const { id: artistId, ops: artistOps } = Graph.createEntity(artistData);
    ops.push(...artistOps);
    console.log(chalk.green('✓ Created Artist entity'));
    
    // Create recording with relation to artist
    const recordingData = EntitySchema.parse({
      name: 'Test Song',
      description: 'A test recording',
      types: [recordingTypeId],
      values: [
        {
          property: propertyIds.year,
          value: '2024' // String to avoid formatting
        },
        {
          property: propertyIds.spotify_id,
          value: 'song_spotify_id'
        }
      ],
      relations: {
        [propertyIds.performed_by]: {
          toEntity: artistId
        }
      }
    });
    
    const { id: recordingId, ops: recordingOps } = Graph.createEntity(recordingData);
    ops.push(...recordingOps);
    console.log(chalk.green('✓ Created Recording entity with relation'));
    
    console.log(chalk.bold.green('\n✅ Music example validated successfully!'));
    console.log(`Total ops: ${ops.length}`);
    
    return { success: true, ops, ids: { artistId, recordingId, propertyIds } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log(chalk.red('\n❌ Validation failed:'));
      console.log(JSON.stringify(error.errors, null, 2));
    } else {
      console.log(chalk.red('\n❌ SDK error:'));
      console.log(error);
    }
    return { success: false, error };
  }
}

// Run tests if called directly
if (import.meta.main) {
  console.log(chalk.bold.blue('🔬 GRC-20 Validation Testing Suite\n'));
  
  await testMinimalExample();
  await testMusicExample();
}

export { PropertySchema, TypeSchema, EntitySchema, ValueSchema, RelationSchema };