import { useTranslation } from 'react-i18next'
import { Globe } from '@phosphor-icons/react'
import { supportedLanguages } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

export function LanguageSelector() {
  const { i18n, t } = useTranslation()

  const currentLanguage = supportedLanguages.find(lang => lang.code === i18n.language) || supportedLanguages[0]

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        <Globe className="w-4 h-4" />
        <span>{t('settings.language')}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {supportedLanguages.map((lang) => (
          <Button
            key={lang.code}
            variant={currentLanguage.code === lang.code ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleLanguageChange(lang.code)}
            className="justify-start"
          >
            {lang.nativeName}
          </Button>
        ))}
      </div>
    </div>
  )
}
