/**
 * Language detection and selection utilities
 */

/**
 * Supported translation language codes
 */
export const SUPPORTED_LANGUAGES = {
  vi: 'Vietnamese',
  zh: 'Mandarin Chinese',
} as const

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES

/**
 * Get the preferred language based on browser settings
 *
 * Rules:
 * - If browser language is Vietnamese (vi) or Chinese (zh), use that
 * - Otherwise, default to Mandarin (zh)
 *
 * @param availableLanguages - Languages available in the lyrics data (excluding English)
 * @returns The preferred language code
 */
export function getPreferredLanguage(availableLanguages: string[]): string {
  // Get browser language (e.g., "en-US", "vi", "zh-CN")
  const browserLang = navigator.language.toLowerCase()

  // Extract primary language code (e.g., "en" from "en-US")
  const primaryLang = browserLang.split('-')[0]

  // Map browser language to our supported languages
  const langMap: Record<string, string> = {
    'vi': 'vi',  // Vietnamese
    'zh': 'zh',  // Mandarin (any Chinese variant)
  }

  // Check if browser language is supported and available
  const mappedLang = langMap[primaryLang]
  if (mappedLang && availableLanguages.includes(mappedLang)) {
    return mappedLang
  }

  // Default to Mandarin if available
  if (availableLanguages.includes('zh')) {
    return 'zh'
  }

  // Fallback to Vietnamese if Mandarin not available
  if (availableLanguages.includes('vi')) {
    return 'vi'
  }

  // Final fallback to first available language
  return availableLanguages[0] || 'en'
}
