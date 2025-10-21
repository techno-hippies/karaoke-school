#!/usr/bin/env bun
/**
 * Test Translation Service
 *
 * Tests multilingual translation (default: Vietnamese + Mandarin)
 */

import { TranslationService } from './services/translation.js';

async function main() {
  console.log('🧪 Testing Translation Service\n');
  console.log('═'.repeat(60) + '\n');

  const service = new TranslationService();

  // Test 1: Translate bio
  console.log('Test 1: Profile Bio Translation\n');
  console.log('-'.repeat(60));

  const bio = 'Professional karaoke singer and content creator. Follow for daily covers!';
  console.log(`Original: "${bio}"\n`);

  const bioTranslations = await service.translateBio(bio);
  console.log('Translations:');
  for (const [lang, text] of Object.entries(bioTranslations)) {
    console.log(`  ${lang}: "${text}"`);
  }

  // Test 2: Translate description
  console.log('\n\nTest 2: Video Description Translation\n');
  console.log('-'.repeat(60));

  const description = 'Singing "Cruel Summer" by Taylor Swift! Hope you enjoy 💕';
  console.log(`Original: "${description}"\n`);

  const descTranslations = await service.translateDescription(description);
  console.log('Translations:');
  for (const [lang, text] of Object.entries(descTranslations)) {
    console.log(`  ${lang}: "${text}"`);
  }

  // Test 3: Custom languages
  console.log('\n\nTest 3: Custom Languages (Japanese + Korean)\n');
  console.log('-'.repeat(60));

  const text = 'Thank you for watching!';
  console.log(`Original: "${text}"\n`);

  const customTranslations = await service.translateToMultiple(text, ['ja', 'ko']);
  console.log('Translations:');
  for (const [lang, translated] of Object.entries(customTranslations)) {
    console.log(`  ${lang}: "${translated}"`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ All tests complete!\n');

  console.log('Default languages:', service.getDefaultLanguages().join(', '));
  console.log(
    'Supported languages:',
    TranslationService.getSupportedLanguages().join(', ')
  );
}

main().catch((error) => {
  console.error('\n❌ Test failed:', error.message);
  console.error(error);
  process.exit(1);
});
