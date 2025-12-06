import { Toaster as SolidToaster } from 'solid-sonner'
import type { Component } from 'solid-js'

export const Toaster: Component = () => {
  return (
    <SolidToaster
      position="top-center"
      toastOptions={{
        style: {
          background: 'var(--card)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
        },
      }}
    />
  )
}
