import { Fire } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription } from '@/components/ui/item'

interface StreakCounterProps {
  streak: number
}

export function StreakCounter({ streak }: StreakCounterProps) {
  const { t } = useTranslation()

  return (
    <Item variant="default" className="gap-3 px-0 py-2">
      <ItemMedia className="self-center">
        <Fire size={56} weight="duotone" className="text-orange-500" />
      </ItemMedia>

      <ItemContent className="min-w-0 gap-0">
        <ItemTitle className="text-base font-semibold">
          {t('study.streakLabel')}: <span className="tabular-nums">{streak}</span>
        </ItemTitle>
        <ItemDescription className="text-xs text-foreground/60">
          {t('study.streakDescription')}
        </ItemDescription>
      </ItemContent>
    </Item>
  )
}
