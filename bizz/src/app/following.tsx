import { useRouter } from 'expo-router';
import { Store } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { useFollowedShops } from '@/features/social/hooks';
import { fr } from '@/i18n/fr';
import { colors, spacing } from '@/theme/theme';
import { Avatar, EmptyState, GlassCard, ListRow, Screen, ScreenHeader } from '@/ui';

/** Abonnements : les boutiques suivies. */
export default function FollowingScreen() {
  const router = useRouter();
  const query = useFollowedShops();
  const shops = query.data ?? [];
  return (
    <Screen>
      <ScreenHeader title={fr.library.following} />
      {query.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : shops.length === 0 ? (
        <EmptyState icon={<Store color={colors.primary} size={28} />} title={fr.library.followingEmpty.title} description={fr.library.followingEmpty.body} />
      ) : (
        <GlassCard testID="following-list">
          {shops.map((shop, i) => (
            <ListRow
              key={shop.id}
              first={i === 0}
              icon={<Avatar name={shop.name} uri={shop.avatar_url} size={36} />}
              label={shop.name}
              value={fr.library.postsCount(shop.posts_count)}
              onPress={() => router.push({ pathname: '/shop/[slug]', params: { slug: shop.slug } })}
            />
          ))}
        </GlassCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ loader: { marginTop: spacing.xxxl } });
