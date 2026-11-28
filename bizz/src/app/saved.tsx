import { useRouter } from 'expo-router';
import { Bookmark } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PostTile } from '@/features/posts/PostTile';
import { useSavedPosts } from '@/features/social/hooks';
import { fr } from '@/i18n/fr';
import { colors, spacing } from '@/theme/theme';
import { EmptyState, Screen, ScreenHeader } from '@/ui';

/** Favoris : les publications enregistrées, en grille. */
export default function SavedScreen() {
  const router = useRouter();
  const query = useSavedPosts();
  const posts = query.data ?? [];
  const rows: (typeof posts)[] = [];
  for (let i = 0; i < posts.length; i += 3) rows.push(posts.slice(i, i + 3));

  return (
    <Screen>
      <ScreenHeader title={fr.library.saved} />
      {query.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : posts.length === 0 ? (
        <EmptyState icon={<Bookmark color={colors.primary} size={28} />} title={fr.library.savedEmpty.title} description={fr.library.savedEmpty.body} />
      ) : (
        <View style={styles.grid} testID="saved-grid">
          {rows.map((row, i) => (
            <View key={i} style={styles.row}>
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
  grid: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
