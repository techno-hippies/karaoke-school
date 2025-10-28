#!/usr/bin/env bun
/**
 * Fix Wikidata ID Regex Bug
 * 
 * This script fixes the regex pattern in enrich-musicbrainz.ts that causes
 * wikidata_id to show "wiki" instead of proper Q-IDs.
 */

import fs from 'fs';
import path from 'path';

const filePath = path.join(__dirname, '../scripts/enrich-musicbrainz.ts');

console.log('🔧 Fixing wikidata regex bug...\n');

// Read the current file
const content = fs.readFileSync(filePath, 'utf-8');

// Fix the regex pattern - using string replacement to avoid regex escaping issues
const oldPattern = 'wikidata_id: extractSocial(/wikidata\\.org\\/(entity|wiki)\\/(Q\\d+)/),';
const newPattern = 'wikidata_id: extractSocial(/wikidata\\.org\\/(?:entity|wiki)\\/(Q\\d+)/),';

if (content.includes(oldPattern)) {
  const fixedContent = content.replace(oldPattern, newPattern);
  
  // Write back to file
  fs.writeFileSync(filePath, fixedContent, 'utf-8');
  
  console.log('✅ Fixed wikidata regex pattern');
  console.log('   Old: /wikidata\\.org\\/(entity|wiki)\\/(Q\\d+)/');
  console.log('   New: /wikidata\\.org\\/(?:entity|wiki)\\/(Q\\d+)/');
  console.log('   Change: Made first group non-capturing (?:) so Q-ID is captured as group 1');
  
  console.log('\n📋 Next steps:');
  console.log('   1. Re-run MusicBrainz enrichment to fix existing data:');
  console.log('      bun run enrich-mb 50');
  console.log('   2. Re-run corroboration to update grc20_artists:');
  console.log('      bun run corroborate');
  console.log('   3. Verify fix:');
  console.log('      SELECT name, wikidata_id FROM grc20_artists WHERE wikidata_id IS NOT NULL LIMIT 10;');
  
} else {
  console.log('❌ Could not find the regex pattern to fix');
  console.log('   The pattern may have already been fixed or the file structure changed');
}

console.log('\n🎯 Why this fix works:');
console.log('   - OLD: /(entity|wiki)/ captures "entity|wiki" as group 1');
console.log('   - OLD: /(Q\\d+)/ captures Q-ID as group 2');
console.log('   - extractSocial returns group 1 OR group 2, so it returned "wiki"');
console.log('   - NEW: /(?:entity|wiki)/ is non-capturing, so Q-ID becomes group 1');
console.log('   - extractSocial now correctly returns the Q-ID (e.g., "Q683544")');
