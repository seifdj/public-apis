import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import { createAlert, deleteAlert, fetchAlerts, findShops, SEARCH_PAGE_SIZE, searchPosts, setAlertActive } from '@/features/search/api';
import { placeKey, usePlaceStore } from '@/store/place';
import type { SearchFilters } from '@/store/search';

export function useSearchResults(filters: SearchFilters, enabled = true) {
  const userId = useUserId();
  const place = usePlaceStore((s) => s.place);
  const radiusKm = usePlaceStore((s) => s.radiusKm);
  return useInfiniteQuery({
    queryKey: ['search', filters, placeKey(place), filters.nearbyOnly ? radiusKm : 0],
    queryFn: ({ pageParam }) => searchPosts(filters, place, radiusKm, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.length === SEARCH_PAGE_SIZE ? pages.length * SEARCH_PAGE_SIZE : undefined),
    enabled: !!userId && enabled,
    staleTime: 30_000,
  });
}

/** "Vendeurs près de toi" (no query) or shops matching a name (query). */
export function useShops(options: { query?: string; categoryId?: number | null; limit?: number; enabled?: boolean }) {
  const userId = useUserId();
  const place = usePlaceStore((s) => s.place);
  const radiusKm = usePlaceStore((s) => s.radiusKm);
  return useQuery({
    queryKey: ['shops-directory', options.query ?? '', options.categoryId ?? 0, placeKey(place), radiusKm, options.limit ?? 20],
    queryFn: () => findShops({ ...options, place, radiusKm }),
    enabled: !!userId && (options.enabled ?? true),
    staleTime: 60_000,
  });
}

export function useAlerts() {
  const userId = useUserId();
  return useQuery({ queryKey: ['search-alerts'], queryFn: () => fetchAlerts(userId!), enabled: !!userId });
}

export function useAlertActions() {
  const client = useQueryClient();
  const userId = useUserId();
  const place = usePlaceStore((s) => s.place);
  const radiusKm = usePlaceStore((s) => s.radiusKm);
  const refresh = () => client.invalidateQueries({ queryKey: ['search-alerts'] });
  const create = useMutation({
    mutationFn: ({ filters, profileCityId }: { filters: SearchFilters; profileCityId: number | null }) => createAlert(userId!, filters, place, radiusKm, profileCityId),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: deleteAlert, onSuccess: refresh });
  const toggle = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => setAlertActive(id, active), onSuccess: refresh });
  return { create, remove, toggle };
}
