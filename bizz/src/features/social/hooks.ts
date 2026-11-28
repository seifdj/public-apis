import { type InfiniteData, type QueryClient, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import {
  blockUser,
  type FeedCursor,
  type FeedItem,
  type FeedTab,
  fetchBlockedUsers,
  fetchDrops,
  fetchFeedPage,
  fetchFollowedShops,
  fetchIsFollowing,
  fetchPostFlags,
  fetchSavedPosts,
  setFollowing,
  setLiked,
  setSaved,
  unblockUser,
} from '@/features/social/api';

type FeedPage = { items: FeedItem[]; next: FeedCursor | null };
type FeedData = InfiniteData<FeedPage, FeedCursor | null>;

export const socialKeys = {
  feed: (tab: FeedTab) => ['feed', tab] as const,
  drops: ['drops'] as const,
  postFlags: (postId: string) => ['post-flags', postId] as const,
  following: (shopId: string) => ['is-following', shopId] as const,
  saved: ['saved-posts'] as const,
  followedShops: ['followed-shops'] as const,
  blocked: ['blocked-users'] as const,
};

export function useFeed(tab: FeedTab) {
  const userId = useUserId();
  return useInfiniteQuery({
    queryKey: socialKeys.feed(tab),
    queryFn: ({ pageParam }) => fetchFeedPage(tab, pageParam),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (last) => last.next,
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useDrops() {
  const userId = useUserId();
  return useQuery({ queryKey: socialKeys.drops, queryFn: fetchDrops, enabled: !!userId, staleTime: 60_000 });
}

export function usePostFlags(postId: string | undefined) {
  const userId = useUserId();
  return useQuery({ queryKey: socialKeys.postFlags(postId ?? 'none'), queryFn: () => fetchPostFlags(userId!, postId!), enabled: !!userId && !!postId });
}

export function useIsFollowing(shopId: string | undefined) {
  const userId = useUserId();
  return useQuery({ queryKey: socialKeys.following(shopId ?? 'none'), queryFn: () => fetchIsFollowing(userId!, shopId!), enabled: !!userId && !!shopId });
}

export function useSavedPosts() {
  const userId = useUserId();
  return useQuery({ queryKey: socialKeys.saved, queryFn: () => fetchSavedPosts(userId!), enabled: !!userId });
}

export function useFollowedShops() {
  const userId = useUserId();
  return useQuery({ queryKey: socialKeys.followedShops, queryFn: () => fetchFollowedShops(userId!), enabled: !!userId });
}

export function useBlockedUsers() {
  const userId = useUserId();
  return useQuery({ queryKey: socialKeys.blocked, queryFn: fetchBlockedUsers, enabled: !!userId });
}

/** Applies a change to every cached feed item matching `match`, in the three tabs. */
function patchFeeds(client: QueryClient, match: (item: FeedItem) => boolean, patch: (item: FeedItem) => FeedItem) {
  client.setQueriesData<FeedData>({ queryKey: ['feed'] }, (data) =>
    data ? { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map((item) => (match(item) ? patch(item) : item)) })) } : data,
  );
}

/** Like, save and follow with an instant UI: the caches are updated first, the server follows. */
export function useSocialActions() {
  const client = useQueryClient();
  const userId = useUserId();

  const like = useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) => setLiked(userId!, postId, liked),
    onMutate: ({ postId, liked }) => {
      patchFeeds(client, (i) => i.id === postId && i.liked !== liked, (i) => ({ ...i, liked, likes_count: Math.max(0, i.likes_count + (liked ? 1 : -1)) }));
      client.setQueryData<{ liked: boolean; saved: boolean }>(socialKeys.postFlags(postId), (f) => (f ? { ...f, liked } : f));
    },
    onError: (_e, { postId, liked }) => {
      patchFeeds(client, (i) => i.id === postId, (i) => ({ ...i, liked: !liked, likes_count: Math.max(0, i.likes_count + (liked ? -1 : 1)) }));
      void client.invalidateQueries({ queryKey: socialKeys.postFlags(postId) });
    },
    onSettled: (_d, _e, { postId }) => void client.invalidateQueries({ queryKey: ['post', postId] }),
  });

  const save = useMutation({
    mutationFn: ({ postId, saved }: { postId: string; saved: boolean }) => setSaved(userId!, postId, saved),
    onMutate: ({ postId, saved }) => {
      patchFeeds(client, (i) => i.id === postId, (i) => ({ ...i, saved }));
      client.setQueryData<{ liked: boolean; saved: boolean }>(socialKeys.postFlags(postId), (f) => (f ? { ...f, saved } : f));
    },
    onError: (_e, { postId, saved }) => {
      patchFeeds(client, (i) => i.id === postId, (i) => ({ ...i, saved: !saved }));
      void client.invalidateQueries({ queryKey: socialKeys.postFlags(postId) });
    },
    onSettled: () => void client.invalidateQueries({ queryKey: socialKeys.saved }),
  });

  const follow = useMutation({
    mutationFn: ({ shopId, following }: { shopId: string; following: boolean }) => setFollowing(userId!, shopId, following),
    onMutate: ({ shopId, following }) => {
      patchFeeds(client, (i) => i.shop_id === shopId, (i) => ({ ...i, following }));
      client.setQueryData(socialKeys.following(shopId), following);
    },
    onError: (_e, { shopId, following }) => {
      patchFeeds(client, (i) => i.shop_id === shopId, (i) => ({ ...i, following: !following }));
      client.setQueryData(socialKeys.following(shopId), !following);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: socialKeys.feed('following') });
      void client.invalidateQueries({ queryKey: socialKeys.drops });
      void client.invalidateQueries({ queryKey: socialKeys.followedShops });
      void client.invalidateQueries({ queryKey: ['shop'] }); // followers_count on shop pages
    },
  });

  return { like, save, follow };
}

/** Blocking hides someone everywhere: every list that may contain them is refetched. */
export function useBlockActions() {
  const client = useQueryClient();
  const refresh = () =>
    Promise.all(
      [['feed'], socialKeys.drops, socialKeys.saved, socialKeys.followedShops, socialKeys.blocked, ['shop'], ['shop-posts'], ['is-following']].map((queryKey) =>
        client.invalidateQueries({ queryKey }),
      ),
    );
  const block = useMutation({ mutationFn: blockUser, onSuccess: refresh });
  const unblock = useMutation({ mutationFn: unblockUser, onSuccess: refresh });
  return { block, unblock };
}
