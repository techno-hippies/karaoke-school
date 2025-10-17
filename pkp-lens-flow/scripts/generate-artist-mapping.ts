#!/usr/bin/env bun
/**
 * generate-artist-mapping.ts
 *
 * Auto-generates a TypeScript mapping file that maps Genius artist IDs
 * to Lens usernames for artists with PKP profiles.
 *
 * Usage:
 *   bun run scripts/generate-artist-mapping.ts
 *
 * Output:
 *   ../../app/src/lib/genius/artist-mapping.ts
 */

import fs from 'fs'
import path from 'path'

console.log('🎵 Generating Genius Artist → Lens Username Mapping\n')

// Paths
const lensDir = path.join(__dirname, '../data/lens')
const manifestsDir = path.join(__dirname, '../data/videos')
const outputPath = path.join(__dirname, '../../app/src/lib/genius/artist-mapping.ts')

// Ensure output directory exists
const outputDir = path.dirname(outputPath)
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// Build mapping
const mapping: Record<number, string> = {}
let artistCount = 0
let creatorCount = 0

// Read all lens profiles
const lensFiles = fs.readdirSync(lensDir).filter(f => f.endsWith('.json'))

console.log(`📂 Found ${lensFiles.length} Lens profiles\n`)

for (const file of lensFiles) {
  const handle = file.replace('.json', '')
  const manifestPath = path.join(manifestsDir, handle, 'manifest.json')

  // Skip if no manifest
  if (!fs.existsSync(manifestPath)) {
    console.log(`⚠️  ${handle} - No manifest found, skipping`)
    continue
  }

  // Read manifest
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  const geniusArtistId = manifest.profile?.geniusArtistId

  if (geniusArtistId && typeof geniusArtistId === 'number') {
    // This is an artist with a Genius ID
    const lensHandle = manifest.lensHandle?.replace('@', '') || handle
    mapping[geniusArtistId] = lensHandle.toLowerCase()
    artistCount++
    console.log(`✅ ${handle.padEnd(20)} → Genius ID ${geniusArtistId}`)
  } else {
    // This is a regular creator (no Genius artist ID)
    creatorCount++
    console.log(`👤 ${handle.padEnd(20)} → Creator (no Genius ID)`)
  }
}

console.log(`\n📊 Summary:`)
console.log(`   Artists:  ${artistCount}`)
console.log(`   Creators: ${creatorCount}`)
console.log(`   Total:    ${lensFiles.length}`)

// Generate TypeScript file
const timestamp = new Date().toISOString()
const code = `/**
 * Auto-generated mapping of Genius artist IDs to Lens usernames
 *
 * This file maps Genius artist IDs to Lens usernames for artists
 * who have PKP profiles. Artists without PKP profiles should use
 * the fallback /artist/:geniusArtistId route.
 *
 * Generated: ${timestamp}
 * Command: bun run generate-artist-mapping
 *
 * @see pkp-lens-flow/scripts/generate-artist-mapping.ts
 */

export const GENIUS_TO_LENS_USERNAME: Record<number, string> = ${JSON.stringify(mapping, null, 2)}

/**
 * Check if a Genius artist has a Lens profile (PKP)
 */
export function hasLensProfile(geniusArtistId: number): boolean {
  return geniusArtistId in GENIUS_TO_LENS_USERNAME
}

/**
 * Get Lens username for a Genius artist (if exists)
 * Returns null if artist doesn't have a PKP profile
 */
export function getLensUsername(geniusArtistId: number): string | null {
  return GENIUS_TO_LENS_USERNAME[geniusArtistId] || null
}

/**
 * Get the best route for an artist
 * - If artist has PKP profile: /u/:username (rich profile with videos + songs)
 * - If artist has no PKP: /artist/:geniusArtistId (Genius data only)
 */
export function getArtistRoute(geniusArtistId: number): string {
  const username = getLensUsername(geniusArtistId)
  return username ? \`/u/\${username}\` : \`/artist/\${geniusArtistId}\`
}
`

// Write file
fs.writeFileSync(outputPath, code, 'utf-8')

console.log(`\n✅ Generated mapping file`)
console.log(`   Path: ${outputPath}`)
console.log(`   Mappings: ${Object.keys(mapping).length}`)

if (artistCount === 0) {
  console.log(`\n⚠️  Warning: No artists found with geniusArtistId!`)
  console.log(`   Make sure to add geniusArtistId to manifest.json for artist profiles`)
  console.log(`   See: pkp-lens-flow/README.md (Step 3.5)`)
}

console.log(`\n🎉 Done!`)
