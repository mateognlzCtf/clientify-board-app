'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Cached results stay fresh for 30 seconds before background refetch
        staleTime: 30 * 1000,
        // Keep cached data in memory for 5 minutes after last use
        gcTime: 5 * 60 * 1000,
        // Don't refetch when window regains focus (we use realtime)
        refetchOnWindowFocus: false,
        // Only retry once on failure
        retry: 1,
      },
    },
  }))

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
