import React, { createContext, useState, useEffect } from 'react'

export type SupportedLanguage = 'vi' | 'id' | 'zh'

export interface LanguagePreferenceContextType {
  /** Primary language preference (Vietnamese, Indonesian, or Chinese) */
  preferredLanguage: SupportedLanguage
  /** Set the user's language preference */
  setPreferredLanguage: (language: SupportedLanguage) => void
  /** Language fallback order: preferred language followed by remaining supported languages */
  languageFallbackOrder: SupportedLanguage[]
}

// eslint-disable-next-line react-refresh/only-export-components
export const LanguagePreferenceContext = createContext<LanguagePreferenceContextType | undefined>(undefined)

/**
 * Provider for language preferences
 *
 * Stores user's language preference in localStorage for persistence
 * Default: 'zh' (Mandarin/Chinese)
   * Fallback order: user preference → remaining supported languages
 */
const DEFAULT_LANGUAGE: SupportedLanguage = 'zh'
const SUPPORTED_LANGUAGES = ['vi', 'id', 'zh'] as const

export function LanguagePreferenceProvider({ children }: { children: React.ReactNode }) {
  const [preferredLanguage, setPreferredLanguageState] = useState<SupportedLanguage>('zh')
  const [isHydrated, setIsHydrated] = useState(false)

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('languagePreference')
    if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
      setPreferredLanguageState(stored as SupportedLanguage)
    }
    setIsHydrated(true)
  }, [])

  const setPreferredLanguage = (language: SupportedLanguage) => {
    setPreferredLanguageState(language)
    localStorage.setItem('languagePreference', language)
  }

  // Build fallback order: preferred language first, then Mandarin as fallback
  const languageFallbackOrder: SupportedLanguage[] = Array.from(
    new Set<SupportedLanguage>([
      preferredLanguage,
      ...SUPPORTED_LANGUAGES,
    ])
  )

  return (
    <LanguagePreferenceContext.Provider
      value={{
        preferredLanguage,
        setPreferredLanguage,
        languageFallbackOrder,
      }}
    >
      {isHydrated ? children : null}
    </LanguagePreferenceContext.Provider>
  )
}
