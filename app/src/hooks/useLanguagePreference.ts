import { useContext } from 'react'
import { LanguagePreferenceContext, type LanguagePreferenceContextType } from '@/contexts/LanguagePreferenceContext'

/**
 * Hook to access language preference context
 */
export function useLanguagePreference(): LanguagePreferenceContextType {
  const context = useContext(LanguagePreferenceContext)
  if (!context) {
    throw new Error('useLanguagePreference must be used within LanguagePreferenceProvider')
  }
  return context
}
