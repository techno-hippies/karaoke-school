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

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Default language
    fallbackLng: 'en',
    defaultNS,
    interpolation: {
      escapeValue: false, // React already escapes
    },
  })

export default i18n
