#!/usr/bin/env bun
/**
 * Step 1.5: Upload Profile Avatar to Grove
 *
 * Uploads the TikTok profile avatar to Grove storage before creating Lens account.
 * This allows the Lens account to be created with the real avatar URI from the start.
 *
 * Prerequisites:
 * - Manifest from Step 2 (TikTok crawler) with downloaded avatar
 *
 * Usage:
 *   bun run upload-profile-avatar --creator @charlidamelio
 *
 * Output:
 *   Updated manifest with avatar Grove URI in profile.groveUris.avatar
 */

import { StorageClient, immutable } from '@lens-chain/storage-client';
import { chains } from '@lens-chain/sdk/viem';
import { readFile, writeFile } from 'fs/promises';
import { parseArgs } from 'util';
import path from 'path';

// Parse CLI args
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    creator: { type: 'string', short: 'c' },
  },
});

interface Manifest {
  tiktokHandle: string;
  profile: {
    nickname: string;
    bio: string;
    bioTranslations?: Record<string, string>;
    stats: any;
    localFiles: {
      avatar: string | null;
    };
    groveUris: {
      metadata: string | null;
      avatar: string | null;
    };
  };
}

async function uploadProfileAvatar(tiktokHandle: string): Promise<void> {
  console.log('\n🖼️  Step 1.5: Upload Profile Avatar to Grove');
  console.log('═══════════════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // 1. Load manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  console.log(`📂 Loading manifest: ${manifestPath}`);

  const manifestRaw = await readFile(manifestPath, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestRaw);

  console.log(`✅ Profile: ${manifest.profile.nickname}`);

  // 2. Check if avatar exists locally
  const avatarPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'avatar.jpg');
  const avatarFile = Bun.file(avatarPath);

  if (!(await avatarFile.exists())) {
    console.log(`\n❌ Error: Avatar file not found at ${avatarPath}`);
    console.log('   Make sure you ran the TikTok crawler first.');
    process.exit(1);
  }

  console.log(`📸 Found avatar: ${avatarPath}\n`);

  // 3. Create Storage Client
  console.log('☁️  Connecting to Grove storage...');
  const storageClient = StorageClient.create();
  console.log('✅ Connected\n');

  // 4. Upload avatar with immutable ACL (public, anyone can view)
  console.log('📤 Uploading avatar to Grove...');
  const uploadResult = await storageClient.uploadFile(avatarFile, {
    name: `${cleanHandle}-avatar.jpg`,
    acl: immutable(chains.testnet.id),
  });

  manifest.profile.groveUris.avatar = uploadResult.uri;
  console.log(`✅ Avatar uploaded: ${uploadResult.uri}\n`);

  // 5. Save updated manifest
  console.log('💾 Updating manifest...');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✅ Manifest updated: ${manifestPath}\n`);

  // 6. Summary
  console.log('═══════════════════════════════════════════════');
  console.log('[bold green]✨ Upload Complete![/bold green]');
  console.log(`\n📊 Summary:`);
  console.log(`   Avatar URI: ${uploadResult.uri}`);
  console.log(`\n⚠️  Next Step:`);
  console.log(`   Create Lens account with avatar URI:`);
  console.log(`   bun run create-lens --creator ${tiktokHandle}`);
  console.log('');
}

async function main() {
  try {
    const creator = values.creator;

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run upload-profile-avatar --creator @charlidamelio\n');
      process.exit(1);
    }

    await uploadProfileAvatar(creator);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
