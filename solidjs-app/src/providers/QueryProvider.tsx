/**
 * TanStack Query Provider for SolidJS
 */

import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import type { ParentComponent } from 'solid-js'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
})

export const QueryProvider: ParentComponent = (props) => {
  return (
    <QueryClientProvider client={queryClient}>
      {props.children}
    </QueryClientProvider>
  )
}
