/// <reference types="@synthetixio/synpress" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      CI?: string
      HEADLESS?: string
    }
  }
}

export {}
