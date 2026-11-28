import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  myShop: (userId: string) => ['my-shop', userId] as const,
  city: (cityId: number) => ['city', cityId] as const,
  citySearch: (q: string) => ['city-search', q] as const,
  usernameAvailable: (username: string) => ['username-available', username] as const,
  settings: ['settings'] as const,
  categories: ['categories'] as const,
} as const;
