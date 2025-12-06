/**
 * i18n - Internationalization system for SolidJS
 *
 * Supports: English (en), Mandarin Chinese (zh), Vietnamese (vi), Indonesian (id)
 *
 * Usage:
 *   const { t } = useTranslation()
 *   t('nav.home') // Returns translated string
 */

import { createContext, useContext, createSignal, createMemo, type Accessor, type ParentComponent } from 'solid-js'

// Import all translation files statically
import en from '@/locales/en/common.json'
import zh from '@/locales/zh/common.json'
import vi from '@/locales/vi/common.json'
import id from '@/locales/id/common.json'

export type UILanguage = 'en' | 'zh' | 'vi' | 'id'

// Type for nested translation object
type TranslationValue = string | { [key: string]: TranslationValue }
type Translations = Record<string, TranslationValue>

const translations: Record<UILanguage, Translations> = {
  en,
  zh,
  vi,
  id,
}

// Default UI language (English for interface, matches existing content language default of zh)
export const DEFAULT_UI_LANGUAGE: UILanguage = 'en'
export const SUPPORTED_UI_LANGUAGES: readonly UILanguage[] = ['en', 'zh', 'vi', 'id']

// Storage key for UI language preference
const UI_LANGUAGE_STORAGE_KEY = 'uiLanguagePreference'

/**
 * Get nested value from translation object using dot notation
 * e.g., 'nav.home' -> translations.nav.home
 */
function getNestedValue(obj: Translations, path: string): string {
  const keys = path.split('.')
  let current: TranslationValue = obj

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key]
    } else {
      return path // Return key if not found
    }
  }

  return typeof current === 'string' ? current : path
}

/**
 * Create translation function for a specific language
 */
function createTranslator(language: UILanguage) {
  const langTranslations = translations[language]
  const fallbackTranslations = translations['en']

  return (key: string, params?: Record<string, string | number>): string => {
    let value = getNestedValue(langTranslations, key)

    // Fallback to English if key not found
    if (value === key && language !== 'en') {
      value = getNestedValue(fallbackTranslations, key)
    }

    // Simple parameter interpolation: {{param}}
    if (params && value !== key) {
      for (const [param, replacement] of Object.entries(params)) {
        value = value.replace(new RegExp(`{{${param}}}`, 'g'), String(replacement))
      }
    }

    return value
  }
}

// Context type
interface I18nContextType {
  uiLanguage: Accessor<UILanguage>
  setUILanguage: (lang: UILanguage) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType>()

/**
 * I18nProvider - Wraps app to provide translation context
 *
 * Note: This is separate from LanguagePreferenceContext which handles
 * content language (lyrics, exercises). This handles UI language.
 */
export const I18nProvider: ParentComponent = (props) => {
  // Initialize from localStorage or default
  const getInitialLanguage = (): UILanguage => {
    if (typeof window === 'undefined') return DEFAULT_UI_LANGUAGE

    const stored = localStorage.getItem(UI_LANGUAGE_STORAGE_KEY)
    if (stored && SUPPORTED_UI_LANGUAGES.includes(stored as UILanguage)) {
      return stored as UILanguage
    }

    // Try to detect from browser
    const browserLang = navigator.language.split('-')[0]
    if (SUPPORTED_UI_LANGUAGES.includes(browserLang as UILanguage)) {
      return browserLang as UILanguage
    }

    return DEFAULT_UI_LANGUAGE
  }

  const [uiLanguage, setUILanguageState] = createSignal<UILanguage>(getInitialLanguage())

  const setUILanguage = (lang: UILanguage) => {
    setUILanguageState(lang)
    if (typeof window !== 'undefined') {
      localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, lang)
    }
  }

  // Create memoized translator that updates when language changes
  const t = createMemo(() => createTranslator(uiLanguage()))

  return (
    <I18nContext.Provider
      value={{
        uiLanguage,
        setUILanguage,
        t: (key: string, params?: Record<string, string | number>) => t()(key, params),
      }}
    >
      {props.children}
    </I18nContext.Provider>
  )
}

/**
 * useTranslation - Hook to access translation function
 *
 * Usage:
 *   const { t, uiLanguage, setUILanguage } = useTranslation()
 *   <span>{t('nav.home')}</span>
 */
export function useTranslation() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider')
  }
  return context
}

/**
 * Get language display name
 */
export function getLanguageDisplayName(lang: UILanguage): string {
  const names: Record<UILanguage, string> = {
    en: 'English',
    zh: '中文',
    vi: 'Tiếng Việt',
    id: 'Bahasa Indonesia',
  }
  return names[lang]
}

// Export for backwards compatibility with old i18n usage
export default {
  t: createTranslator(DEFAULT_UI_LANGUAGE),
}
