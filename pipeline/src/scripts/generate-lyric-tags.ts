#!/usr/bin/env bun
/**
 * Generate Lyric Tags Script
 *
 * Uses Gemini 2.5 Flash via OpenRouter to analyze song lyrics
 * and generate 3 psychographic tags describing emotional themes.
 *
 * Usage:
 *   bun src/scripts/generate-lyric-tags.ts --iswc=T0112199333
 *   bun src/scripts/generate-lyric-tags.ts --iswc=T0112199333 --dry-run
 */

import { parseArgs } from 'util';
import OpenAI from 'openai';
import { query, queryOne } from '../db/connection';
import { validateEnv } from '../config';
import type { Song, Lyric } from '../types';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});

const SYSTEM_PROMPT = `You are a music psychographic analyst. Your job is to analyze song lyrics and identify 3 emotional/psychological themes that describe what kind of person would resonate with this song.

These tags will be used to build user psychographic profiles based on their music preferences.

Rules:
- Return exactly 3 tags
- Tags should be lowercase
- Tags can be single words or hyphenated phrases (e.g., "self-empowerment")
- Focus on emotional themes, desires, and psychological states
- Avoid generic music terms like "love" or "song"

Example:
Song about being dangerously attracted to someone despite knowing they're bad for you, themes of intoxication and losing control:
→ ["seduction", "obsession", "danger"]

Song about overcoming hardship and believing in yourself:
→ ["resilience", "self-belief", "determination"]

Return ONLY a JSON array with exactly 3 strings, no other text.`;

async function main() {
  validateEnv(['DATABASE_URL', 'OPENROUTER_API_KEY']);

  if (!values.iswc) {
    console.error('❌ Missing required argument: --iswc');
    process.exit(1);
  }

  console.log('\n🏷️  Generating Lyric Tags');
  console.log(`   ISWC: ${values.iswc}`);

  // Get song
  const song = await queryOne<Song>(
    `SELECT * FROM songs WHERE iswc = $1`,
    [values.iswc]
  );

  if (!song) {
    console.error(`❌ Song not found: ${values.iswc}`);
    process.exit(1);
  }

  console.log(`   Song: ${song.title}`);

  // Get English lyrics
  const lyrics = await query<Lyric>(
    `SELECT text FROM lyrics WHERE song_id = $1 AND language = 'en' ORDER BY line_index`,
    [song.id]
  );

  if (lyrics.length === 0) {
    console.error(`❌ No English lyrics found for song`);
    process.exit(1);
  }

  const lyricsText = lyrics.map(l => l.text).join('\n');
  console.log(`   Lyrics: ${lyrics.length} lines`);

  // Call OpenRouter
  console.log('\n🤖 Analyzing with Gemini 2.5 Flash...');

  const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const completion = await openai.chat.completions.create({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Analyze these lyrics and return 3 psychographic tags:\n\n${lyricsText}` },
    ],
    temperature: 0.3,
  });

  const response = completion.choices[0]?.message?.content?.trim();
  if (!response) {
    console.error('❌ No response from AI');
    process.exit(1);
  }

  console.log(`   Raw response: ${response}`);

  // Parse JSON array (handle markdown code blocks)
  let tags: string[];
  try {
    let jsonStr = response;
    // Strip markdown code blocks if present
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    tags = JSON.parse(jsonStr);
    if (!Array.isArray(tags) || tags.length !== 3) {
      throw new Error('Expected array of 3 tags');
    }
  } catch (e) {
    console.error(`❌ Failed to parse response: ${e}`);
    process.exit(1);
  }

  console.log(`\n✅ Generated tags: ${tags.join(', ')}`);

  if (values['dry-run']) {
    console.log('\n🔸 DRY RUN - Not saving to database');
    process.exit(0);
  }

  // Update database
  console.log('\n💾 Saving to database...');
  await query(
    `UPDATE songs SET lyric_tags = $2 WHERE id = $1`,
    [song.id, tags]
  );

  console.log('   ✅ Saved');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
