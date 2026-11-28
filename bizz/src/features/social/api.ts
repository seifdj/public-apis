import type { PostWithMedia } from '@/features/posts/api';
import type { Database, Shop } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type FeedTab = 'for_you' | 'following' | 'nearby';
type FeedRow = Database['public']['Functions']['feed']['Returns'][number];
export interface FeedMedia {
  storage_path: string;
  width: number | null;
  height: number | null;
}
export type FeedItem = Omit<FeedRow, 'media'> & { media: FeedMedia[] };
export interface FeedCursor {
  ts: string;
  id: string;
}
export const FEED_PAGE_SIZE = 8;

export async function fetchFeedPage(tab: FeedTab, cursor: FeedCursor | null): Promise<{ items: FeedItem[]; next: FeedCursor | null }> {
  const { data, error } = await supabase.rpc('feed', {
    p_tab: tab,
    p_limit: FEED_PAGE_SIZE,
    ...(cursor ? { p_cursor_ts: cursor.ts, p_cursor_id: cursor.id } : {}),
  });
  if (error) throw error;
  const items = (data ?? []).map((row) => ({ ...row, media: (row.media as unknown as FeedMedia[]) ?? [] }));
  const last = items[items.length - 1];
  return { items, next: items.length === FEED_PAGE_SIZE && last ? { ts: last.rank_ts, id: last.id } : null };
}

export type Drop = Database['public']['Functions']['drops_today']['Returns'][number];

export async function fetchDrops(): Promise<Drop[]> {
  const { data, error } = await supabase.rpc('drops_today');
  if (error) throw error;
  return data ?? [];
}

// ---- likes / saves / follows: plain rows, guarded by RLS, counters kept by triggers ----
export async function setLiked(userId: string, postId: string, liked: boolean): Promise<void> {
  const { error } = liked
    ? await supabase.from('likes').upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
    : await supabase.from('likes').delete().eq('user_id', userId).eq('post_id', postId);
  if (error) throw error;
}

export async function setSaved(userId: string, postId: string, saved: boolean): Promise<void> {
  const { error } = saved
    ? await supabase.from('saves').upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
    : await supabase.from('saves').delete().eq('user_id', userId).eq('post_id', postId);
  if (error) throw error;
}

export async function setFollowing(userId: string, shopId: string, following: boolean): Promise<void> {
  const { error } = following
    ? await supabase.from('follows').upsert({ follower_id: userId, shop_id: shopId }, { onConflict: 'follower_id,shop_id', ignoreDuplicates: true })
    : await supabase.from('follows').delete().eq('follower_id', userId).eq('shop_id', shopId);
  if (error) throw error;
}

export async function fetchPostFlags(userId: string, postId: string): Promise<{ liked: boolean; saved: boolean }> {
  const [likes, saves] = await Promise.all([
    supabase.from('likes').select('post_id').eq('user_id', userId).eq('post_id', postId).maybeSingle(),
    supabase.from('saves').select('post_id').eq('user_id', userId).eq('post_id', postId).maybeSingle(),
  ]);
  if (likes.error) throw likes.error;
  if (saves.error) throw saves.error;
  return { liked: !!likes.data, saved: !!saves.data };
}

export async function fetchIsFollowing(userId: string, shopId: string): Promise<boolean> {
  const { data, error } = await supabase.from('follows').select('shop_id').eq('follower_id', userId).eq('shop_id', shopId).maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function fetchSavedPosts(userId: string): Promise<PostWithMedia[]> {
  const { data, error } = await supabase.from('saves').select('created_at, post:posts(*, post_media(*))').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((row) => row.post)
    .filter((post): post is PostWithMedia => post !== null)
    .map((post) => ({ ...post, post_media: [...post.post_media].sort((a, b) => a.position - b.position) }));
}

export type FollowedShop = Pick<Shop, 'id' | 'slug' | 'name' | 'avatar_url' | 'is_founder' | 'posts_count' | 'city_id'>;

export async function fetchFollowedShops(userId: string): Promise<FollowedShop[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('created_at, shop:shops(id, slug, name, avatar_url, is_founder, posts_count, city_id)')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => row.shop).filter((shop): shop is FollowedShop => shop !== null);
}

// ---- views, reports, blocks ----
export async function recordViews(postIds: string[]): Promise<void> {
  if (postIds.length === 0) return;
  await supabase.rpc('record_views', { p_post_ids: postIds });
}

export type ReportReason = Database['public']['Enums']['report_reason'];
export type ReportTargetType = 'post' | 'shop';

export async function reportTarget(type: ReportTargetType, id: string, reason: ReportReason, details: string): Promise<void> {
  const { error } = await supabase.rpc('report_target', { p_target_type: type, p_target_id: id, p_reason: reason, ...(details.trim() ? { p_details: details.trim() } : {}) });
  if (error) throw error;
}

export async function blockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('block_user', { p_user_id: userId });
  if (error) throw error;
}

export async function unblockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('unblock_user', { p_user_id: userId });
  if (error) throw error;
}

export type BlockedUser = Database['public']['Functions']['my_blocked_users']['Returns'][number];

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc('my_blocked_users');
  if (error) throw error;
  return data ?? [];
}
