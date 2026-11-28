import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { effectiveStatus, type PostWithMedia } from '@/features/posts/api';
import { coverUrl } from '@/features/posts/PostTile';
import { colors, radius, spacing } from '@/theme/theme';
import { formatPrice, StatusBadge, Text } from '@/ui';

/** List row of "Mes publications": thumbnail, title, price, status. */
export function PostRow({ post, onPress, first = false }: { post: PostWithMedia; onPress: () => void; first?: boolean }) {
  const uri = coverUrl(post);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.root, !first && styles.divider, pressed && styles.pressed]} testID="post-row">
      {uri ? <Image source={{ uri }} style={styles.thumb} contentFit="cover" transition={150} /> : <View style={styles.thumb} />}
      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {post.title}
        </Text>
        <View style={styles.meta}>
          <Text variant="caption" tone="accent" style={styles.price}>
            {formatPrice(post.price_cents, post.price_mode)}
          </Text>
          <StatusBadge kind={effectiveStatus(post)} />
        </View>
      </View>
      <ChevronRight color={colors.muted} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { opacity: 0.6 },
  thumb: { width: 56, height: 70, borderRadius: radius.sm + 2, backgroundColor: colors.mutedSoft },
  body: { flex: 1, gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  price: { fontFamily: 'Inter_700Bold' },
});
