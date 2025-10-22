/**
 * Grove Account Metadata Hook
 * Fetches and validates account metadata from Grove storage
 */

import { useState, useEffect } from 'react'
import { fetchGroveMetadata } from '@/lib/lens/utils'
import { AccountMetadataSchema, type AccountMetadata } from '@/types/grove-metadata'

interface UseGroveAccountMetadataResult {
  data: AccountMetadata | null
  isLoading: boolean
  error: Error | null
}

/**
 * Fetch Grove account metadata from lens:// URI
 * Validates against AccountMetadataSchema
 *
 * @param metadataUri - Grove URI (e.g., lens://8ca79d6d...)
 * @returns Account metadata with loading/error states
 */
export function useGroveAccountMetadata(
  metadataUri: string | null | undefined
): UseGroveAccountMetadataResult {
  const [data, setData] = useState<AccountMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!metadataUri) {
      setData(null)
      setIsLoading(false)
      setError(null)
      return
    }

    let mounted = true

    async function fetchMetadata() {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch raw metadata from Grove
        const rawMetadata = await fetchGroveMetadata(metadataUri!)

        if (!mounted) return

        if (!rawMetadata) {
          setError(new Error('Failed to fetch metadata from Grove'))
          setData(null)
          setIsLoading(false)
          return
        }

        // Validate against schema
        const validatedMetadata = AccountMetadataSchema.parse(rawMetadata)

        if (!mounted) return

        setData(validatedMetadata)
        setError(null)
      } catch (err) {
        if (!mounted) return

        const error = err instanceof Error ? err : new Error('Unknown error fetching metadata')
        console.error('[useGroveAccountMetadata] Error:', error)
        setError(error)
        setData(null)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchMetadata()

    return () => {
      mounted = false
    }
  }, [metadataUri])

  return { data, isLoading, error }
}
