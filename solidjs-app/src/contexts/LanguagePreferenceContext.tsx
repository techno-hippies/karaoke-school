import { createContext, useContext, createSignal, onMount, type ParentComponent } from 'solid-js'

export type SupportedLanguage = 'vi' | 'id' | 'zh'

export interface LanguagePreferenceContextType {
  preferredLanguage: () => SupportedLanguage
  setPreferredLanguage: (language: SupportedLanguage) => void
  languageFallbackOrder: () => SupportedLanguage[]
}

const LanguagePreferenceContext = createContext<LanguagePreferenceContextType>()

const DEFAULT_LANGUAGE: SupportedLanguage = 'zh'
const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['vi', 'id', 'zh']

export const LanguagePreferenceProvider: ParentComponent = (props) => {
  const [preferredLanguage, setPreferredLanguageState] = createSignal<SupportedLanguage>(DEFAULT_LANGUAGE)
  const [isHydrated, setIsHydrated] = createSignal(false)

  onMount(() => {
    const stored = localStorage.getItem('languagePreference')
    if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
      setPreferredLanguageState(stored as SupportedLanguage)
    }
    setIsHydrated(true)
  })

  const setPreferredLanguage = (language: SupportedLanguage) => {
    setPreferredLanguageState(language)
    localStorage.setItem('languagePreference', language)
  }

  const languageFallbackOrder = () => {
    return Array.from(
      new Set<SupportedLanguage>([
        preferredLanguage(),
        ...SUPPORTED_LANGUAGES,
      ])
    )
  }

  return (
    <LanguagePreferenceContext.Provider
      value={{
        preferredLanguage,
        setPreferredLanguage,
        languageFallbackOrder,
      }}
    >
      {isHydrated() ? props.children : null}
    </LanguagePreferenceContext.Provider>
  )
}

export function useLanguagePreference() {
  const context = useContext(LanguagePreferenceContext)
  if (!context) {
    throw new Error('useLanguagePreference must be used within LanguagePreferenceProvider')
  }
  return context
}
