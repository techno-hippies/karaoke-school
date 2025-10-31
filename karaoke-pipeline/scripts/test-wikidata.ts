#!/usr/bin/env bun
/**
 * Test script to explore Wikidata API responses
 *
 * Usage:
 *   bun scripts/test-wikidata.ts Q42007106  # Billie Eilish
 *   bun scripts/test-wikidata.ts Q42        # Douglas Adams
 */

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

async function getWikidataEntity(wikidataId: string) {
  const url = new URL(WIKIDATA_API);
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('ids', wikidataId);
  url.searchParams.set('props', 'labels|descriptions|aliases|claims|sitelinks');
  url.searchParams.set('languages', 'en|zh|es|fr|de|ja|ko|pt|ru|ar');  // Top 10 languages
  url.searchParams.set('format', 'json');

  console.log(`\n📡 Fetching Wikidata entity: ${wikidataId}`);
  console.log(`🔗 URL: ${url.toString()}\n`);

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'KaraokePipeline/1.0 (test script)'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.entities[wikidataId];
}

function extractMusicIdentifiers(claims: any): Record<string, any> {
  // Music-specific properties from Wikidata
  const MUSIC_PROPERTIES = {
    // Industry IDs
    'P434': 'musicbrainz_artist_id',
    'P1953': 'discogs_artist_id',
    'P2850': 'spotify_artist_id',
    'P4862': 'amazon_music_artist_id',
    'P3283': 'bandcamp_artist_id',
    'P3040': 'soundcloud_id',

    // Social Media
    'P2002': 'twitter_username',
    'P2003': 'instagram_username',
    'P4003': 'facebook_id',
    'P2397': 'youtube_channel_id',
    'P2850': 'weibo_id',
    'P3267': 'vk_id',
    'P7085': 'tiktok_username',

    // Libraries & Archives
    'P214': 'viaf_id',
    'P227': 'gnd_id',             // German National Library
    'P5361': 'bnf_id',            // French National Library
    'P244': 'loc_id',             // Library of Congress
    'P396': 'sbn_id',             // Italian National Library
    'P906': 'selibr_id',          // Swedish National Library
    'P1015': 'bnmm_id',           // Spanish National Library

    // Music Databases
    'P1728': 'allmusic_artist_id',
    'P1902': 'spotify_artist_id_old',
    'P5830': 'whosampled_artist_id',
    'P10600': 'rateyourmusic_artist_id',
    'P3453': 'smdb_artist_id',

    // Media
    'P345': 'imdb_id',
    'P2949': 'wikitree_id',
    'P2605': 'czfilm_person_id',

    // Other
    'P1254': 'last_fm_artist_id',
    'P435': 'musicbrainz_artist_id',  // Duplicate check
    'P4104': 'carnegie_hall_agent_id',
  };

  const identifiers: Record<string, any> = {};

  for (const [propId, key] of Object.entries(MUSIC_PROPERTIES)) {
    if (claims[propId]) {
      const values = claims[propId].map((claim: any) => {
        const mainsnak = claim.mainsnak;
        if (mainsnak.datavalue) {
          // Handle different data types
          if (typeof mainsnak.datavalue.value === 'string') {
            return mainsnak.datavalue.value;
          } else if (mainsnak.datavalue.value.id) {
            // Entity reference
            return mainsnak.datavalue.value.id;
          } else {
            return mainsnak.datavalue.value;
          }
        }
        return null;
      }).filter(Boolean);

      if (values.length > 0) {
        identifiers[key] = values.length === 1 ? values[0] : values;
      }
    }
  }

  return identifiers;
}

async function main() {
  const args = process.argv.slice(2);
  const wikidataId = args[0] || 'Q42007106';  // Default: Billie Eilish

  try {
    const entity = await getWikidataEntity(wikidataId);

    if (!entity) {
      console.error('❌ Entity not found');
      process.exit(1);
    }

    console.log('✅ Entity retrieved successfully\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Labels
    console.log('📛 LABELS (names in different languages):');
    if (entity.labels) {
      for (const [lang, label] of Object.entries(entity.labels)) {
        console.log(`   ${lang}: ${(label as any).value}`);
      }
    }
    console.log('');

    // Descriptions
    console.log('📝 DESCRIPTIONS:');
    if (entity.descriptions) {
      for (const [lang, desc] of Object.entries(entity.descriptions)) {
        console.log(`   ${lang}: ${(desc as any).value}`);
      }
    }
    console.log('');

    // Aliases
    console.log('🔖 ALIASES (alternative names):');
    if (entity.aliases) {
      for (const [lang, aliases] of Object.entries(entity.aliases)) {
        const names = (aliases as any[]).map(a => a.value).join(', ');
        console.log(`   ${lang}: ${names}`);
      }
    }
    console.log('');

    // Extract identifiers
    const identifiers = extractMusicIdentifiers(entity.claims || {});
    console.log('🎵 MUSIC IDENTIFIERS:');
    if (Object.keys(identifiers).length > 0) {
      for (const [key, value] of Object.entries(identifiers)) {
        console.log(`   ${key}: ${JSON.stringify(value)}`);
      }
    } else {
      console.log('   (none found)');
    }
    console.log('');

    // Sitelinks (Wikipedia pages)
    console.log('🌍 SITELINKS (Wikipedia pages):');
    if (entity.sitelinks) {
      const sites = Object.entries(entity.sitelinks).slice(0, 10);  // First 10
      for (const [site, link] of sites) {
        console.log(`   ${site}: ${(link as any).title}`);
      }
      if (Object.keys(entity.sitelinks).length > 10) {
        console.log(`   ... and ${Object.keys(entity.sitelinks).length - 10} more`);
      }
    }
    console.log('');

    // Full claims count
    console.log('📊 STATISTICS:');
    console.log(`   Total properties: ${Object.keys(entity.claims || {}).length}`);
    console.log(`   Languages with labels: ${Object.keys(entity.labels || {}).length}`);
    console.log(`   Wikipedia articles: ${Object.keys(entity.sitelinks || {}).length}`);
    console.log('');

    // Save full response for inspection
    const filename = `/tmp/wikidata-${wikidataId}.json`;
    await Bun.write(filename, JSON.stringify(entity, null, 2));
    console.log(`💾 Full response saved to: ${filename}`);
    console.log('');

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('✨ Test completed successfully!\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
