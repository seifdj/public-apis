import { useRouter } from 'expo-router';
import { Search, Store } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/features/posts/CategoryPicker';
import { useCategories } from '@/features/posts/hooks';
import { useShops } from '@/features/search/hooks';
import { PlaceChip } from '@/features/search/PlaceChip';
import { ShopRow } from '@/features/search/ShopRow';
import { fr } from '@/i18n/fr';
import { useSearchStore } from '@/store/search';
import { colors, radius, spacing } from '@/theme/theme';
import { EmptyState, GlassCard, Screen, Text, TextField } from '@/ui';

/** 5. Recherche et annuaire : barre de recherche, lieu et rayon, grille de catégories, vendeurs près de toi. */
export default function SearchScreen() {
  const router = useRouter();
  const start = useSearchStore((s) => s.start);
  const categories = useCategories().data ?? [];
  const shops = useShops({ limit: 12 });
  const [query, setQuery] = useState('');

  const go = (patch: Parameters<typeof start>[0]) => {
    start(patch);
    router.push('/search-results');
  };

  return (
    <Screen withTabBar>
      <Text variant="h1">{fr.search.title}</Text>
      <View style={styles.block}>
        <TextField
          label={fr.search.title}
          hideLabel
          value={query}
          onChangeText={setQuery}
          placeholder={fr.search.placeholder}
          returnKeyType="search"
          autoCorrect={false}
          onSubmitEditing={() => query.trim() && go({ query: query.trim() })}
          left={<Search color={colors.muted} size={18} />}
          testID="search-input"
        />
      </View>
      <View style={styles.place}>
        <PlaceChip />
      </View>

      <Text variant="h3" style={styles.section}>
        {fr.search.categories}
      </Text>
      <View style={styles.grid}>
        {categories.map((category) => (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={category.label}
            onPress={() => go({ categoryId: category.id })}
            style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
            testID={`search-category-${category.slug}`}
          >
            <View style={styles.cellIcon}>
              <CategoryIcon name={category.icon} size={24} />
            </View>
            <Text variant="label" align="center" numberOfLines={2} style={styles.cellLabel}>
              {category.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text variant="h3" style={styles.section}>
        {fr.search.nearbyShops}
      </Text>
      <GlassCard testID="nearby-shops">
        {shops.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (shops.data ?? []).length === 0 ? (
          <EmptyState icon={<Store color={colors.primary} size={28} />} title={shops.isError ? fr.errors.network : fr.search.noShops.title} description={shops.isError ? undefined : fr.search.noShops.body} />
        ) : (
          (shops.data ?? []).map((shop, i) => <ShopRow key={shop.id} shop={shop} first={i === 0} onPress={() => router.push({ pathname: '/shop/[slug]', params: { slug: shop.slug } })} />)
        )}
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing.lg },
  place: { flexDirection: 'row', marginTop: spacing.md },
  section: { marginTop: spacing.xxl, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg },
  cell: { width: '25%', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  cellIcon: { width: 56, height: 56, borderRadius: radius.md + 2, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cellLabel: { fontSize: 11, lineHeight: 14 },
  pressed: { opacity: 0.7 },
  loader: { marginVertical: spacing.xl },
});
