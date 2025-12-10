/**
 * Select component built on Kobalte
 * https://kobalte.dev/docs/core/components/select
 */

import { Select as KobalteSelect } from '@kobalte/core/select'
import { type Component, splitProps } from 'solid-js'
import { Icon } from '@/components/icons'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  class?: string
  disabled?: boolean
}

export const Select: Component<SelectProps> = (props) => {
  const [local, others] = splitProps(props, ['options', 'value', 'onChange', 'placeholder', 'class', 'disabled'])

  return (
    <KobalteSelect
      options={local.options}
      optionValue="value"
      optionTextValue="label"
      value={local.options.find(o => o.value === local.value)}
      onChange={(option) => option && local.onChange?.(option.value)}
      placeholder={local.placeholder}
      disabled={local.disabled}
      itemComponent={(itemProps) => (
        <KobalteSelect.Item
          item={itemProps.item}
          class="flex items-center justify-between px-3 py-2 text-sm cursor-pointer outline-none hover:bg-white/5 focus:bg-white/5 rounded-md data-[highlighted]:bg-white/5"
        >
          <KobalteSelect.ItemLabel>{itemProps.item.rawValue.label}</KobalteSelect.ItemLabel>
          <KobalteSelect.ItemIndicator>
            <Icon name="check" class="text-base text-primary" />
          </KobalteSelect.ItemIndicator>
        </KobalteSelect.Item>
      )}
      {...others}
    >
      <KobalteSelect.Trigger
        class={cn(
          'inline-flex items-center justify-between gap-2 px-4 py-2 min-w-[140px] rounded-lg cursor-pointer',
          'bg-secondary text-foreground text-sm font-medium',
          'border border-border hover:bg-white/5 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          local.class
        )}
      >
        <KobalteSelect.Value<SelectOption>>
          {(state) => state.selectedOption()?.label || local.placeholder}
        </KobalteSelect.Value>
        <KobalteSelect.Icon>
          <Icon name="caret-down" class="text-base text-muted-foreground" />
        </KobalteSelect.Icon>
      </KobalteSelect.Trigger>
      <KobalteSelect.Portal>
        <KobalteSelect.Content
          class={cn(
            'z-50 min-w-[140px] overflow-hidden rounded-lg',
            'bg-popover text-popover-foreground border border-border shadow-lg',
            'animate-in fade-in-0 zoom-in-95'
          )}
        >
          <KobalteSelect.Listbox class="p-1 max-h-64 overflow-y-auto" />
        </KobalteSelect.Content>
      </KobalteSelect.Portal>
    </KobalteSelect>
  )
}
