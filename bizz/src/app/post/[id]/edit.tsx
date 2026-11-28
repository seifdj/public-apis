import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { useCity } from '@/features/account/hooks';
import { useUserId } from '@/features/auth/AuthProvider';
import { usePost, useUpdatePost } from '@/features/posts/hooks';
import { PostForm } from '@/features/posts/PostForm';
import { fr } from '@/i18n/fr';
import { colors, spacing } from '@/theme/theme';
import { EmptyState, Screen, ScreenHeader } from '@/ui';

/** Modifier une publication. Never consumes quota. */
export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useUserId();
  const query = usePost(id);
  const post = query.data;
  const city = useCity(post?.city_id);
  const update = useUpdatePost(id);

  const ready = !query.isPending && (!post || !city.isPending);
  return (
    <Screen>
      <ScreenHeader title={fr.post.editTitle} />
      {!ready ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : !post || post.author_id !== userId ? (
        <EmptyState title={fr.post.notFound} />
      ) : (
        <PostForm
          initial={{
            images: post.post_media.filter((m) => m.storage_path).map((m) => ({ key: m.id, storagePath: m.storage_path!, width: m.width, height: m.height })),
            type: post.type,
            title: post.title,
            priceMode: post.price_mode,
            priceCents: post.price_cents,
            city: city.data ?? null,
            categoryId: post.category_id,
            description: post.description ?? '',
            hashtags: post.hashtags,
          }}
          submitLabel={fr.post.save}
          onSubmit={async (input) => {
            await update.mutateAsync(input);
            router.back();
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ loader: { marginTop: spacing.xxxl } });
