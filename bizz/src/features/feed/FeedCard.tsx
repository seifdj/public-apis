import { Image } from 'expo-image';
import { Bookmark, Ellipsis, Heart, MapPin, Share2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { APP_NAME } from '@/config/brand';
import type { FeedItem } from '@/features/social/api';
import { fr } from '@/i18n/fr';
import { publicUrl } from '@/lib/media';
import { colors, radius, shadows, spacing } from '@/theme/theme';
import { Avatar, formatPrice, GlassCard, PillButton, StatusBadge, Text } from '@/ui';

function Action({ label, icon, count, onPress, testID }: { label: string; icon: ReactNode; count?: number; onPress: () => void; testID?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.action, shadows.glass, pressed && styles.pressed]} testID={testID}>
      {icon}
      {count !== undefined && count > 0 ? (
        <Text variant="label" style={styles.count}>
          {count > 999 ? `${(count / 1000).toFixed(1).replace('.', ',')}k` : count}
        </Text>
      ) : null}
    </Pressable>
  );
}

export interface FeedCardProps {
  item: FeedItem;
  height: number;
  onOpen: () => void;
  onOpenShop: () => void;
  onLike: () => void;
  onSave: () => void;
  onFollow: () => void;
  onMore: () => void;
  onAsk: () => void;
}

/**
 * One post = one page of the feed: photo filling the card, shop chip on top, action column on
 * the right (like, save, share, more), and a glass panel with title, price, hashtags and the
 * "C'est dispo ?" button.
 */
export function FeedCard({ item, height, onOpen, onOpenShop, onLike, onSave, onFollow, onMore, onAsk }: FeedCardProps) {
  const cover = item.media[0];
  const price = formatPrice(item.price_cents, item.price_mode);
  const share = () => void Share.share({ message: fr.feed.shareText(item.title, price, item.shop_slug, APP_NAME) }).catch(() => {});

  return (
    <View style={[styles.page, { height }]} testID="feed-card">
      <View style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${price}`} onPress={onOpen} style={StyleSheet.absoluteFill}>
          {cover ? <Image source={{ uri: publicUrl('post-media', cover.storage_path) }} style={styles.image} contentFit="cover" transition={150} /> : null}
        </Pressable>

        <View style={styles.top} pointerEvents="box-none">
          <Pressable accessibilityRole="button" accessibilityLabel={item.shop_name} onPress={onOpenShop} style={[styles.shop, shadows.glass]}>
            <Avatar name={item.shop_name} uri={item.shop_avatar_url} size={32} />
            <View style={styles.shopText}>
              <Text variant="label" numberOfLines={1}>
                {item.shop_name}
              </Text>
              <Text variant="label" tone="secondary" style={styles.small} numberOfLines={1}>
                {item.city_name}
                {item.distance_km !== null && item.distance_km > 0 ? ` · ${fr.feed.kmAway(item.distance_km)}` : ''}
              </Text>
            </View>
          </Pressable>
          <PillButton label={item.following ? fr.feed.following : fr.feed.follow} size="sm" variant={item.following ? 'light' : 'primary'} onPress={onFollow} style={styles.follow} testID="feed-follow" />
        </View>

        {item.media.length > 1 ? (
          <View style={styles.dots} pointerEvents="none">
            {item.media.slice(0, 6).map((m, i) => (
              <View key={m.storage_path} style={[styles.dot, i === 0 && styles.dotActive]} />
            ))}
          </View>
        ) : null}

        <View style={styles.actions} pointerEvents="box-none">
          <Action testID="feed-like" label={item.liked ? fr.feed.unlike : fr.feed.like} count={item.likes_count} onPress={onLike} icon={<Heart color={item.liked ? colors.accent : colors.primary} fill={item.liked ? colors.accent : 'transparent'} size={22} />} />
          <Action testID="feed-save" label={item.saved ? fr.feed.unsave : fr.feed.save} onPress={onSave} icon={<Bookmark color={colors.primary} fill={item.saved ? colors.primary : 'transparent'} size={22} />} />
          <Action label={fr.feed.share} onPress={share} icon={<Share2 color={colors.primary} size={22} />} />
          <Action testID="feed-more" label={fr.feed.more} onPress={onMore} icon={<Ellipsis color={colors.primary} size={22} />} />
        </View>

        <GlassCard padding={spacing.md} style={styles.info} opaque>
          <View style={styles.titleRow}>
            <Text variant="bodyStrong" numberOfLines={2} style={styles.flex}>
              {item.title}
            </Text>
            <Text variant="price" tone="accent">
              {price}
            </Text>
          </View>
          <View style={styles.metaRow}>
            {item.shop_is_founder ? <StatusBadge kind="founder" /> : null}
            {item.hashtags.length > 0 ? (
              <Text variant="caption" tone="primary" numberOfLines={1} style={styles.flex}>
                {item.hashtags.map((t) => `#${t}`).join(' ')}
              </Text>
            ) : (
              <View style={styles.city}>
                <MapPin color={colors.textSecondary} size={13} />
                <Text variant="caption" tone="secondary">
                  {item.city_name}
                </Text>
              </View>
            )}
            <PillButton label={fr.post.askAvailable} size="sm" variant="accent" onPress={onAsk} />
          </View>
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  card: { flex: 1, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.mutedSoft },
  image: { width: '100%', height: '100%' },
  flex: { flex: 1 },
  top: { position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.glassOpaque, borderRadius: radius.pill, paddingRight: spacing.md, paddingLeft: 4, paddingVertical: 4, flexShrink: 1 },
  shopText: { flexShrink: 1 },
  small: { fontSize: 11 },
  follow: { marginLeft: 'auto' },
  dots: { position: 'absolute', top: 64, alignSelf: 'center', flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.6)' },
  dotActive: { backgroundColor: colors.background, width: 14 },
  actions: { position: 'absolute', right: spacing.md, bottom: 132, gap: spacing.md, alignItems: 'center' },
  action: { width: 48, minHeight: 48, borderRadius: 24, backgroundColor: colors.glassOpaque, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  count: { fontSize: 11, lineHeight: 14 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  info: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  city: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
});
