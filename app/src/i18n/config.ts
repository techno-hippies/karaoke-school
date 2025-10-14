import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Import translations
import enCommon from '../locales/en/common.json'
import enPost from '../locales/en/post.json'
import zhCNCommon from '../locales/zh-CN/common.json'
import zhCNPost from '../locales/zh-CN/post.json'
import viCommon from '../locales/vi/common.json'
import viPost from '../locales/vi/post.json'

export const defaultNS = 'common'
export const resources = {
  en: {
    common: enCommon,
    post: enPost,
  },
  'zh-CN': {
    common: zhCNCommon,
    post: zhCNPost,
  },
  vi: {
    common: viCommon,
    post: viPost,
  },
} as const

// Detect browser language
const getBrowserLanguage = (): string => {
  const browserLang = navigator.language || navigator.languages?.[0] || 'en'
  console.log('[i18n] Browser language:', browserLang)
  // Map browser locale to supported languages
  if (browserLang.startsWith('zh')) {
    console.log('[i18n] Detected Chinese, using zh-CN')
    return 'zh-CN'
  }
  if (browserLang.startsWith('vi')) {
    console.log('[i18n] Detected Vietnamese, using vi')
    return 'vi'
  }
  console.log('[i18n] Using default language: en')
  return 'en'
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getBrowserLanguage(),
    fallbackLng: 'en',
    defaultNS,
    interpolation: {
      escapeValue: false, // React already escapes
    },
  })

export default i18n
