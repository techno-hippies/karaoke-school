/**
 * Lens Provider for SolidJS
 * Wraps the framework-agnostic @lens-protocol/client
 */

import { createContext, useContext, type ParentComponent } from 'solid-js'
import { lensClient, type LensClient } from '@/lib/lens/client'

const LensContext = createContext<LensClient>()

export const LensProvider: ParentComponent = (props) => {
  return (
    <LensContext.Provider value={lensClient}>
      {props.children}
    </LensContext.Provider>
  )
}

export function useLensClient(): LensClient {
  const context = useContext(LensContext)
  if (!context) {
    throw new Error('useLensClient must be used within LensProvider')
  }
  return context
}
