/**
 * Chat translation hook - handles message translations
 */

import { createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import { translateText } from '@/lib/chat'
import type { PKPAuthContext } from '@/lib/lit/types'
import type { SupportedLanguage } from '@/contexts/LanguagePreferenceContext'

export interface UseChatTranslationOptions {
  authContext: () => PKPAuthContext | null | undefined
  onAuthRequired?: () => void
  targetLanguage?: SupportedLanguage
}

export interface UseChatTranslationReturn {
  translations: Record<string, string>
  translatingIds: () => Set<string>
  translate: (messageId: string, text: string) => Promise<void>
  isTranslating: (messageId: string) => boolean
  getTranslation: (messageId: string) => string | undefined
}

export function useChatTranslation(options: UseChatTranslationOptions): UseChatTranslationReturn {
  const { authContext, onAuthRequired, targetLanguage = 'zh' } = options

  const [translations, setTranslations] = createStore<Record<string, string>>({})
  const [translatingIds, setTranslatingIds] = createSignal<Set<string>>(new Set())

  const translate = async (messageId: string, text: string) => {
    const auth = authContext()
    if (!auth) {
      onAuthRequired?.()
      return
    }

    if (translatingIds().has(messageId) || translations[messageId]) {
      return
    }

    setTranslatingIds((prev) => new Set(prev).add(messageId))

    try {
      const response = await translateText(
        {
          text,
          targetLanguage,
        },
        auth
      )

      if (response.success && response.translation) {
        setTranslations(messageId, response.translation)
      }
    } catch (error) {
      console.error('[useChatTranslation] Translation error:', error)
    } finally {
      setTranslatingIds((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
    }
  }

  const isTranslating = (messageId: string) => translatingIds().has(messageId)
  const getTranslation = (messageId: string) => translations[messageId]

  return {
    translations,
    translatingIds,
    translate,
    isTranslating,
    getTranslation,
  }
}
