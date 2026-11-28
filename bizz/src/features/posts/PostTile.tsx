import { Image } from 'expo-image';
import { Images } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { effectiveStatus, type PostWithMedia } from '@/features/posts/api';
import { publicUrl } from '@/lib/media';
import { colors, radius, spacing } from '@/theme/theme';
import { formatPrice, StatusBadge, Text } from '@/ui';

export function coverUrl(post: PostWithMedia): string | null {
  const first = post.post_media[0];
  return first?.storage_path ? publicUrl('post-media', first.storage_path) : null;
}

/** Grid tile: cover photo, price, and the status when it is not simply "available". */
export function PostTile({ post, onPress }: { post: PostWithMedia; onPress: () => void }) {
  const status = effectiveStatus(post);
  const uri = coverUrl(post);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${post.title}, ${formatPrice(post.price_cents, post.price_mode)}`} onPress={onPress} style={({ pressed }) => [styles.root, pressed && styles.pressed]}>
      {uri ? <Image source={{ uri }} style={styles.image} contentFit="cover" transition={150} /> : <View style={styles.image} />}
      {status !== 'available' ? <View style={styles.dim} /> : null}
      {post.post_media.length > 1 ? (
        <View style={styles.multi}>
          <Images color={colors.textOnPrimary} size={14} />
        </View>
      ) : null}
      {status !== 'available' ? (
        <View style={styles.status}>
          <StatusBadge kind={status} solid />
        </View>
      ) : null}
      <View style={styles.price}>
        <Text variant="label" style={styles.priceText}>
          {formatPrice(post.price_cents, post.price_mode)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, aspectRatio: 0.8, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.mutedSoft },
  pressed: { opacity: 0.85 },
  image: { width: '100%', height: '100%' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255, 255, 255, 0.45)' },
  multi: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 24, height: 24, borderRadius: 8, backgroundColor: 'rgba(21, 18, 43, 0.55)', alignItems: 'center', justifyContent: 'center' },
  status: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  price: { position: 'absolute', left: spacing.sm, bottom: spacing.sm, backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  priceText: { color: colors.text, fontSize: 12 },
});
