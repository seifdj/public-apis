import { useRouter } from 'expo-router';
import { BellPlus, ChevronLeft, Search, SearchX, SlidersHorizontal } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMyProfile } from '@/features/account/hooks';
import { useCategories } from '@/features/posts/hooks';
import { FiltersSheet } from '@/features/search/FiltersSheet';
import { useAlertActions, useSearchResults, useShops } from '@/features/search/hooks';
import { PlaceChip } from '@/features/search/PlaceChip';
import { ResultTile } from '@/features/search/ResultTile';
import type { FeedItem } from '@/features/social/api';
import { fr } from '@/i18n/fr';
import { toUserMessage } from '@/lib/errors';
import { countActiveFilters, useSearchStore } from '@/store/search';
import { colors, spacing } from '@/theme/theme';
import { Avatar, Chip, EmptyState, Halos, IconButton, PillButton, Text, TextField } from '@/ui';

/** Résultats de recherche : barre, lieu, filtres, boutiques correspondantes, grille, alerte. */
export default function SearchResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { filters, setFilters } = useSearchStore();
  const profile = useMyProfile().data;
  const categories = useCategories().data ?? [];
  const [input, setInput] = useState(filters.query);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const results = useSearchResults(filters);
  const shops = useShops({ query: filters.query, limit: 8, enabled: filters.query.trim().length >= 2 });
  const { create } = useAlertActions();

  const items = useMemo(() => results.data?.pages.flat() ?? [], [results.data]);
  const category = categories.find((c) => c.id === filters.categoryId);
  const activeCount = countActiveFilters(filters);
  const matchingShops = filters.query.trim().length >= 2 ? (shops.data ?? []) : [];

  const createAlert = () => {
    if (!filters.query.trim() && filters.categoryId === null) {
      setNotice({ text: fr.search.alertNeedsCriterion, error: true });
      return;
    }
    create.mutate({ filters, profileCityId: profile?.city_id ?? null }, { onSuccess: () => setNotice({ text: fr.search.alertCreated, error: false }), onError: (e) => setNotice({ text: toUserMessage(e), error: true }) });
  };

  const header = (
    <View>
      {matchingShops.length > 0 ? (
        <View style={styles.shops}>
          <Text variant="label" tone="secondary">
            {fr.search.shops.toUpperCase()}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shopsRow}>
            {matchingShops.map((shop) => (
              <Pressable
                key={shop.id}
                accessibilityRole="button"
                accessibilityLabel={shop.name}
                onPress={() => router.push({ pathname: '/shop/[slug]', params: { slug: shop.slug } })}
                style={styles.shop}
                testID="result-shop"
              >
                <Avatar name={shop.name} uri={shop.avatar_url} size={52} />
                <Text variant="label" numberOfLines={1} style={styles.shopName}>
                  {shop.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.countRow}>
        <Text variant="bodyStrong" testID="result-count">
          {results.isPending ? fr.common.loading : fr.search.results(items.length, !!results.hasNextPage)}
        </Text>
        <PillButton label={fr.search.createAlert} size="sm" variant="secondary" icon={<BellPlus color={colors.primary} size={16} />} loading={create.isPending} onPress={createAlert} testID="create-alert" />
      </View>
      {notice ? (
        <Text variant="caption" tone={notice.error ? 'danger' : 'success'} style={styles.notice} accessibilityLiveRegion="polite" testID="alert-notice">
          {notice.text}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <Halos />
      <View style={[styles.top, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.bar}>
          <IconButton label={fr.common.back} icon={<ChevronLeft color={colors.primary} size={22} />} onPress={() => router.back()} />
          <View style={styles.flex}>
            <TextField
              label={fr.search.title}
              hideLabel
              value={input}
              onChangeText={setInput}
              placeholder={fr.search.placeholder}
              returnKeyType="search"
              autoCorrect={false}
              onSubmitEditing={() => {
                setNotice(null);
                setFilters({ query: input.trim(), sort: input.trim() && filters.sort === 'recent' ? 'relevance' : filters.sort });
              }}
              left={<Search color={colors.muted} size={18} />}
              testID="results-input"
            />
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsBar}>
          <Chip
            label={fr.search.filtersCount(activeCount)}
            selected={activeCount > 0}
            icon={<SlidersHorizontal color={activeCount > 0 ? colors.textOnPrimary : colors.primary} size={14} />}
            onPress={() => setFiltersOpen(true)}
            testID="open-filters"
          />
          <PlaceChip selected={filters.nearbyOnly} />
          {category ? <Chip label={category.label} selected onPress={() => setFilters({ categoryId: null })} /> : null}
          {filters.type ? <Chip label={fr.post.types[filters.type]} selected onPress={() => setFilters({ type: null })} /> : null}
          {filters.sort !== 'relevance' ? <Chip label={fr.search.sorts[filters.sort]} onPress={() => setFiltersOpen(true)} /> : null}
        </ScrollView>
      </View>

      {results.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList<FeedItem>
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState icon={<SearchX color={colors.primary} size={28} />} title={results.isError ? fr.errors.network : fr.search.empty.title} description={results.isError ? undefined : fr.search.empty.body} />
          }
          onEndReached={() => results.hasNextPage && !results.isFetchingNextPage && void results.fetchNextPage()}
          onEndReachedThreshold={0.6}
          ListFooterComponent={results.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : undefined}
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <ResultTile item={item} onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })} />
            </View>
          )}
        />
      )}

      <FiltersSheet
        visible={filtersOpen}
        filters={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setNotice(null);
          setFilters(next);
          setFiltersOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  top: { paddingHorizontal: spacing.screen },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chipsBar: { flexGrow: 0, marginTop: spacing.md, marginHorizontal: -spacing.screen },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.screen },
  list: { paddingHorizontal: spacing.screen, paddingTop: spacing.md },
  row: { gap: spacing.md },
  cell: { flex: 1, maxWidth: '50%', marginBottom: spacing.lg, paddingRight: 0 },
  loader: { marginVertical: spacing.xxl },
  shops: { marginBottom: spacing.lg, gap: spacing.sm },
  shopsRow: { gap: spacing.lg },
  shop: { alignItems: 'center', width: 72, gap: 4 },
  shopName: { fontSize: 11, maxWidth: 72 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md, gap: spacing.md },
  notice: { marginBottom: spacing.md },
});
