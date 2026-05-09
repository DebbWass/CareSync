import { QueryClient } from '@tanstack/react-query';

// Shared TanStack Query client — configure caching and retry behavior
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 seconds — reduces redundant refetches
      staleTime: 30 * 1000,
      // Keep cached data for 5 minutes after component unmounts
      gcTime: 5 * 60 * 1000,
      // Retry failed requests once (not 3x — healthcare data should fail fast)
      retry: 1,
      // Refetch when app comes to foreground (user may have taken medication)
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Medication confirmations must not retry silently — let the app handle it
      retry: 0,
    },
  },
});
