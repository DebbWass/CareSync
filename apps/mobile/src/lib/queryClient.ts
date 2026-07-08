import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { AppError } from '../services/supabase/errors';
import { handleAuthError } from './authRecovery';

// A server-rejected session surfaces as AppError('auth') on any query or
// mutation; recover globally (sign out → guard redirects) rather than making
// every screen handle it. Non-auth errors are left to the screens' ErrorBanner.
function onGlobalError(error: unknown): void {
  if (error instanceof AppError && error.code === 'auth') {
    void handleAuthError();
  }
}

// Shared TanStack Query client — configure caching and retry behavior
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onGlobalError }),
  mutationCache: new MutationCache({ onError: onGlobalError }),
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
