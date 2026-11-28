import { create } from 'zustand';

import type { PostType } from '@/lib/database.types';

export type SearchSort = 'relevance' | 'recent' | 'price_asc' | 'price_desc' | 'distance';

export interface SearchFilters {
  query: string;
  categoryId: number | null;
  type: PostType | null;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  minRating: number | null;
  /** Restrict to the radius around the current place. Off = everywhere in France. */
  nearbyOnly: boolean;
  sort: SearchSort;
}

export const emptyFilters: SearchFilters = { query: '', categoryId: null, type: null, priceMinCents: null, priceMaxCents: null, minRating: null, nearbyOnly: false, sort: 'relevance' };

interface SearchState {
  filters: SearchFilters;
  setFilters: (patch: Partial<SearchFilters>) => void;
  /** Starts a new search from the search home (query or category), other filters cleared. */
  start: (patch: Partial<SearchFilters>) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  filters: emptyFilters,
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  start: (patch) => set({ filters: { ...emptyFilters, ...patch } }),
}));

/** Number of active filters shown on the "Filtres" chip (query and sort excluded). */
export function countActiveFilters(f: SearchFilters): number {
  return [f.categoryId !== null, f.type !== null, f.priceMinCents !== null || f.priceMaxCents !== null, f.minRating !== null, f.nearbyOnly].filter(Boolean).length;
}
