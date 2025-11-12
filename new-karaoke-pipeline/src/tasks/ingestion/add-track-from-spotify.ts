#!/usr/bin/env bun
/**
 * Manual Track Ingestion from Spotify
 *
 * Adds songs directly from Spotify without requiring TikTok discovery.
 * Bypasses TikTok pipeline but uses the same enrichment & audio processing.
 *
 * Features:
 * - Validates Spotify track exists and is valid
 * - Seeds initial download task (so audio worker picks it up)
 * - Spawns enrichment task fan-out
 * - Logs submission metadata for audit trail
 * - Protects against duplicate submissions
 *
 * Prerequisites:
 * - SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables
 * - Neon database with new source_type column
 *
 * Usage:
 *   # Add single track
 *   bun src/tasks/ingestion/add-track-from-spotify.ts --spotifyId=3n3Ppam7vgaVa1iaRUc9Lp
 *
 *   # Add batch from file (newline-separated Spotify IDs)
 *   bun src/tasks/ingestion/add-track-from-spotify.ts --file=spotify_ids.txt
 *
 *   # Add batch from stdin
 *   cat spotify_ids.txt | bun src/tasks/ingestion/add-track-from-spotify.ts --batch
 */

import "../../env";

import { query } from "../../db/connection";
import { createEnrichmentTask } from "../../db/queries";
import { getTrack } from "../../services/spotify";
import type { SpotifyTrackInfo } from "../../services/spotify";
import { ensureAudioTask } from "../../db/audio-tasks";
import { AudioTaskType } from "../../db/task-stages";
import { upsertSpotifyTrackSQL, upsertSpotifyArtistSQL } from "../../db/spotify";
import { readFileSync, existsSync } from "fs";
import { createInterface } from "readline";
import { ManualSpotifyTrackSchema } from "../../schemas/manual-track";

interface ManualTrackSubmission {
  spotify_id: string;
  submitted_via: "cli" | "api";
  submitted_at: string;
  user_notes?: string;
}

type AddTrackOutcome = "created" | "refreshed" | "skipped" | "failed";

function extractAlbumName(album: SpotifyTrackInfo["album"], fallbackTitle: string): string {
  if (typeof album === "string") {
    return album;
  }
  return album?.name ?? fallbackTitle;
}

function extractAlbumImage(
  album: SpotifyTrackInfo["album"],
  fallbackImage: string | null
): string | null {
  if (typeof album === "object" && album) {
    return album.image_url ?? fallbackImage;
  }
  return fallbackImage;
}

/**
 * Validate Spotify track exists and extract metadata
 */
async function validateSpotifyTrack(
  spotifyId: string
): Promise<{
  title: string;
  artists: Array<{ id: string; name: string }>;
  album: string;
  release_date: string | null;
  duration_ms: number;
  isrc: string | null;
  image_url?: string;
  spotify_url: string;
} | null> {
  try {
    const trackInfo = await getTrack(spotifyId);
    return trackInfo ? { ...trackInfo, spotify_url: `https://open.spotify.com/track/${spotifyId}` } : null;
  } catch (error) {
    console.error(`   ❌ Spotify API error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Check if track already exists in database
 */
async function trackExists(spotifyId: string): Promise<boolean> {
  const result = await query(
    "SELECT 1 FROM tracks WHERE spotify_track_id = $1",
    [spotifyId]
  );
  return result.length > 0;
}

/**
 * Insert manual Spotify track into pipeline
 */
async function insertManualTrack(
  spotifyId: string,
  trackData: Awaited<ReturnType<typeof validateSpotifyTrack>>,
  userNotes: string | undefined,
  options: { alreadyExists: boolean }
): Promise<AddTrackOutcome> {
  try {
    if (!trackData) return "failed";

    const artists = Array.isArray(trackData.artists)
      ? trackData.artists
      : JSON.parse(trackData.artists as any);

    const albumName = extractAlbumName(trackData.album, trackData.title);
    const albumImage = extractAlbumImage(trackData.album, trackData.image_url);

    const manualValidation = ManualSpotifyTrackSchema.safeParse({
      spotify_track_id: spotifyId,
      title: trackData.title,
      album: albumName,
      image_url: albumImage,
      artists,
    });

    if (!manualValidation.success) {
      console.error("   ❌ Spotify response is missing required metadata for ingestion:");
      for (const issue of manualValidation.error.issues) {
        console.error(`      • ${issue.path.join(".") || "field"}: ${issue.message}`);
      }
      console.error("      Cannot continue until the album art requirement is satisfied.");
      return "failed";
    }

    const albumMetadata = {
      name: albumName,
      image_url: albumImage,
    };

    // Upsert Spotify track cache (so downstream joins work)
    const trackUpsertSQL = upsertSpotifyTrackSQL({
      spotify_track_id: spotifyId,
      title: trackData.title,
      artists: artists,
      album: albumMetadata,
      isrc: trackData.isrc,
      duration_ms: trackData.duration_ms,
      release_date: trackData.release_date,
      popularity: undefined,
      preview_url: undefined,
      external_urls: undefined,
    });
    await query(trackUpsertSQL);

    // Upsert Spotify artists cache
    for (const artist of artists) {
      const artistUpsertSQL = upsertSpotifyArtistSQL({
        spotify_artist_id: artist.id,
        name: artist.name,
        genres: [],
        popularity: 0,
        followers: 0,
        image_url: undefined,
        external_urls: undefined,
      });
      await query(artistUpsertSQL);
    }

    console.log(`   ✅ Spotify cache updated (track + ${artists.length} artist(s))`);

    if (options.alreadyExists) {
      console.log("   ♻️  Track already existed – refreshed Spotify metadata only.");
      return "refreshed";
    }

    // Insert track into pipeline
    await query(
      `INSERT INTO tracks (
        spotify_track_id,
        tiktok_video_id,
        title,
        artists,
        album_name,
        release_date,
        duration_ms,
        isrc,
        primary_artist_id,
        primary_artist_name,
        source_type,
        stage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (spotify_track_id) DO NOTHING`,
      [
        spotifyId,
        null, // tiktok_video_id is NULL for manual tracks
        trackData.title,
        JSON.stringify(artists),
        albumName,
        trackData.release_date || null,
        trackData.duration_ms,
        trackData.isrc || null,
        artists[0]?.id || null,
        artists[0]?.name || null,
        "manual_spotify",
        "pending",
      ]
    );

    console.log(`   ✅ Track inserted: ${trackData.title} by ${artists[0]?.name}`);

    // Seed initial download task (so audio worker picks it up)
    await ensureAudioTask(spotifyId, AudioTaskType.Download, "track");
    console.log(`   📥 Download task queued`);

    // Spawn enrichment task fan-out
    const enrichmentTypes = [
      "iswc_discovery",
      "musicbrainz",
      "genius_songs",
      "genius_artists",
      "wikidata_works",
      "wikidata_artists",
      "quansic_artists",
      "lyrics_discovery",
      "spotify_artists",
    ];

    for (const taskType of enrichmentTypes) {
      await createEnrichmentTask(spotifyId, taskType);
    }

    console.log(`   📋 Spawned ${enrichmentTypes.length} enrichment tasks`);

    // Log submission for audit trail
    const submission: ManualTrackSubmission = {
      spotify_id: spotifyId,
      submitted_via: "cli",
      submitted_at: new Date().toISOString(),
      user_notes: userNotes,
    };

    // Store in metadata (optional: could use separate table for compliance)
    await query(
      `UPDATE tracks SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{manual_submission}', $1::jsonb)
       WHERE spotify_track_id = $2`,
      [JSON.stringify(submission), spotifyId]
    );

    return "created";
  } catch (error) {
    console.error(`   ❌ Insert error: ${error instanceof Error ? error.message : String(error)}`);
    return "failed";
  }
}

/**
 * Process single Spotify track
 */
async function addTrack(
  spotifyId: string,
  userNotes: string | undefined,
  options: { refreshExisting: boolean }
): Promise<AddTrackOutcome> {
  console.log(`\n🎵 Processing: ${spotifyId}`);

  const alreadyExists = await trackExists(spotifyId);
  if (alreadyExists && !options.refreshExisting) {
    console.log(`   ⏭️  Already in database (use --refresh to update Spotify metadata)`);
    return "skipped";
  }

  // Validate with Spotify API
  console.log(`   🔍 Validating with Spotify...`);
  const trackData = await validateSpotifyTrack(spotifyId);

  if (!trackData) {
    console.log(`   ❌ Not found on Spotify or invalid`);
    return "failed";
  }

  console.log(`   📊 Found: "${trackData.title}" by ${trackData.artists[0]?.name}`);
  console.log(`      ISRC: ${trackData.isrc || "N/A"}`);
  console.log(`      Duration: ${Math.round(trackData.duration_ms / 1000)}s`);

  // Insert / refresh
  return insertManualTrack(spotifyId, trackData, userNotes, { alreadyExists });
}

/**
 * Main entry point
 */
async function main() {
  console.log("🎧 Manual Spotify Track Ingestion\n");

  const args = process.argv.slice(2);

  let spotifyIds: string[] = [];
  let userNotes: string | undefined;
  let refreshExisting = false;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--spotifyId" || args[i].startsWith("--spotifyId=")) && args[i + 1]) {
      spotifyIds.push(args[i + 1]);
      i++;
    } else if (args[i].startsWith("--spotifyId=")) {
      spotifyIds.push(args[i].substring("--spotifyId=".length));
    } else if (args[i] === "--file" && args[i + 1]) {
      const filePath = args[i + 1];
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, "utf-8");
        spotifyIds = content
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#")); // Support comments
        console.log(`📄 Loaded ${spotifyIds.length} IDs from ${filePath}\n`);
      } else {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
      }
      i++;
    } else if (args[i].startsWith("--file=")) {
      const filePath = args[i].substring("--file=".length);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, "utf-8");
        spotifyIds = content
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#")); // Support comments
        console.log(`📄 Loaded ${spotifyIds.length} IDs from ${filePath}\n`);
      } else {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
      }
    } else if (args[i] === "--batch") {
      // Read from stdin (one ID per line)
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      spotifyIds = await new Promise((resolve) => {
        const ids: string[] = [];
        rl.on("line", (line) => {
          const id = line.trim();
          if (id && !id.startsWith("#")) {
            ids.push(id);
          }
        });
        rl.on("close", () => resolve(ids));
      });

      console.log(`\n📄 Loaded ${spotifyIds.length} IDs from stdin\n`);
    } else if (args[i] === "--notes" && args[i + 1]) {
      userNotes = args[i + 1];
      i++;
    } else if (args[i] === "--refresh") {
      refreshExisting = true;
    }
  }

  if (spotifyIds.length === 0) {
    console.error("❌ No Spotify IDs provided");
    console.log("Usage:");
    console.log("  bun src/tasks/ingestion/add-track-from-spotify.ts --spotifyId=<ID>");
    console.log("  bun src/tasks/ingestion/add-track-from-spotify.ts --file=ids.txt");
    console.log("  cat ids.txt | bun src/tasks/ingestion/add-track-from-spotify.ts --batch");
    console.log("  bun src/tasks/ingestion/add-track-from-spotify.ts --refresh --spotifyId=<ID>");
    process.exit(1);
  }

  // Process tracks
  let created = 0;
  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  for (const id of spotifyIds) {
    try {
      const outcome = await addTrack(id, userNotes, { refreshExisting });

      switch (outcome) {
        case "created":
          created++;
          break;
        case "refreshed":
          refreshed++;
          break;
        case "skipped":
          skipped++;
          break;
        case "failed":
        default:
          failed++;
          break;
      }
    } catch (error) {
      console.error(`   ❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Summary
  console.log("\n📊 Summary:");
  console.log(`   ✅ Created: ${created}`);
  if (refreshExisting) {
    console.log(`   ♻️  Refreshed: ${refreshed}`);
  }
  console.log(`   ⏭️  Skipped (already exists): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log("");

  // Show next steps
  if (created > 0 || refreshed > 0) {
    console.log("🚀 Next Steps:");
    console.log(`   1. Monitor enrichment tasks: bun src/tasks/enrichment/processor.ts --limit=10`);
    console.log(`   2. Start audio download worker: bun src/tasks/audio/download-audio.ts --limit=5`);
    console.log(`   3. Track progress: SELECT source_type, stage, COUNT(*) FROM tracks GROUP BY source_type, stage`);
    if (refreshed > 0) {
      console.log(`   4. Re-run GRC-20 sync: bun src/tasks/grc20/populate-source-facts.ts && bun src/tasks/grc20/populate-grc20.ts`);
    }
    console.log("");
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
