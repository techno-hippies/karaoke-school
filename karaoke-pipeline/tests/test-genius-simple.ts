#!/usr/bin/env bun
/**
 * Simple Genius API diagnostic test
 */

async function main() {
  const apiKey = process.env.GENIUS_API_KEY;

  if (!apiKey) {
    console.error('❌ GENIUS_API_KEY not set');
    process.exit(1);
  }

  console.log('🔍 Genius API Diagnostic Test\n');
  console.log(`API Key length: ${apiKey.length} characters`);
  console.log(`API Key prefix: ${apiKey.substring(0, 10)}...`);
  console.log('');

  // Test 1: Simple search endpoint
  console.log('Test 1: Basic API connection');
  try {
    const response = await fetch(
      'https://api.genius.com/search?q=Billie%20Eilish%20ocean%20eyes',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    console.log(`  Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const text = await response.text();
      console.log(`  Response body: ${text.substring(0, 200)}`);

      if (response.status === 403) {
        console.log('\n❌ 403 Forbidden - Possible causes:');
        console.log('   1. API key is invalid or expired');
        console.log('   2. API client not approved/activated');
        console.log('   3. IP address blocked');
        console.log('');
        console.log('Solutions:');
        console.log('   1. Go to: https://genius.com/api-clients');
        console.log('   2. Verify your API client status is "Active"');
        console.log('   3. Generate a new "Client Access Token"');
        console.log('   4. Make sure you copied the full token');
      }
      return;
    }

    const data = await response.json();
    console.log(`  ✅ API is working!`);
    console.log(`  Response type: ${data.meta?.status}`);
    console.log(`  Hits found: ${data.response?.hits?.length || 0}`);

    if (data.response?.hits?.length > 0) {
      const hit = data.response.hits[0].result;
      console.log('');
      console.log('  First result:');
      console.log(`    Title: ${hit.title}`);
      console.log(`    Artist: ${hit.primary_artist?.name}`);
      console.log(`    ID: ${hit.id}`);
    }

  } catch (error) {
    console.error(`  ❌ Network error: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('');

  // Test 2: Check API rate limit
  console.log('Test 2: Rate limit check');
  try {
    const response = await fetch('https://api.genius.com/account', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    console.log(`  Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`  ✅ Account endpoint accessible`);
      console.log(`  User: ${data.response?.user?.name || 'Unknown'}`);
    } else {
      console.log(`  ⚠️ Account endpoint returned ${response.status}`);
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

main().catch(console.error);
