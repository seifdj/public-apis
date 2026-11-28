import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { ActiveMode, City, Profile, Shop } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.rpc('get_my_profile');
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function fetchMyShop(userId: string): Promise<Shop | null> {
  const { data, error } = await supabase.from('shops').select('*').eq('owner_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export type CityLite = Pick<City, 'id' | 'name' | 'department' | 'postal_codes'>;

export async function searchCities(q: string): Promise<CityLite[]> {
  const { data, error } = await supabase.rpc('search_cities', { q, max_results: 12 });
  if (error) throw error;
  return (data ?? []).map(({ id, name, department, postal_codes }) => ({ id, name, department, postal_codes }));
}

export async function fetchCity(cityId: number): Promise<CityLite | null> {
  const { data, error } = await supabase.from('cities').select('id, name, department, postal_codes').eq('id', cityId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_username_available', { p_username: username });
  if (error) throw error;
  return data === true;
}

export interface CompleteProfileInput {
  username: string;
  displayName: string;
  cityId: number;
  avatarUrl?: string | null;
}

export async function completeProfile(input: CompleteProfileInput): Promise<void> {
  const { error } = await supabase.rpc('complete_profile', {
    p_username: input.username,
    p_display_name: input.displayName,
    p_city_id: input.cityId,
    ...(input.avatarUrl ? { p_avatar_url: input.avatarUrl } : {}),
  });
  if (error) throw error;
}

export interface OpenShopInput {
  name: string;
  bio?: string;
  cityId?: number;
  instagram?: string;
  snapchat?: string;
  tiktok?: string;
  whatsapp?: string;
}

export async function openShop(input: OpenShopInput): Promise<string> {
  const { data, error } = await supabase.rpc('open_shop', {
    p_name: input.name,
    ...(input.bio ? { p_bio: input.bio } : {}),
    ...(input.cityId ? { p_city_id: input.cityId } : {}),
    ...(input.instagram ? { p_instagram: input.instagram } : {}),
    ...(input.snapchat ? { p_snapchat: input.snapchat } : {}),
    ...(input.tiktok ? { p_tiktok: input.tiktok } : {}),
    ...(input.whatsapp ? { p_whatsapp: input.whatsapp } : {}),
  });
  if (error) throw error;
  // role changed: get a JWT with the new claims
  await supabase.auth.refreshSession();
  return data;
}

export async function setActiveMode(mode: ActiveMode): Promise<void> {
  const { error } = await supabase.rpc('set_active_mode', { p_mode: mode });
  if (error) throw error;
}

export async function requestAccountDeletion(): Promise<void> {
  const { error } = await supabase.rpc('request_account_deletion');
  if (error) throw error;
}

export async function cancelAccountDeletion(): Promise<void> {
  const { error } = await supabase.rpc('cancel_account_deletion');
  if (error) throw error;
}

/** Resizes to 512 px JPEG and uploads to avatars/<uid>/avatar-<ts>.jpg. Returns the public URL. */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const context = ImageManipulator.manipulate(localUri);
  context.resize({ width: 512 });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

  const response = await fetch(result.uri);
  const body = await response.arrayBuffer();
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
