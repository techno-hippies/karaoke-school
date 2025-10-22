#!/usr/bin/env bun
/**
 * Check tags for a specific Charli XCX post
 */

import { PublicClient, postId } from '@lens-protocol/client';
import { testnet } from '@lens-protocol/env';
import { fetchPost } from '@lens-protocol/client/actions';

async function checkPostTags() {
  const client = PublicClient.create({
    environment: testnet,
    origin: 'https://check-tags.local',
  });

  const POST_ID = '48475790563417459684938071873339243813744846633913390127389438551620104906510';

  console.log('\n🔍 Checking Charli XCX post tags...');
  console.log(`Post ID: ${POST_ID}\n`);

  const result = await fetchPost(client, {
    post: postId(POST_ID),
  });

  if (result.isErr()) {
    console.error('❌ Error fetching post:', result.error);
    return;
  }

  const post = result.value;

  if (!post) {
    console.log('❌ Post not found!');
    return;
  }

  console.log(`✅ Post found!`);
  console.log(`   ID: ${post.id}`);
  console.log(`   Author: ${post.author.username?.localName || post.author.address}`);

  if (post.metadata?.__typename === 'VideoMetadata') {
    const video = post.metadata;

    console.log(`   Title: ${video.title}`);
    console.log(`\n📌 TAGS:`);
    console.log(`   ${JSON.stringify(video.tags, null, 2)}`);

    const hasTags = video.tags || [];

    console.log('\n✅ Tag Verification:');
    console.log(`   ✓ karaoke:        ${hasTags.includes('karaoke') ? '✅ PRESENT' : '❌ MISSING'}`);
    console.log(`   ✓ tiktok:         ${hasTags.includes('tiktok') ? '✅ PRESENT' : '❌ MISSING'}`);
    console.log(`   ✓ copyright:      ${hasTags.includes('copyrighted') ? '✅ copyrighted' : hasTags.includes('copyright-free') ? '✅ copyright-free' : '❌ MISSING'}`);
    console.log(`   ✓ encryption:     ${hasTags.includes('encrypted') ? '✅ encrypted' : hasTags.includes('unencrypted') ? '✅ unencrypted' : '❌ MISSING'}`);
    console.log(`   ✓ licensed:       ${hasTags.includes('licensed') ? '✅ PRESENT' : '⚪ not present (optional)'}`);
    console.log(`   ✓ genius:         ${hasTags.includes('genius') ? '✅ PRESENT' : '⚪ not present (optional)'}`);

    // Check attributes
    const copyrightAttr = video.attributes?.find(a => a.key === 'copyright_type');
    const unlockLock = video.attributes?.find(a => a.key === 'unlock_lock');
    const geniusId = video.attributes?.find(a => a.key === 'genius_id');

    console.log('\n📋 Key Attributes:');
    console.log(`   copyright_type: ${copyrightAttr?.value || 'N/A'}`);
    console.log(`   unlock_lock: ${unlockLock?.value || 'N/A'}`);
    console.log(`   genius_id: ${geniusId?.value || 'N/A'}`);

    console.log('\n🎯 Feed Filtering Ready:');
    const canFilterCopyrightFree = hasTags.includes('copyright-free');
    const canFilterCopyrighted = hasTags.includes('copyrighted');
    const canFilterEncrypted = hasTags.includes('encrypted');

    if (canFilterCopyrightFree) {
      console.log('   ✅ Can appear in copyright-free feed: tags: { all: ["copyright-free"] }');
    } else if (canFilterCopyrighted) {
      console.log('   ✅ Can appear in copyrighted feed: tags: { all: ["copyrighted"] }');
    }

    if (canFilterEncrypted) {
      console.log('   ✅ Can filter by encryption: tags: { all: ["encrypted"] }');
    }

    if (hasTags.includes('karaoke')) {
      console.log('   ✅ Can filter by karaoke: tags: { all: ["karaoke"] }');
    }

  } else {
    console.log('❌ Not a video post!');
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

checkPostTags().catch(console.error);
