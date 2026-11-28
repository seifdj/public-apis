import type { FeedItem, FeedMedia } from '@/features/social/api';
import type { Database, SearchAlert } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { type Place, placeParams } from '@/store/place';
import type { SearchFilters } from '@/store/search';

export const SEARCH_PAGE_SIZE = 24;

export async function searchPosts(filters: SearchFilters, place: Place, radiusKm: number, offset: number): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc('search_posts', {
    ...(filters.query.trim() ? { p_query: filters.query.trim() } : {}),
    ...(filters.categoryId !== null ? { p_category_id: filters.categoryId } : {}),
    ...(filters.type ? { p_type: filters.type } : {}),
    ...(filters.priceMinCents !== null ? { p_price_min: filters.priceMinCents } : {}),
    ...(filters.priceMaxCents !== null ? { p_price_max: filters.priceMaxCents } : {}),
    ...(filters.minRating !== null ? { p_min_rating: filters.minRating } : {}),
    ...(filters.nearbyOnly ? { p_radius_km: radiusKm } : {}),
    ...placeParams(place),
    p_sort: filters.sort,
    p_limit: SEARCH_PAGE_SIZE,
    p_offset: offset,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, media: (row.media as unknown as FeedMedia[]) ?? [] }));
}

export type DirectoryShop = Database['public']['Functions']['find_shops']['Returns'][number];

/** Without a query: shops around the place. With a query: shops matching the name, anywhere. */
export async function findShops(options: { query?: string; place: Place; radiusKm: number; categoryId?: number | null; limit?: number }): Promise<DirectoryShop[]> {
  const { data, error } = await supabase.rpc('find_shops', {
    ...(options.query?.trim() ? { p_query: options.query.trim() } : {}),
    ...placeParams(options.place),
    p_radius_km: options.radiusKm,
    ...(options.categoryId ? { p_category_id: options.categoryId } : {}),
    p_limit: options.limit ?? 20,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAlerts(userId: string): Promise<SearchAlert[]> {
  const { data, error } = await supabase.from('search_alerts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Saves the current search as an alert. The city is kept only when the search is restricted to a radius. */
export async function createAlert(userId: string, filters: SearchFilters, place: Place, radiusKm: number, profileCityId: number | null): Promise<void> {
  const cityId = !filters.nearbyOnly ? null : place.mode === 'city' ? place.city.id : profileCityId;
  const { error } = await supabase.from('search_alerts').insert({
    user_id: userId,
    query: filters.query.trim() || null,
    category_id: filters.categoryId,
    type: filters.type,
    city_id: cityId,
    radius_km: cityId ? radiusKm : null,
    price_min_cents: filters.priceMinCents,
    price_max_cents: filters.priceMaxCents,
  });
  if (error) throw error;
}

export async function deleteAlert(alertId: string): Promise<void> {
  const { error } = await supabase.from('search_alerts').delete().eq('id', alertId);
  if (error) throw error;
}

export async function setAlertActive(alertId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('search_alerts').update({ is_active: active }).eq('id', alertId);
  if (error) throw error;
}
