import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { Category, Json, Post, PostMedia, PostStatus, PostType, PriceMode, Shop } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export interface PostAllowance {
  freeDaily: number;
  usedToday: number;
  credits: number;
  canPost: boolean;
  nextReset: string;
  hasBizzPlus: boolean;
}

export async function fetchAllowance(): Promise<PostAllowance> {
  const { data, error } = await supabase.rpc('get_post_allowance');
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('No allowance returned');
  return { freeDaily: row.free_daily, usedToday: row.used_today, credits: row.credits, canPost: row.can_post, nextReset: row.next_reset, hasBizzPlus: row.has_bizzplus };
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).is('parent_id', null).order('sort_order');
  if (error) throw error;
  return data ?? [];
}

/** A photo in the form: already uploaded (`storagePath`) or still a local file (`localUri`). */
export interface DraftImage {
  key: string;
  localUri?: string;
  storagePath?: string;
  width?: number | null;
  height?: number | null;
}

const MAX_IMAGE_SIDE = 1600;

/** Resizes to at most 1600 px wide (JPEG 80 %) and uploads to post-media/<uid>/<random>.jpg. */
export async function uploadPostImage(userId: string, image: DraftImage): Promise<{ storage_path: string; width: number; height: number }> {
  if (image.storagePath) return { storage_path: image.storagePath, width: image.width ?? 0, height: image.height ?? 0 };
  if (!image.localUri) throw new Error('INVALID_MEDIA');

  const context = ImageManipulator.manipulate(image.localUri);
  if (!image.width || image.width > MAX_IMAGE_SIDE) context.resize({ width: MAX_IMAGE_SIDE });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

  const body = await (await fetch(result.uri)).arrayBuffer();
  const path = `${userId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error } = await supabase.storage.from('post-media').upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return { storage_path: path, width: result.width, height: result.height };
}

export interface PostInput {
  type: PostType;
  title: string;
  description: string;
  hashtags: string[];
  priceMode: PriceMode;
  priceCents: number | null;
  categoryId: number;
  cityId: number;
  images: DraftImage[];
}

async function toPayload(userId: string, input: PostInput): Promise<Json> {
  const media = await Promise.all(input.images.map((image) => uploadPostImage(userId, image)));
  return {
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    hashtags: input.hashtags,
    price_mode: input.priceMode,
    price_cents: input.priceMode === 'fixed' ? input.priceCents : null,
    category_id: input.categoryId,
    city_id: input.cityId,
    media: media.map((m) => ({ kind: 'image', ...m })),
  };
}

/** Uploads the photos, then publishes. The server checks and consumes the quota. */
export async function createPost(userId: string, input: PostInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_post', { p: await toPayload(userId, input) });
  if (error) throw error;
  return data;
}

export async function updatePost(userId: string, postId: string, input: PostInput): Promise<void> {
  const { error } = await supabase.rpc('update_post', { p_post_id: postId, p: await toPayload(userId, input) });
  if (error) throw error;
}

export async function setPostStatus(postId: string, status: Exclude<PostStatus, 'expired'>): Promise<void> {
  const { error } = await supabase.from('posts').update({ status }).eq('id', postId);
  if (error) throw error;
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_post', { p_post_id: postId });
  if (error) throw error;
}

export type PostWithMedia = Post & { post_media: PostMedia[] };
export type ShopLite = Pick<Shop, 'id' | 'slug' | 'name' | 'avatar_url' | 'is_founder' | 'city_id' | 'owner_id'>;
export type PostDetail = PostWithMedia & { shop: ShopLite | null };

const sortMedia = <T extends { post_media: PostMedia[] }>(post: T): T => ({ ...post, post_media: [...post.post_media].sort((a, b) => a.position - b.position) });

export async function fetchMyPosts(userId: string): Promise<PostWithMedia[]> {
  const { data, error } = await supabase.from('posts').select('*, post_media(*)').eq('author_id', userId).is('deleted_at', null).order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(sortMedia);
}

export async function fetchPost(postId: string): Promise<PostDetail | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('*, post_media(*), shop:shops(id, slug, name, avatar_url, is_founder, city_id, owner_id)')
    .eq('id', postId)
    .maybeSingle();
  if (error) throw error;
  return data ? sortMedia(data) : null;
}

export async function fetchShopBySlug(slug: string): Promise<Shop | null> {
  const { data, error } = await supabase.from('shops').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data;
}

/** Posts shown on a shop page: everything still listed (available, reserved, sold), newest first. */
export async function fetchShopPosts(shopId: string): Promise<PostWithMedia[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*, post_media(*)')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .eq('visibility', 'visible')
    .neq('status', 'expired')
    .gt('expires_at', new Date().toISOString())
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(sortMedia);
}

export interface ShopUpdate {
  name: string;
  bio: string | null;
  city_id: number;
  avatar_url?: string | null;
  instagram: string | null;
  snapchat: string | null;
  tiktok: string | null;
  whatsapp: string | null;
}

export async function updateShop(shopId: string, patch: ShopUpdate): Promise<void> {
  const { error } = await supabase.from('shops').update(patch).eq('id', shopId);
  if (error) throw error;
}

/** A post past its date counts as expired even before the hourly job flips its status. */
export function effectiveStatus(post: Pick<Post, 'status' | 'expires_at' | 'visibility'>): PostStatus | 'hidden' {
  if (post.visibility !== 'visible') return 'hidden';
  if (post.status === 'expired' || new Date(post.expires_at).getTime() <= Date.now()) return 'expired';
  return post.status;
}
