/**
 * LanguageSwitcher - UI language selector component
 *
 * Allows users to switch the interface language between
 * English, Mandarin Chinese, Vietnamese, and Indonesian
 */

import { type Component } from 'solid-js'
import { useTranslation, SUPPORTED_UI_LANGUAGES, getLanguageDisplayName, type UILanguage } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icons'
import { Select } from '@/components/ui/select'

interface LanguageSwitcherProps {
  /** Additional CSS classes */
  class?: string
}

/**
 * LanguageSwitcher - Dropdown to change UI language
 */
export const LanguageSwitcher: Component<LanguageSwitcherProps> = (props) => {
  const { t, uiLanguage, setUILanguage } = useTranslation()

  const languageOptions = SUPPORTED_UI_LANGUAGES.map(lang => ({
    value: lang,
    label: getLanguageDisplayName(lang),
  }))

  return (
    <div class={`flex flex-col gap-2 ${props.class || ''}`}>
      <div class="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Icon name="globe" class="text-base" />
        {t('language.title')}
      </div>
      <Select
        options={languageOptions}
        value={uiLanguage()}
        onChange={(value) => setUILanguage(value as UILanguage)}
        placeholder="Select language"
      />
    </div>
  )
}

/**
 * LanguageSwitcherCompact - Inline button for header/footer
 */
export const LanguageSwitcherCompact: Component<{ class?: string }> = (props) => {
  const { uiLanguage, setUILanguage } = useTranslation()

  // Cycle through languages on click
  const cycleLanguage = () => {
    const currentIndex = SUPPORTED_UI_LANGUAGES.indexOf(uiLanguage())
    const nextIndex = (currentIndex + 1) % SUPPORTED_UI_LANGUAGES.length
    setUILanguage(SUPPORTED_UI_LANGUAGES[nextIndex])
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycleLanguage}
      class={`gap-1.5 ${props.class || ''}`}
      title="Change language"
    >
      <Icon name="globe" class="text-base" />
      <span class="uppercase text-xs font-medium">{uiLanguage()}</span>
    </Button>
  )
}

export default LanguageSwitcher
