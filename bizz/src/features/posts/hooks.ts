import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import {
  createPost,
  deletePost,
  fetchAllowance,
  fetchCategories,
  fetchMyPosts,
  fetchPost,
  fetchShopBySlug,
  fetchShopPosts,
  type PostInput,
  setPostStatus,
  updatePost,
} from '@/features/posts/api';
import type { PostStatus } from '@/lib/database.types';
import { queryKeys } from '@/lib/queryClient';

export function useAllowance() {
  const userId = useUserId();
  return useQuery({ queryKey: queryKeys.allowance(userId ?? 'none'), queryFn: fetchAllowance, enabled: !!userId, staleTime: 15_000 });
}

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: fetchCategories, staleTime: 60 * 60_000 });
}

export function useMyPosts() {
  const userId = useUserId();
  return useQuery({ queryKey: queryKeys.myPosts(userId ?? 'none'), queryFn: () => fetchMyPosts(userId!), enabled: !!userId });
}

export function usePost(postId: string | undefined) {
  return useQuery({ queryKey: queryKeys.post(postId ?? 'none'), queryFn: () => fetchPost(postId!), enabled: !!postId });
}

export function useShopBySlug(slug: string | undefined) {
  return useQuery({ queryKey: queryKeys.shop(slug ?? 'none'), queryFn: () => fetchShopBySlug(slug!), enabled: !!slug });
}

export function useShopPosts(shopId: string | undefined) {
  return useQuery({ queryKey: queryKeys.shopPosts(shopId ?? 'none'), queryFn: () => fetchShopPosts(shopId!), enabled: !!shopId });
}

/** Everything that shows posts or the quota is refreshed after a write. */
function useInvalidatePosts() {
  const client = useQueryClient();
  const userId = useUserId();
  return (postId?: string) =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['my-posts'] }),
      client.invalidateQueries({ queryKey: ['shop-posts'] }),
      client.invalidateQueries({ queryKey: ['allowance'] }),
      userId ? client.invalidateQueries({ queryKey: queryKeys.myShop(userId) }) : Promise.resolve(),
      postId ? client.invalidateQueries({ queryKey: queryKeys.post(postId) }) : Promise.resolve(),
    ]);
}

export function useCreatePost() {
  const userId = useUserId();
  const invalidate = useInvalidatePosts();
  return useMutation({ mutationFn: (input: PostInput) => createPost(userId!, input), onSuccess: (id) => invalidate(id) });
}

export function useUpdatePost(postId: string) {
  const userId = useUserId();
  const invalidate = useInvalidatePosts();
  return useMutation({ mutationFn: (input: PostInput) => updatePost(userId!, postId, input), onSuccess: () => invalidate(postId) });
}

export function useSetPostStatus(postId: string) {
  const invalidate = useInvalidatePosts();
  return useMutation({ mutationFn: (status: Exclude<PostStatus, 'expired'>) => setPostStatus(postId, status), onSuccess: () => invalidate(postId) });
}

export function useDeletePost(postId: string) {
  const invalidate = useInvalidatePosts();
  return useMutation({ mutationFn: () => deletePost(postId), onSuccess: () => invalidate(postId) });
}
