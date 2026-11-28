import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FeedItem } from '@/features/social/api';
import { fr } from '@/i18n/fr';
import { publicUrl } from '@/lib/media';
import { colors, radius, spacing } from '@/theme/theme';
import { formatPrice, Text } from '@/ui';

/** Search result: cover photo with the price, then title, shop and place. Two per row. */
export function ResultTile({ item, onPress }: { item: FeedItem; onPress: () => void }) {
  const cover = item.media[0];
  const price = formatPrice(item.price_cents, item.price_mode);
  const where = item.distance_km !== null && item.distance_km > 0 ? `${item.city_name} · ${fr.feed.kmAway(item.distance_km)}` : item.city_name;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${price}, ${item.shop_name}, ${where}`}
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
      testID="result-tile"
    >
      <View style={styles.photo}>
        {cover ? <Image source={{ uri: publicUrl('post-media', cover.storage_path) }} style={styles.image} contentFit="cover" transition={150} /> : null}
        <View style={styles.price}>
          <Text variant="label" style={styles.priceText}>
            {price}
          </Text>
        </View>
      </View>
      <Text variant="bodyStrong" numberOfLines={1} style={styles.title}>
        {item.title}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {item.shop_name}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {where}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pressed: { opacity: 0.85 },
  photo: { aspectRatio: 0.8, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.mutedSoft },
  image: { width: '100%', height: '100%' },
  price: { position: 'absolute', left: spacing.sm, bottom: spacing.sm, backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  priceText: { color: colors.text, fontSize: 12 },
  title: { marginTop: spacing.sm },
});
