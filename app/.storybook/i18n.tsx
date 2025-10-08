import React, { useEffect } from 'react'
import type { Decorator } from '@storybook/react-vite'
import { I18nextProvider } from 'react-i18next'
import i18n from '../src/i18n/config'

/**
 * Storybook decorator for i18n support
 * Provides language switching via toolbar and wraps stories with I18nextProvider
 */
export const withI18n: Decorator = (Story, context) => {
  const { locale } = context.globals

  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale)
    }
  }, [locale])

  return (
    <I18nextProvider i18n={i18n}>
      <Story />
    </I18nextProvider>
  )
}

/**
 * Global types for language switcher
 */
export const globalTypes = {
  locale: {
    description: 'Internationalization locale',
    toolbar: {
      icon: 'globe',
      items: [
        { value: 'en', title: 'English' },
        { value: 'zh-CN', title: '中文 (简体)' },
        { value: 'vi', title: 'Tiếng Việt' },
      ],
      title: 'Language',
      dynamicTitle: true,
    },
  },
}
