import { createContext, useContext, createSignal, onMount, type ParentComponent } from 'solid-js'
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
  currency: () => SupportedCurrency
  setCurrency: (currency: SupportedCurrency) => void
  rates: () => Record<SupportedCurrency, number>
  isLoading: () => boolean
  formatPrice: (amountUsd: number, token?: string) => string
  formatLocal: (amountUsd: number) => string
  formatFiat: (amount: number, currency: SupportedCurrency) => string
  toLocal: (amountUsd: number) => number
  currencies: ReturnType<typeof getSupportedCurrencies>
}

const CurrencyContext = createContext<CurrencyContextValue>()

const STORAGE_KEY = 'karaoke_display_currency'

function getInitialCurrency(): SupportedCurrency {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as SupportedCurrency | null
    if (stored && ['USD', 'CNY', 'IDR', 'VND'].includes(stored)) {
      return stored
    }
  } catch {
    // Ignore localStorage errors
  }
  return detectCurrencyFromLocale()
}

export const CurrencyProvider: ParentComponent = (props) => {
  const [currency, setCurrencyState] = createSignal<SupportedCurrency>(getInitialCurrency())
  const [rates, setRates] = createSignal<Record<SupportedCurrency, number>>(getRatesSync())
  const [isLoading, setIsLoading] = createSignal(true)

  onMount(async () => {
    try {
      const freshRates = await getRates()
      setRates(freshRates)
    } finally {
      setIsLoading(false)
    }
  })

  const setCurrency = (newCurrency: SupportedCurrency) => {
    setCurrencyState(newCurrency)
    try {
      localStorage.setItem(STORAGE_KEY, newCurrency)
    } catch {
      // Ignore localStorage errors
    }
  }

  const formatPriceFn = (amountUsd: number, token = 'USDC') => {
    return formatTokenPriceWithLocal(amountUsd, token, currency())
  }

  const formatLocalFn = (amountUsd: number) => {
    return formatLocalEquivalent(amountUsd, currency())
  }

  const toLocal = (amountUsd: number) => {
    return convertUsdTo(amountUsd, currency())
  }

  const value: CurrencyContextValue = {
    currency,
    setCurrency,
    rates,
    isLoading,
    formatPrice: formatPriceFn,
    formatLocal: formatLocalFn,
    formatFiat,
    toLocal,
    currencies: getSupportedCurrencies(),
  }

  return <CurrencyContext.Provider value={value}>{props.children}</CurrencyContext.Provider>
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}
