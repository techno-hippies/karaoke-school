/**
 * Section Parser Service
 * Uses OpenRouter AI to segment lyrics into sections (Verse, Chorus, Bridge, etc.)
 */

import { config } from '../config.js'
import type { SongSection, LineWithWords, SectionParseResponse } from '../types.js'

/**
 * Parse lyrics into sections using OpenRouter AI
 */
export async function parseSections(
  lyrics: string,
  linesWithTimestamps: LineWithWords[]
): Promise<SongSection[]> {
  if (!config.apis.openRouter) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }

  console.log('🤖 Calling OpenRouter AI to identify song sections...')

  // Build numbered lyrics for AI prompt
  const lyricsLines = lyrics.split('\n').filter(line => line.trim())
  const numberedLyrics = lyricsLines
    .map((line, i) => `${i}: ${line}`)
    .join('\n')

  const prompt = `You are a music structure analyzer. Segment these lyrics into song sections for karaoke practice.

Lyrics (${lyricsLines.length} lines, numbered for reference):
${numberedLyrics}

Instructions:
1. Extract AT MOST 6 best segments for karaoke practice
2. Prioritize verses, choruses, bridge. Skip intros, outros, instrumentals
3. Labels: Verse 1, Verse 2, Verse 3, Verse 4, Chorus, Bridge
4. Use "Chorus" for all chorus repetitions (not Chorus 1, Chorus 2)
5. For each section, return the LINE NUMBER (0-based index) where it starts and ends
6. Example: if Verse 1 goes from line 5 to line 12, return startLine: 5, endLine: 12
7. Sections should not overlap
8. Lines without vocals (instrumental breaks) can be skipped`

  console.log(`   Analyzing ${lyricsLines.length} lines of lyrics...`)

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apis.openRouter}`,
      'Content-Type': 'application/json',
      'X-Title': 'Karaoke School Song Uploader',
      'HTTP-Referer': 'https://karaoke.school',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 2000,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'segment_lyrics',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              sections: {
                type: 'array',
                description: 'Song sections',
                items: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      description: 'Section label: Verse 1, Verse 2, Verse 3, Verse 4, Chorus, Bridge',
                    },
                    startLine: {
                      type: 'number',
                      description: 'Line index where section starts (0-based)',
                    },
                    endLine: {
                      type: 'number',
                      description: 'Line index where section ends (0-based, inclusive)',
                    },
                  },
                  required: ['type', 'startLine', 'endLine'],
                  additionalProperties: false,
                },
              },
            },
            required: ['sections'],
            additionalProperties: false,
          },
        },
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`OpenRouter error: ${data.error.message || JSON.stringify(data.error)}`)
  }

  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('No content in OpenRouter response')
  }

  const parsed: SectionParseResponse = JSON.parse(content)

  console.log(`✅ Identified ${parsed.sections.length} sections:`)
  parsed.sections.forEach(s => console.log(`   - ${s.type} (lines ${s.startLine}-${s.endLine})`))

  // Convert AI sections to SongSection with timestamps
  const sections: SongSection[] = parsed.sections.map((section, index) => {
    const startLine = linesWithTimestamps[section.startLine]
    const endLine = linesWithTimestamps[section.endLine]

    if (!startLine || !endLine) {
      throw new Error(
        `Invalid section range: lines ${section.startLine}-${section.endLine} (only ${linesWithTimestamps.length} lines available)`
      )
    }

    const startTime = startLine.start
    const endTime = endLine.end
    const duration = endTime - startTime

    // Generate section ID: "verse-1" -> "verse-1", "Chorus" -> "chorus-1", "chorus-2", etc.
    const baseId = section.type.toLowerCase().replace(/\s+/g, '-')
    const id = `${baseId}-${index + 1}`

    return {
      id,
      type: section.type,
      startTime,
      endTime,
      duration,
      lyricsStart: section.startLine,
      lyricsEnd: section.endLine,
    }
  })

  return sections
}

/**
 * Validate sections don't overlap and are in chronological order
 */
export function validateSections(sections: SongSection[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]

    // Check duration is positive
    if (section.duration <= 0) {
      errors.push(`Section ${section.id} has invalid duration: ${section.duration}`)
    }

    // Check chronological order
    if (i > 0) {
      const prevSection = sections[i - 1]
      if (section.startTime < prevSection.endTime) {
        errors.push(
          `Section ${section.id} overlaps with ${prevSection.id} (${section.startTime} < ${prevSection.endTime})`
        )
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
