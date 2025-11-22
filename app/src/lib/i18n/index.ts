import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import zh from './locales/zh.json'
import vi from './locales/vi.json'
import id from './locales/id.json'

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Mandarin', nativeName: '中文' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
] as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
      vi: { translation: vi },
      id: { translation: id },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh', 'vi', 'id'],
    load: 'languageOnly', // strips region code: zh-CN -> zh
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    debug: true, // Enable debug logging
  })

console.log('[i18n] Initialized with language:', i18n.language)

export default i18n
