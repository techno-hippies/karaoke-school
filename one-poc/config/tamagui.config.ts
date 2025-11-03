import { config } from '@tamagui/config/v3'
import { createTamagui } from 'tamagui'

export default createTamagui(config)

export type Conf = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}
