/**
 * Currency conversion utilities
 *
 * Uses CoinGecko API for real-time rates with caching and fallback values.
 * Primary use case: displaying USDC prices in local currency for Chinese users.
 */

export type SupportedCurrency = 'USD' | 'CNY' | 'IDR' | 'VND'

// Fallback rates when API is unavailable (updated periodically)
const FALLBACK_RATES: Record<SupportedCurrency, number> = {
  USD: 1,
  CNY: 7.25,
  IDR: 15800,
  VND: 25400,
}

// Currency symbols and formatting config
const CURRENCY_CONFIG: Record<SupportedCurrency, { symbol: string; locale: string; decimals: number }> = {
  USD: { symbol: '$', locale: 'en-US', decimals: 2 },
  CNY: { symbol: '¥', locale: 'zh-CN', decimals: 2 },
  IDR: { symbol: 'Rp', locale: 'id-ID', decimals: 0 },
  VND: { symbol: '₫', locale: 'vi-VN', decimals: 0 },
}

// Cache configuration
const CACHE_KEY = 'karaoke_currency_rates'
const CACHE_DURATION_MS = 60 * 60 * 1000 // 1 hour

interface CachedRates {
  rates: Record<SupportedCurrency, number>
  timestamp: number
}

/**
 * Get cached rates from localStorage
 */
function getCachedRates(): CachedRates | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const parsed: CachedRates = JSON.parse(cached)
    const now = Date.now()

    // Check if cache is still valid
    if (now - parsed.timestamp < CACHE_DURATION_MS) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

/**
 * Save rates to localStorage cache
 */
function setCachedRates(rates: Record<SupportedCurrency, number>): void {
  try {
    const cached: CachedRates = {
      rates,
      timestamp: Date.now(),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached))
  } catch {
    // Ignore localStorage errors
  }
}

// In-memory cache for current session
let memoryCache: CachedRates | null = null

/**
 * Fetch exchange rates from CoinGecko API
 * Uses USDC as base (USD-pegged stablecoin)
 */
async function fetchRatesFromAPI(): Promise<Record<SupportedCurrency, number> | null> {
  try {
    // CoinGecko free API - get USD to other currencies
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd,cny,idr,vnd',
      { signal: AbortSignal.timeout(5000) }
    )

    if (!response.ok) {
      console.warn('[currency] CoinGecko API error:', response.status)
      return null
    }

    const data = await response.json()
    const usdcPrices = data['usd-coin']

    if (!usdcPrices || !usdcPrices.usd) {
      console.warn('[currency] Invalid API response:', data)
      return null
    }

    // CoinGecko returns how much 1 USDC is worth in each currency
    // Since USDC ≈ 1 USD, these are effectively USD rates
    const rates: Record<SupportedCurrency, number> = {
      USD: 1,
      CNY: usdcPrices.cny || FALLBACK_RATES.CNY,
      IDR: usdcPrices.idr || FALLBACK_RATES.IDR,
      VND: usdcPrices.vnd || FALLBACK_RATES.VND,
    }

    return rates
  } catch (error) {
    console.warn('[currency] Failed to fetch rates:', error)
    return null
  }
}

/**
 * Get current exchange rates with caching
 * Returns fallback rates if API unavailable
 */
export async function getRates(): Promise<Record<SupportedCurrency, number>> {
  // Check memory cache first
  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_DURATION_MS) {
    return memoryCache.rates
  }

  // Check localStorage cache
  const localCached = getCachedRates()
  if (localCached) {
    memoryCache = localCached
    return localCached.rates
  }

  // Fetch fresh rates
  const freshRates = await fetchRatesFromAPI()

  if (freshRates) {
    setCachedRates(freshRates)
    memoryCache = { rates: freshRates, timestamp: Date.now() }
    return freshRates
  }

  // Fall back to hardcoded rates
  console.warn('[currency] Using fallback rates')
  return FALLBACK_RATES
}

/**
 * Get rates synchronously (from cache only, never fetches)
 * Returns fallback if no cache available
 */
export function getRatesSync(): Record<SupportedCurrency, number> {
  // Check memory cache
  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_DURATION_MS) {
    return memoryCache.rates
  }

  // Check localStorage cache
  const localCached = getCachedRates()
  if (localCached) {
    memoryCache = localCached
    return localCached.rates
  }

  return FALLBACK_RATES
}

/**
 * Convert USD amount to target currency
 */
export function convertUsdTo(amountUsd: number, currency: SupportedCurrency): number {
  const rates = getRatesSync()
  return amountUsd * rates[currency]
}

/**
 * Format amount in specified currency with proper locale formatting
 */
export function formatFiat(amount: number, currency: SupportedCurrency): string {
  const config = CURRENCY_CONFIG[currency]

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(amount)
}

/**
 * Format a USD price with local currency conversion
 * Example: "0.10 USDC (≈¥0.73)"
 */
export function formatTokenPriceWithLocal(
  amountUsd: number,
  token: string,
  localCurrency: SupportedCurrency
): string {
  const tokenAmount = amountUsd.toFixed(2)

  if (localCurrency === 'USD') {
    return `${tokenAmount} ${token}`
  }

  const localAmount = convertUsdTo(amountUsd, localCurrency)
  const localFormatted = formatFiat(localAmount, localCurrency)

  return `${tokenAmount} ${token} (≈${localFormatted})`
}

/**
 * Format just the local currency equivalent
 * Example: "≈ ¥0.73"
 */
export function formatLocalEquivalent(amountUsd: number, localCurrency: SupportedCurrency): string {
  if (localCurrency === 'USD') {
    return formatFiat(amountUsd, 'USD')
  }

  const localAmount = convertUsdTo(amountUsd, localCurrency)
  return `≈ ${formatFiat(localAmount, localCurrency)}`
}

/**
 * Detect user's preferred currency from browser locale
 */
export function detectCurrencyFromLocale(): SupportedCurrency {
  try {
    const locale = navigator.language || 'en-US'
    const lang = locale.split('-')[0].toLowerCase()
    const region = locale.split('-')[1]?.toUpperCase()

    // Map languages/regions to currencies
    if (lang === 'zh' || region === 'CN') return 'CNY'
    if (lang === 'id' || region === 'ID') return 'IDR'
    if (lang === 'vi' || region === 'VN') return 'VND'

    return 'USD'
  } catch {
    return 'USD'
  }
}

/**
 * Get all supported currencies for selector UI
 */
export function getSupportedCurrencies(): Array<{ code: SupportedCurrency; name: string; symbol: string }> {
  return [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
    { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  ]
}
