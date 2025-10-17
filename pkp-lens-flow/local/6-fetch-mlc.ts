#!/usr/bin/env bun
/**
 * Step 5: Fetch MLC Song Codes
 *
 * Searches MLC public API using ISRCs to get song codes and rights data
 * Based on: https://api.ptl.themlc.com/api2v/public/search/works
 *
 * Prerequisites:
 * - Manifest with ISRCs (data/videos/{handle}/manifest.json)
 *
 * Usage:
 *   bun run fetch-mlc --creator @charlidamelio
 *
 * Output:
 *   Updated manifest with MLC song codes and rights data
 */

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

interface MLCRecording {
  id: string;
  isrc: string;
  recordingTitle: string;
  recordingDisplayArtistName: string;
  writers?: string;
  hfaSongCode?: string;
}

interface MLCWriter {
  ipi: string;
  name: string;
  role: string;
}

interface MLCPublisher {
  ipId: number;
  publisherName: string;
  ipiNumber: string | null;
  publisherShare: number;
  administratorPublishers: {
    ipId: number;
    publisherName: string;
    ipiNumber: string;
    publisherShare: number;
  }[];
  writers: any[];
  [key: string]: any;
}

interface MLCWork {
  id: number;
  title: string;
  songCode: string;
  iswc: string | null;
  matchedRecordings: {
    count: number;
    recordings: MLCRecording[];
  };
  writers: MLCWriter[];
  originalPublishers: MLCPublisher[];
}

interface MLCSearchResponse {
  content: MLCWork[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

interface VideoData {
  postId: string;
  music: {
    title: string;
    spotify?: {
      isrc?: string;
      metadata?: any;
      fetchedAt?: string;
    };
    mlc?: {
      songCode?: string;
      title?: string;
      writers?: MLCWriter[];
      originalPublishers?: MLCPublisher[];
      matchedRecording?: MLCRecording;
      fetchedAt?: string;
    };
  };
  [key: string]: any;
}

interface Manifest {
  videos: VideoData[];
  [key: string]: any;
}

class MLCSearcher {
  private baseUrl = 'https://api.ptl.themlc.com/api2v/public/search/works';

  async searchByTitle(title: string, page: number = 0, size: number = 10): Promise<MLCSearchResponse | null> {
    const url = `${this.baseUrl}?page=${page}&size=${size}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title,
        }),
      });

      if (!response.ok) {
        console.error(`   ❌ MLC API error: ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error: any) {
      console.error(`   ❌ MLC search failed: ${error.message}`);
      return null;
    }
  }

  findWorkByISRC(response: MLCSearchResponse, isrc: string): MLCWork | null {
    for (const work of response.content) {
      const recordings = work.matchedRecordings?.recordings || [];
      const match = recordings.find(r => r.isrc === isrc);
      if (match) {
        return work;
      }
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async searchByISRC(isrc: string, title: string): Promise<MLCWork | null> {
    console.log(`   🔍 Searching MLC for: ${title}`);

    // Search by title first
    const response = await this.searchByTitle(title, 0, 50);

    if (!response) {
      return null;
    }

    console.log(`   • Found ${response.content.length} works`);

    // Find work that matches ISRC
    const work = this.findWorkByISRC(response, isrc);

    if (work) {
      console.log(`   • ✅ Matched ISRC in work: ${work.title} (${work.songCode})`);
      return work;
    }

    // If not found in first page, try more pages
    if (response.totalPages > 1) {
      console.log(`   • Searching additional pages...`);

      for (let page = 1; page < Math.min(response.totalPages, 5); page++) {
        await this.sleep(500); // Be respectful

        const nextResponse = await this.searchByTitle(title, page, 50);
        if (!nextResponse) continue;

        const nextWork = this.findWorkByISRC(nextResponse, isrc);
        if (nextWork) {
          console.log(`   • ✅ Matched ISRC in work: ${nextWork.title} (${nextWork.songCode})`);
          return nextWork;
        }
      }
    }

    console.log(`   • ⚠️  No matching work found for ISRC`);
    return null;
  }
}

/**
 * Calculate total publisher shares including both direct and administrator shares
 */
function calculateTotalPublisherShares(publishers: MLCPublisher[]): {
  total: number;
  breakdown: { direct: number; admin: number };
} {
  let directShare = 0;
  let adminShare = 0;

  for (const pub of publishers) {
    // Add direct publisher share
    directShare += pub.publisherShare || 0;

    // Add administrator shares (nested)
    if (pub.administratorPublishers && pub.administratorPublishers.length > 0) {
      for (const admin of pub.administratorPublishers) {
        adminShare += admin.publisherShare || 0;
      }
    }
  }

  return {
    total: directShare + adminShare,
    breakdown: { direct: directShare, admin: adminShare },
  };
}

/**
 * Validates if MLC data is complete enough for Story Protocol minting
 * Requirements:
 * - Total publisher shares (direct + admin) must be ≥98%
 * - Writers must be listed (even if shares are 0)
 */
function validateMLCForStoryMint(work: MLCWork): {
  mintable: boolean;
  reason: string;
  totalShare: number;
  breakdown: { direct: number; admin: number };
} {
  // Calculate total publisher shares
  const shares = calculateTotalPublisherShares(work.originalPublishers);

  // Check if we have writers listed
  if (work.writers.length === 0) {
    return {
      mintable: false,
      reason: 'No writers listed',
      totalShare: shares.total,
      breakdown: shares.breakdown,
    };
  }

  // Check if total shares meet threshold (≥98%)
  if (shares.total < 98) {
    return {
      mintable: false,
      reason: `Incomplete share data (${shares.total.toFixed(2)}%, need ≥98%)`,
      totalShare: shares.total,
      breakdown: shares.breakdown,
    };
  }

  // Success
  return {
    mintable: true,
    reason: `Complete (${shares.total.toFixed(2)}%)`,
    totalShare: shares.total,
    breakdown: shares.breakdown,
  };
}

async function fetchMLCData(tiktokHandle: string): Promise<void> {
  console.log('\n🎵 Step 5: Fetch MLC Song Codes');
  console.log('═══════════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // 1. Load manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  console.log(`📂 Loading manifest: ${manifestPath}`);

  const manifestRaw = await readFile(manifestPath, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestRaw);

  const videos = manifest.videos;
  console.log(`   Found ${videos.length} videos\n`);

  // 2. Create searcher
  const searcher = new MLCSearcher();

  // 3. Process videos
  console.log('🔍 Fetching MLC data...\n');

  let foundCount = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const isrc = video.music.spotify?.isrc;
    const title = video.music.title;

    console.log(`   Video ${i + 1}/${videos.length}: ${title}`);

    if (!isrc) {
      console.log(`   ⚠️  No ISRC available\n`);
      continue;
    }

    console.log(`   • ISRC: ${isrc}`);

    // Search MLC
    const work = await searcher.searchByISRC(isrc, title);

    if (work) {
      // Find the specific recording that matched
      const matchedRecording = work.matchedRecordings.recordings.find(r => r.isrc === isrc);

      // Validate for Story Protocol minting
      const validation = validateMLCForStoryMint(work);

      // Add to video
      if (!video.music.mlc) {
        video.music.mlc = {};
      }

      video.music.mlc.songCode = work.songCode;
      video.music.mlc.iswc = work.iswc;
      video.music.mlc.title = work.title;
      video.music.mlc.writers = work.writers;
      video.music.mlc.originalPublishers = work.originalPublishers;
      video.music.mlc.matchedRecording = matchedRecording;
      video.music.mlc.fetchedAt = new Date().toISOString();

      // Add validation results
      video.music.mlc.storyMintable = validation.mintable;
      video.music.mlc.storyMintableReason = validation.reason;
      video.music.mlc.totalPublisherShare = validation.totalShare;
      video.music.mlc.publisherShareBreakdown = validation.breakdown;

      console.log(`   • Song Code: ${work.songCode}`);
      console.log(`   • ISWC: ${work.iswc || 'N/A'}`);
      console.log(`   • Writers: ${work.writers.length} listed`);
      console.log(`   • Publishers: ${work.originalPublishers.length} (direct: ${validation.breakdown.direct.toFixed(2)}%, admin: ${validation.breakdown.admin.toFixed(2)}%)`);
      console.log(`   • Total Share: ${validation.totalShare.toFixed(2)}%`);
      console.log(`   • Story Mintable: ${validation.mintable ? '✅ YES' : '❌ NO'} - ${validation.reason}\n`);

      if (validation.mintable) {
        foundCount++;
      }
    } else {
      // No MLC work found
      if (!video.music.mlc) {
        video.music.mlc = {};
      }
      video.music.mlc.storyMintable = false;
      video.music.mlc.storyMintableReason = 'No MLC work found for ISRC';
      console.log('');
    }

    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 4. Save updated manifest
  console.log('💾 Saving updated manifest...');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   ✅ Manifest updated: ${manifestPath}\n`);

  // 5. Summary
  console.log('═══════════════════════════════════════════');
  console.log('✨ MLC Fetch Complete!');
  console.log(`\n📊 Summary:`);
  console.log(`   MLC works found: ${videos.filter(v => v.music.mlc?.songCode).length}/${videos.length}`);
  console.log(`   Story-mintable (≥98% shares): ${foundCount}/${videos.length}`);

  // Show unmintable videos
  const unmintable = videos.filter(v => v.music.mlc && !v.music.mlc.storyMintable);
  if (unmintable.length > 0) {
    console.log(`\n⚠️  ${unmintable.length} video(s) not Story-mintable:`);
    unmintable.forEach(v => {
      const reason = v.music.mlc?.storyMintableReason || 'Unknown';
      const share = v.music.mlc?.totalPublisherShare;
      console.log(`   • "${v.music.title}": ${reason}${share !== undefined ? ` (${share.toFixed(2)}%)` : ''}`);
    });
  }

  console.log(`\n💡 Tip: Only videos with storyMintable=true can be minted to Story Protocol`);
  console.log('');
}

async function main() {
  try {
    const creator = values.creator;

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run fetch-mlc --creator @charlidamelio\n');
      process.exit(1);
    }

    await fetchMLCData(creator);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
