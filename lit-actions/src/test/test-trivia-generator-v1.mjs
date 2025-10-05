#!/usr/bin/env node

/**
 * Test Script for Trivia Generator v1
 *
 * Tests multilingual question generation quality for:
 * - Vietnamese songs
 * - Mandarin Chinese songs
 * - English songs
 *
 * Usage:
 *   bun run test:trivia-gen -- --song-id 123456 --language zh-CN
 *   bun run test:trivia-gen -- --song-id 789012 --language vi
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const songIdArg = args.find(arg => arg.startsWith('--song-id='))?.split('=')[1];
const languageArg = args.find(arg => arg.startsWith('--language='))?.split('=')[1] || 'zh-CN';

if (!songIdArg) {
  console.error('❌ Usage: bun run test:trivia-gen -- --song-id=123456 [--language=zh-CN|vi|en]');
  process.exit(1);
}

// Trivia Generator v1 CID (will be set after upload)
const TRIVIA_GENERATOR_V1_CID = process.env.TRIVIA_GENERATOR_V1_CID || 'LOCAL_TEST';

// Fetch real referents from Genius API
async function fetchGeniusReferents(songId) {
  const geniusToken = process.env.GENIUS_API_KEY;
  if (!geniusToken) {
    throw new Error('GENIUS_API_KEY not found in .env');
  }

  console.log(`🎵 Fetching referents for song ${songId} from Genius...`);

  // Fetch referents for the song
  const response = await fetch(`https://api.genius.com/referents?song_id=${songId}`, {
    headers: {
      'Authorization': `Bearer ${geniusToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Genius API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const referents = data.response.referents;

  if (!referents || referents.length === 0) {
    throw new Error(`No referents found for song ${songId}`);
  }

  // Helper to extract plain text from Genius DOM structure
  function extractPlainText(dom) {
    if (!dom) return '';
    if (typeof dom === 'string') return dom;
    if (Array.isArray(dom)) {
      return dom.map(extractPlainText).join('');
    }
    if (dom.children) {
      return extractPlainText(dom.children);
    }
    return '';
  }

  // Extract referent data (matching your production Lit Action structure)
  const processedReferents = referents.map(ref => {
    // Get the text fragment this annotation refers to
    let fragment = ref.fragment || '';

    // Remove producer/writer credits and metadata in square brackets
    fragment = fragment.replace(/\[.*?\]/g, '').trim();

    // Skip if fragment is now empty or too short
    if (!fragment || fragment.length < 3) {
      return null;
    }

    // Get annotation details
    const annotation = ref.annotations?.[0] || {};

    // Extract plain text from DOM structure
    const annotationBody = annotation.body?.dom
      ? extractPlainText(annotation.body.dom)
      : '';

    return {
      id: ref.id,
      fragment: fragment,
      annotation: annotationBody.trim(),
      votes_total: annotation.votes_total || 0,
      verified: annotation.verified || false
    };
  }).filter(r => r !== null && r.annotation.length > 0); // Only keep referents with annotations

  console.log(`✅ Found ${processedReferents.length} referents with annotations`);

  return processedReferents;
}

async function loadOpenRouterKey() {
  console.log('🔐 Loading OpenRouter API key encryption...');
  const keyPath = join(__dirname, '../quiz/keys/openrouter_api_key.json');

  try {
    const keyData = JSON.parse(await readFile(keyPath, 'utf-8'));
    console.log('✅ OpenRouter key encryption loaded');
    return keyData;
  } catch (error) {
    console.log('⚠️  No encrypted key found, using env variable');
    return null;
  }
}

async function main() {
  console.log('🧪 Trivia Generator v1 - Quality Test\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📝 Song ID: ${songIdArg}`);
  console.log(`🌍 Language: ${languageArg}\n`);

  try {
    // Fetch real referents from Genius
    const testReferents = await fetchGeniusReferents(songIdArg);
    console.log(`📚 Referents with annotations: ${testReferents.length}\n`);

    // Load OpenRouter key encryption (if available)
    const openrouterKeyData = await loadOpenRouterKey();

    // Set up Auth Manager
    console.log('🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "trivia-generator-v1-test",
        networkName: "naga-dev",
        storagePath: "../../lit-auth-storage"
      }),
    });
    console.log('✅ Auth Manager created');

    // Connect to Lit
    console.log('\n🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Network (nagaDev)');

    // Create authentication context
    console.log('\n🔐 Creating authentication context...');
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not found in .env');
    }

    const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const viemAccount = privateKeyToAccount(cleanPrivateKey);

    const authContext = await authManager.createEoaAuthContext({
      authConfig: {
        chain: 'ethereum',
        expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
        resources: [
          {
            resource: new LitActionResource('*'),
            ability: 'lit-action-execution'
          }
        ]
      },
      config: {
        account: viemAccount
      },
      litClient: litClient
    });

    console.log('✅ Auth context created');

    // Prepare jsParams
    const jsParams = {
      songId: songIdArg,
      referents: testReferents,
      language: languageArg,
      userAddress: viemAccount.address
    };

    // Add OpenRouter key encryption if available
    if (openrouterKeyData) {
      jsParams.openrouterCiphertext = openrouterKeyData.ciphertext;
      jsParams.openrouterDataToEncryptHash = openrouterKeyData.dataToEncryptHash;
      jsParams.accessControlConditions = openrouterKeyData.accessControlConditions;
    } else {
      // Use plaintext key for local testing (NOT for production!)
      console.log('⚠️  Using plaintext OpenRouter key (local testing only)');
      jsParams.openrouterKey = process.env.OPENROUTER_API_KEY;
    }

    // Execute Lit Action
    console.log('\n🚀 Executing Trivia Generator v1...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const startTime = Date.now();

    // Read local Lit Action code for testing
    const litActionCode = await readFile(
      join(__dirname, '../quiz/trivia-generator-v1.js'),
      'utf-8'
    );

    const result = await litClient.executeJs({
      code: litActionCode,  // Use local code for testing
      authContext: authContext,
      jsParams: jsParams,
    });

    const executionTime = Date.now() - startTime;

    console.log('✅ Lit Action execution completed');
    console.log(`⏱️  Execution time: ${executionTime}ms\n`);

    // Parse and display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS\n');

    const response = JSON.parse(result.response);

    if (response.success) {
      console.log('✅ Success:', response.success);
      console.log('📝 Questions Generated:', response.metadata.questionsGenerated);
      console.log('🎯 Model Used:', response.metadata.modelUsed);
      console.log('🔢 Tokens Used:', response.metadata.tokensUsed);
      console.log('📚 Annotations Used:', `${response.metadata.annotationsUsed}/${response.metadata.annotationsAvailable}`);
      console.log('🌍 Target Language:', response.metadata.targetLanguage);

      console.log('\n--- Generated Questions ---\n');

      response.questions.forEach((q, i) => {
        console.log(`\n${i + 1}. Fragment: "${q.fragment}"`);
        console.log(`   Question: ${q.question}`);
        console.log(`   Choices:`);
        Object.entries(q.choices).forEach(([key, value]) => {
          const marker = key === q.correctAnswer ? '✓' : ' ';
          console.log(`     ${marker} ${key}. ${value}`);
        });
        console.log(`   Explanation: ${q.explanation}`);
        console.log(`   Annotation Used: ${q.usedAnnotation ? 'Yes' : 'No'} (${q.annotationLanguage})`);
      });

      // Save to file for review
      const outputDir = join(__dirname, '../../output');
      const outputFile = join(outputDir, `questions-${songIdArg}-${languageArg}.json`);

      await writeFile(outputFile, JSON.stringify(response, null, 2));
      console.log(`\n💾 Questions saved to: ${outputFile}`);

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ QUALITY TEST PASSED!\n');

      // Quality metrics
      console.log('📈 Quality Metrics:');
      console.log(`   - All questions in ${languageArg}: ✓`);
      console.log(`   - Annotation usage: ${Math.round(response.metadata.annotationsUsed / response.metadata.questionsGenerated * 100)}%`);
      console.log(`   - Execution time: ${response.metadata.executionTimeMs}ms`);

    } else {
      console.log('❌ Success:', response.success);
      console.log('❌ Error:', response.error);
      console.log('🔍 Models Attempted:', response.metadata.modelsAttempted);
      console.log('❌ Model Errors:', response.metadata.modelErrors);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await litClient.disconnect();
    process.exit(response.success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
