import { useRouter } from 'expo-router';
import { Compass } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DropsRow } from '@/features/feed/DropsRow';
import { PlaceChip } from '@/features/search/PlaceChip';
import { FeedCard } from '@/features/feed/FeedCard';
import { type FeedItem, type FeedTab, recordViews } from '@/features/social/api';
import { ContentMenu } from '@/features/social/ContentMenu';
import { useDrops, useFeed, useSocialActions } from '@/features/social/hooks';
import { fr } from '@/i18n/fr';
import { requestPosition } from '@/lib/geo';
import { usePlaceStore } from '@/store/place';
import { colors, sizes, spacing } from '@/theme/theme';
import { Chip, EmptyState, Halos, Text, Wordmark } from '@/ui';

const TABS: FeedTab[] = ['for_you', 'following', 'nearby'];
const EMPTY = { for_you: fr.feed.emptyForYou, following: fr.feed.emptyFollowing, nearby: fr.feed.emptyNearby } as const;

/** 4. Feed : onglets « Pour toi », « Abonnements », « Près de moi », drops du jour, une publication par page. */
export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<FeedTab>('for_you');
  const [pageHeight, setPageHeight] = useState(0);
  const [menu, setMenu] = useState<FeedItem | null>(null);
  const feed = useFeed(tab);
  const drops = useDrops().data ?? [];
  const { like, save, follow } = useSocialActions();
  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const listRef = useRef<FlatList<FeedItem>>(null);

  // Views: collected while scrolling, sent in small batches.
  const pending = useRef(new Set<string>());
  const seen = useRef(new Set<string>());
  const flush = useCallback(() => {
    const ids = [...pending.current];
    pending.current.clear();
    if (ids.length > 0) void recordViews(ids);
  }, []);
  useEffect(() => {
    const id = setInterval(() => pending.current.size > 0 && flush(), 4000);
    return () => {
      clearInterval(id);
      flush();
    };
  }, [flush]);
  const onViewable = useCallback(({ viewableItems }: { viewableItems: { isViewable: boolean; item: FeedItem | null }[] }) => {
    for (const v of viewableItems) {
      if (v.isViewable && v.item && !seen.current.has(v.item.id)) {
        seen.current.add(v.item.id);
        pending.current.add(v.item.id);
      }
    }
  }, []);

  const changeTab = (next: FeedTab) => {
    setTab(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    // First visit of "Près de moi": ask for the position once. Refused = the profile city is used.
    const { place, gpsAsked, markGpsAsked, setPlace } = usePlaceStore.getState();
    if (next === 'nearby' && place.mode === 'profile' && !gpsAsked) {
      markGpsAsked();
      void requestPosition().then((coords) => coords && setPlace({ mode: 'gps', coords }));
    }
  };

  const tabBarSpace = sizes.tabBarHeight + sizes.tabBarBottomGap + insets.bottom;
  const openPost = (id: string) => router.push({ pathname: '/post/[id]', params: { id } });
  const openShop = (slug: string) => router.push({ pathname: '/shop/[slug]', params: { slug } });

  return (
    <View style={styles.root}>
      <Halos />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.brand}>
          <Wordmark size={24} />
        </View>
        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map((t) => (
            <Chip key={t} label={fr.feed.tabs[t]} selected={tab === t} onPress={() => changeTab(t)} testID={`feed-tab-${t}`} />
          ))}
        </View>
        {tab === 'nearby' ? (
          <View style={styles.place}>
            <PlaceChip selected />
          </View>
        ) : null}
        <DropsRow drops={drops} onOpen={(drop) => (drop.latest_post_id ? openPost(drop.latest_post_id) : openShop(drop.slug))} />
      </View>

      <View style={[styles.list, { marginBottom: tabBarSpace }]} onLayout={(e: LayoutChangeEvent) => setPageHeight(Math.round(e.nativeEvent.layout.height))}>
        {feed.isPending || pageHeight === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Compass color={colors.primary} size={28} />}
            title={feed.isError ? fr.errors.network : EMPTY[tab].title}
            description={feed.isError ? undefined : EMPTY[tab].body}
            actionLabel={feed.isError ? fr.common.retry : tab !== 'for_you' ? fr.feed.seeForYou : undefined}
            onAction={feed.isError ? () => void feed.refetch() : tab !== 'for_you' ? () => changeTab('for_you') : undefined}
          />
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item) => item.id}
            pagingEnabled
            snapToInterval={pageHeight}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
            onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && void feed.fetchNextPage()}
            onEndReachedThreshold={1.5}
            onRefresh={() => void feed.refetch()}
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={{ itemVisiblePercentThreshold: 70, minimumViewTime: 600 }}
            windowSize={5}
            initialNumToRender={2}
            maxToRenderPerBatch={3}
            ListFooterComponent={
              feed.isFetchingNextPage ? (
                <ActivityIndicator color={colors.primary} style={styles.footer} />
              ) : !feed.hasNextPage && items.length > 2 ? (
                <Text variant="caption" tone="secondary" align="center" style={styles.footer}>
                  {fr.feed.end}
                </Text>
              ) : undefined
            }
            renderItem={({ item }) => (
              <FeedCard
                item={item}
                height={pageHeight}
                onOpen={() => openPost(item.id)}
                onOpenShop={() => openShop(item.shop_slug)}
                onLike={() => like.mutate({ postId: item.id, liked: !item.liked })}
                onSave={() => save.mutate({ postId: item.id, saved: !item.saved })}
                onFollow={() => follow.mutate({ shopId: item.shop_id, following: !item.following })}
                onMore={() => setMenu(item)}
                onAsk={() => openPost(item.id)}
              />
            )}
          />
        )}
      </View>

      {menu ? <ContentMenu visible onClose={() => setMenu(null)} target={{ type: 'post', id: menu.id }} seller={{ userId: menu.author_id, name: menu.shop_name }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { gap: spacing.sm },
  brand: { paddingHorizontal: spacing.screen },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.screen, marginBottom: spacing.xs },
  place: { flexDirection: 'row', paddingHorizontal: spacing.screen, marginBottom: spacing.xs },
  list: { flex: 1 },
  loader: { marginTop: spacing.xxxl },
  footer: { paddingVertical: spacing.xl },
});
