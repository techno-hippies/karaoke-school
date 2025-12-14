/**
 * useTranslations Hook
 *
 * Fetches lyric translations from TranslationEvents via the subgraph.
 * These are separate from inline *_text fields in clip metadata.
 *
 * Priority when displaying translations:
 * 1. TranslationEvents (this hook) - allows updates without re-emitting clips
 * 2. Inline *_text fields in karaoke_lines - legacy/fallback
 *
 * Usage:
 *   const translations = useTranslations(() => clip?.translations)
 *   const jaLines = translations.getLines('ja')
 */

import { createQueries } from '@tanstack/solid-query'
import { createMemo } from 'solid-js'
import { buildManifest, fetchJson } from '@/lib/storage'

/**
 * Translation metadata from Grove (matches pipeline schema)
 */
export interface TranslationMetadata {
  version: string
  clipHash: string
  spotifyTrackId: string
  iswc?: string
  languageCode: string
  languageName: string
  generatedAt: string
  model?: string
  validated: boolean
  lines: TranslationLine[]
  lineCount: number
}

export interface TranslationLine {
  line_index: number
  text: string
  words?: Array<{
    text: string
    start_ms: number
    end_ms: number
  }>
}

/**
 * Translation reference from subgraph
 */
export interface TranslationRef {
  languageCode: string
  translationUri: string
}

/**
 * Loaded translation with metadata
 */
export interface LoadedTranslation {
  languageCode: string
  metadata: TranslationMetadata
  lines: TranslationLine[]
}

/**
 * Hook to fetch and cache translations from TranslationEvents
 *
 * @param translationsAccessor - Accessor for translation refs from clip query
 * @returns Object with methods to access translations
 */
export function useTranslations(
  translationsAccessor: () => TranslationRef[] | undefined
) {
  // Create queries for each translation
  const translationQueries = createQueries(() => {
    const translations = translationsAccessor() || []
    return {
      queries: translations.map((t) => ({
        queryKey: ['translation', t.languageCode, t.translationUri],
        queryFn: async (): Promise<LoadedTranslation> => {
          const manifest = buildManifest(t.translationUri)
          const metadata = await fetchJson<TranslationMetadata>(manifest)
          return {
            languageCode: t.languageCode,
            metadata,
            lines: metadata.lines,
          }
        },
        staleTime: 1000 * 60 * 30, // 30 minutes
        gcTime: 1000 * 60 * 60, // 1 hour
        retry: 2,
      })),
    }
  })

  // Map of languageCode → loaded translation
  const translationsMap = createMemo(() => {
    const map = new Map<string, LoadedTranslation>()
    const queries = translationQueries
    if (!queries) return map

    for (const query of queries) {
      if (query.data) {
        map.set(query.data.languageCode, query.data)
      }
    }
    return map
  })

  // Available language codes (loaded successfully)
  const availableLanguages = createMemo(() => {
    return Array.from(translationsMap().keys())
  })

  // Check if any translations are loading
  const isLoading = createMemo(() => {
    const queries = translationQueries
    if (!queries) return false
    return queries.some((q) => q.isLoading)
  })

  // Get translation text for a specific line
  const getLineText = (languageCode: string, lineIndex: number): string | undefined => {
    const translation = translationsMap().get(languageCode)
    if (!translation) return undefined
    const line = translation.lines.find((l) => l.line_index === lineIndex)
    return line?.text
  }

  // Get all lines for a language
  const getLines = (languageCode: string): TranslationLine[] | undefined => {
    return translationsMap().get(languageCode)?.lines
  }

  // Get full translation metadata
  const getMetadata = (languageCode: string): TranslationMetadata | undefined => {
    return translationsMap().get(languageCode)?.metadata
  }

  // Check if a language is available
  const hasLanguage = (languageCode: string): boolean => {
    return translationsMap().has(languageCode)
  }

  // Build translations object for SongPlayPage compatibility
  // Returns { [languageCode]: { lines: [...] } }
  const asLegacyFormat = createMemo(() => {
    const result: Record<string, { lines: TranslationLine[] }> = {}
    for (const [lang, translation] of translationsMap()) {
      result[lang] = { lines: translation.lines }
    }
    return result
  })

  return {
    /** Map of loaded translations */
    translationsMap,
    /** List of available language codes */
    availableLanguages,
    /** Whether any translations are still loading */
    isLoading,
    /** Get text for a specific line in a language */
    getLineText,
    /** Get all lines for a language */
    getLines,
    /** Get full metadata for a language */
    getMetadata,
    /** Check if a language is available */
    hasLanguage,
    /**
     * Get translations in legacy format for SongPlayPage
     * Returns { [lang]: { lines: [...] } }
     */
    asLegacyFormat,
  }
}
