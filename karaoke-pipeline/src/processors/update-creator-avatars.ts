#!/usr/bin/env bun
/**
 * Upload TikTok Creator Avatars to Grove
 *
 * Downloads TikTok creator avatars and uploads them to Grove/IPFS
 * for use in Lens Protocol account pictures.
 *
 * Usage:
 *   bun src/processors/update-creator-avatars.ts --limit=10
 *   bun src/processors/update-creator-avatars.ts --username=charleenweiss
 */

import { parseArgs } from 'util';
import { query } from '../db/neon';
import fetch from 'node-fetch';

interface CreatorToUpdate {
  username: string;
  nickname: string | null;
  avatar_url: string;
}

const CHAIN_ID = 37111; // Lens Network

/**
 * Upload image to Grove with retry logic
 */
async function uploadToGrove(imageBuffer: Buffer, filename: string): Promise<{ cid: string; url: string }> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   Attempt ${attempt}/${maxRetries}...`);

      const response = await fetch(`https://api.grove.storage/?chain_id=${CHAIN_ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
        },
        body: imageBuffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grove upload failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const cid = Array.isArray(data) ? data[0].storage_key : data.storage_key;
      const url = `https://api.grove.storage/${cid}`;

      console.log(`   ✅ Uploaded to Grove: ${cid}`);
      return { cid, url };
    } catch (error: any) {
      lastError = error;
      console.log(`   ⚠️  Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        const delay = attempt * 2000; // Exponential backoff
        console.log(`   Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Upload failed after all retries');
}

/**
 * Process a single creator's avatar
 */
async function processCreator(creator: CreatorToUpdate): Promise<void> {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`👤 @${creator.username} (${creator.nickname || 'N/A'})`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    // Unescape URL (database might have unicode escapes like \u002F)
    const avatarUrl = creator.avatar_url.replace(/\\u002F/g, '/');

    // Download avatar from TikTok CDN
    console.log('📥 Downloading avatar from TikTok...');
    console.log(`   URL: ${avatarUrl.substring(0, 80)}...`);

    const avatarResponse = await fetch(avatarUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    if (!avatarResponse.ok) {
      throw new Error(`Failed to download avatar: ${avatarResponse.status}`);
    }

    const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());
    console.log(`   ✅ Downloaded (${(avatarBuffer.length / 1024).toFixed(1)}KB)`);

    // Upload to Grove
    console.log('\n☁️  Uploading to Grove...');
    const { cid, url } = await uploadToGrove(avatarBuffer, `${creator.username}-avatar.jpg`);

    // Update database
    console.log('\n💾 Updating database...');
    await query(`
      UPDATE tiktok_creators
      SET grove_avatar_cid = $1,
          grove_avatar_url = $2,
          grove_avatar_uploaded_at = NOW()
      WHERE username = $3
    `, [cid, url, creator.username]);

    console.log('   ✅ Database updated');
    console.log(`\n✨ @${creator.username} avatar uploaded successfully!`);

  } catch (error: any) {
    console.error(`\n❌ Failed to process @${creator.username}:`);
    console.error(`   ${error.message}\n`);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string', default: '10' },
      username: { type: 'string' },
    },
  });

  const limit = parseInt(values.limit || '10');
  const username = values.username;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Upload TikTok Creator Avatars to Grove');
  console.log('═══════════════════════════════════════════════════════\n');

  // Query creators needing avatar upload
  let creators: CreatorToUpdate[];

  if (username) {
    // Process specific creator
    console.log(`🎯 Processing specific creator: @${username}\n`);
    creators = await query<CreatorToUpdate>(`
      SELECT username, nickname, avatar_url
      FROM tiktok_creators
      WHERE username = $1
        AND avatar_url IS NOT NULL
        AND grove_avatar_cid IS NULL
    `, [username]);

    if (creators.length === 0) {
      console.log(`❌ Creator @${username} not found or already processed\n`);
      process.exit(1);
    }
  } else {
    // Batch process
    creators = await query<CreatorToUpdate>(`
      SELECT username, nickname, avatar_url
      FROM tiktok_creators
      WHERE avatar_url IS NOT NULL
        AND grove_avatar_cid IS NULL
      ORDER BY username
      LIMIT $1
    `, [limit]);
  }

  if (creators.length === 0) {
    console.log('✅ No creators need avatar upload\n');
    console.log('All creators with avatars have been processed!\n');
    process.exit(0);
  }

  console.log(`Found ${creators.length} creator(s) to process\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const creator of creators) {
    try {
      await processCreator(creator);
      successCount++;
    } catch (error) {
      errorCount++;
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Summary');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`✅ Successfully uploaded: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);

  if (errorCount > 0) {
    console.log(`\n⚠️  ${errorCount} avatar(s) failed to upload.\n`);
    process.exit(1);
  } else {
    console.log(`\n🎉 All avatars uploaded successfully!\n`);
  }
}

// CLI execution
if (import.meta.main) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed:', error);
      process.exit(1);
    });
}

export { main as updateCreatorAvatars };
