import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { formatCity } from '@/features/account/CityPicker';
import { useCity } from '@/features/account/hooks';
import { useUserId } from '@/features/auth/AuthProvider';
import { useShopBySlug, useShopPosts } from '@/features/posts/hooks';
import { PostTile } from '@/features/posts/PostTile';
import { fr } from '@/i18n/fr';
import { colors, sizes, spacing } from '@/theme/theme';
import { Avatar, Chip, EmptyState, GlassCard, PillButton, Screen, ScreenHeader, StatusBadge, Text } from '@/ui';

function Counter({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.counter}>
      <Text variant="h3">{value}</Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

/** 6. Profil boutique : identité, compteurs, liens, grille des publications, onglet Avis. */
export default function ShopScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const userId = useUserId();
  const shopQuery = useShopBySlug(slug);
  const shop = shopQuery.data;
  const city = useCity(shop?.city_id).data;
  const posts = useShopPosts(shop?.id);
  const [tab, setTab] = useState<'posts' | 'reviews'>('posts');

  if (shopQuery.isPending) {
    return (
      <Screen>
        <ScreenHeader />
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </Screen>
    );
  }
  if (!shop) {
    return (
      <Screen>
        <ScreenHeader />
        <EmptyState title={fr.shop.notFound} />
      </Screen>
    );
  }

  const isOwner = shop.owner_id === userId;
  const links = [
    shop.instagram ? `${fr.openShop.instagram} @${shop.instagram}` : null,
    shop.snapchat ? `${fr.openShop.snapchat} @${shop.snapchat}` : null,
    shop.tiktok ? `${fr.openShop.tiktok} @${shop.tiktok}` : null,
    shop.whatsapp ? fr.openShop.whatsapp : null,
  ].filter((l): l is string => l !== null);
  const list = posts.data ?? [];
  const rows: (typeof list)[] = [];
  for (let i = 0; i < list.length; i += 3) rows.push(list.slice(i, i + 3));

  return (
    <Screen>
      <ScreenHeader />
      <GlassCard size="xl">
        <View style={styles.center}>
          <Avatar name={shop.name} uri={shop.avatar_url} size={sizes.avatarLg} />
          <Text variant="h2" align="center">
            {shop.name}
          </Text>
          <Text tone="secondary">@{shop.slug}</Text>
          <View style={styles.row}>
            {shop.is_founder ? <StatusBadge kind="founder" /> : null}
            {city ? (
              <View style={styles.city}>
                <MapPin color={colors.textSecondary} size={14} />
                <Text variant="caption" tone="secondary">
                  {formatCity(city)}
                </Text>
              </View>
            ) : null}
          </View>
          {shop.bio ? (
            <Text align="center" tone="secondary">
              {shop.bio}
            </Text>
          ) : null}
        </View>

        <View style={styles.counters}>
          <Counter value={String(shop.followers_count)} label={fr.shop.followers} />
          <Counter value={String(shop.posts_count)} label={fr.shop.posts} />
          <Counter value={shop.rating_count > 0 && shop.rating_avg !== null ? shop.rating_avg.toFixed(1).replace('.', ',') : fr.shop.noRating} label={fr.shop.rating} />
        </View>

        {isOwner ? (
          <PillButton label={fr.shop.edit} variant="secondary" fullWidth icon={<Pencil color={colors.primary} size={16} />} onPress={() => router.push('/shop-edit')} testID="shop-edit" />
        ) : (
          <View style={styles.actions}>
            <PillButton label={fr.shop.follow} disabled style={styles.flex} />
            <PillButton label={fr.shop.message} variant="ghost" disabled style={styles.flex} />
          </View>
        )}

        {links.length > 0 ? (
          <View style={styles.links}>
            {links.map((l) => (
              <Chip key={l} label={l} />
            ))}
          </View>
        ) : null}
      </GlassCard>

      <View style={styles.tabs}>
        <Chip label={fr.shop.tabPosts} selected={tab === 'posts'} onPress={() => setTab('posts')} />
        <Chip label={fr.shop.tabReviews} selected={tab === 'reviews'} onPress={() => setTab('reviews')} />
      </View>

      {tab === 'reviews' ? (
        <EmptyState title={fr.shop.reviewsSoon} />
      ) : posts.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : list.length === 0 ? (
        <EmptyState title={fr.shop.empty} />
      ) : (
        <View style={styles.grid} testID="shop-grid">
          {rows.map((row, i) => (
            <View key={i} style={styles.gridRow}>
              {row.map((post) => (
                <PostTile key={post.id} post={post} onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })} />
              ))}
              {Array.from({ length: 3 - row.length }, (_, k) => (
                <View key={`pad-${k}`} style={styles.flex} />
              ))}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxxl },
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  city: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  counters: { flexDirection: 'row', marginVertical: spacing.lg },
  counter: { flex: 1, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: spacing.md },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.md },
  grid: { gap: spacing.sm },
  gridRow: { flexDirection: 'row', gap: spacing.sm },
});
