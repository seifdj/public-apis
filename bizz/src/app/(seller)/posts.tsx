import { useRouter } from 'expo-router';
import { LayoutGrid } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { effectiveStatus } from '@/features/posts/api';
import { useMyPosts } from '@/features/posts/hooks';
import { PostRow } from '@/features/posts/PostRow';
import { fr } from '@/i18n/fr';
import { colors, spacing } from '@/theme/theme';
import { Chip, EmptyState, GlassCard, Screen, Text } from '@/ui';

type Filter = keyof typeof fr.myPosts.filters;
const FILTERS: Filter[] = ['all', 'available', 'reserved', 'sold', 'expired'];

/** « Mes publications » avec leur statut (Dispo / Réservé / Vendu / Expirées). */
export default function PostsScreen() {
  const router = useRouter();
  const query = useMyPosts();
  const [filter, setFilter] = useState<Filter>('all');
  const posts = (query.data ?? []).filter((p) => filter === 'all' || effectiveStatus(p) === filter);

  return (
    <Screen withTabBar>
      <Text variant="h1">{fr.myPosts.title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filterBar}>
        {FILTERS.map((f) => (
          <Chip key={f} label={fr.myPosts.filters[f]} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>
      <GlassCard padding={posts.length > 0 ? spacing.lg : spacing.lg}>
        {query.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : posts.length === 0 ? (
          (query.data ?? []).length === 0 ? (
            <EmptyState icon={<LayoutGrid color={colors.primary} size={28} />} title={fr.myPosts.emptyTitle} description={fr.myPosts.emptyBody} actionLabel={fr.nav.publish} onAction={() => router.push('/publish')} />
          ) : (
            <EmptyState title={fr.myPosts.emptyFilter} />
          )
        ) : (
          posts.map((post, i) => <PostRow key={post.id} post={post} first={i === 0} onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })} />)
        )}
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterBar: { marginVertical: spacing.lg, flexGrow: 0 },
  filters: { gap: spacing.sm },
  loader: { marginVertical: spacing.xxl },
});
