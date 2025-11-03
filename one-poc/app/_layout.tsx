import { TamaguiProvider } from 'tamagui'
import { SchemeProvider, useColorScheme } from '@vxrn/color-scheme'
import { Slot } from 'one'
import config from '../config/tamagui.config'

export default function Layout() {
  return (
    <SchemeProvider>
      <ThemeProvider>
        <Slot />
      </ThemeProvider>
    </SchemeProvider>
  )
}

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [scheme] = useColorScheme()
  return (
    <TamaguiProvider config={config} defaultTheme={scheme}>
      {children}
    </TamaguiProvider>
  )
}
