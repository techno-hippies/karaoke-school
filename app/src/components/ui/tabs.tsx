/**
 * Tabs component using Kobalte
 */

import { Tabs as KobalteTab } from '@kobalte/core/tabs'
import { splitProps, type ParentComponent } from 'solid-js'
import { cn } from '@/lib/utils'

// Re-export the root
const Tabs = KobalteTab

const TabsList: ParentComponent<{ class?: string }> = (props) => {
  const [local, others] = splitProps(props, ['class', 'children'])
  return (
    <KobalteTab.List
      class={cn(
        'relative inline-flex h-10 md:h-12 items-center justify-center rounded-full bg-muted p-1 text-muted-foreground',
        local.class
      )}
      {...others}
    >
      {local.children}
      <KobalteTab.Indicator class="absolute top-1 bottom-1 rounded-full bg-background shadow-sm transition-all duration-250" />
    </KobalteTab.List>
  )
}

const TabsTrigger: ParentComponent<{ class?: string; value: string; disabled?: boolean }> = (props) => {
  const [local, others] = splitProps(props, ['class', 'children', 'value', 'disabled'])
  return (
    <KobalteTab.Trigger
      value={local.value}
      disabled={local.disabled}
      class={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 md:py-1.5 text-sm md:text-lg font-medium transition-all cursor-pointer z-10',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[selected]:text-foreground',
        local.class
      )}
      {...others}
    >
      {local.children}
    </KobalteTab.Trigger>
  )
}

const TabsContent: ParentComponent<{ class?: string; value: string }> = (props) => {
  const [local, others] = splitProps(props, ['class', 'children', 'value'])
  return (
    <KobalteTab.Content
      value={local.value}
      class={cn(
        'mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        local.class
      )}
      {...others}
    >
      {local.children}
    </KobalteTab.Content>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
