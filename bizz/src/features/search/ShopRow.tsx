import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { DirectoryShop } from '@/features/search/api';
import { fr } from '@/i18n/fr';
import { colors, spacing } from '@/theme/theme';
import { Avatar, StatusBadge, Text } from '@/ui';

/** Directory row: avatar, name, place and distance, number of posts. */
export function ShopRow({ shop, onPress, first = false }: { shop: DirectoryShop; onPress: () => void; first?: boolean }) {
  const where = shop.distance_km !== null && shop.distance_km > 0 ? `${shop.city_name} · ${fr.feed.kmAway(shop.distance_km)}` : shop.city_name;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${shop.name}, ${where}`} onPress={onPress} style={({ pressed }) => [styles.root, !first && styles.divider, pressed && styles.pressed]} testID="shop-row">
      <Avatar name={shop.name} uri={shop.avatar_url} size={44} />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
            {shop.name}
          </Text>
          {shop.is_founder ? <StatusBadge kind="founder" /> : null}
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {where} · {fr.library.postsCount(shop.posts_count)}
        </Text>
      </View>
      <ChevronRight color={colors.muted} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { opacity: 0.6 },
  body: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
});
