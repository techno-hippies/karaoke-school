import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  type SupportedCurrency,
  detectCurrencyFromLocale,
  getRates,
  getRatesSync,
  formatTokenPriceWithLocal,
  formatLocalEquivalent,
  formatFiat,
  convertUsdTo,
  getSupportedCurrencies,
} from '@/lib/currency'

interface CurrencyContextValue {
  /** Current selected currency for local display */
  currency: SupportedCurrency
  /** Change the display currency */
  setCurrency: (currency: SupportedCurrency) => void
  /** Exchange rates (USD to others) */
  rates: Record<SupportedCurrency, number>
  /** Whether rates have been fetched */
  isLoading: boolean
  /** Format token price with local equivalent: "0.10 USDC (≈¥0.73)" */
  formatPrice: (amountUsd: number, token?: string) => string
  /** Format just the local equivalent: "≈¥0.73" */
  formatLocal: (amountUsd: number) => string
  /** Format in specific fiat currency */
  formatFiat: (amount: number, currency: SupportedCurrency) => string
  /** Convert USD to local currency */
  toLocal: (amountUsd: number) => number
  /** All supported currencies for selector */
  currencies: ReturnType<typeof getSupportedCurrencies>
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

const STORAGE_KEY = 'karaoke_display_currency'

interface CurrencyProviderProps {
  children: ReactNode
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
  // Initialize currency from storage or locale detection
  const [currency, setCurrencyState] = useState<SupportedCurrency>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as SupportedCurrency | null
      if (stored && ['USD', 'CNY', 'IDR', 'VND'].includes(stored)) {
        return stored
      }
    } catch {
      // Ignore localStorage errors
    }
    return detectCurrencyFromLocale()
  })

  const [rates, setRates] = useState<Record<SupportedCurrency, number>>(getRatesSync)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch rates on mount
  useEffect(() => {
    let mounted = true

    async function fetchRates() {
      try {
        const freshRates = await getRates()
        if (mounted) {
          setRates(freshRates)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchRates()

    return () => {
      mounted = false
    }
  }, [])

  // Persist currency selection
  const setCurrency = useCallback((newCurrency: SupportedCurrency) => {
    setCurrencyState(newCurrency)
    try {
      localStorage.setItem(STORAGE_KEY, newCurrency)
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Formatting helpers bound to current currency
  const formatPrice = useCallback(
    (amountUsd: number, token = 'USDC') => {
      return formatTokenPriceWithLocal(amountUsd, token, currency)
    },
    [currency]
  )

  const formatLocal = useCallback(
    (amountUsd: number) => {
      return formatLocalEquivalent(amountUsd, currency)
    },
    [currency]
  )

  const toLocal = useCallback(
    (amountUsd: number) => {
      return convertUsdTo(amountUsd, currency)
    },
    [currency]
  )

  const value: CurrencyContextValue = {
    currency,
    setCurrency,
    rates,
    isLoading,
    formatPrice,
    formatLocal,
    formatFiat,
    toLocal,
    currencies: getSupportedCurrencies(),
  }

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}
