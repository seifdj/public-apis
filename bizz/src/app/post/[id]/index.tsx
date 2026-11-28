import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bookmark, CircleCheck, Ellipsis, Heart, MapPin, Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { formatCity } from '@/features/account/CityPicker';
import { useCity } from '@/features/account/hooks';
import { useUserId } from '@/features/auth/AuthProvider';
import { effectiveStatus } from '@/features/posts/api';
import { useDeletePost, usePost, useSetPostStatus } from '@/features/posts/hooks';
import { ContentMenu } from '@/features/social/ContentMenu';
import { usePostFlags, useSocialActions } from '@/features/social/hooks';
import { fr } from '@/i18n/fr';
import type { PostStatus } from '@/lib/database.types';
import { toUserMessage } from '@/lib/errors';
import { publicUrl } from '@/lib/media';
import { colors, radius, spacing } from '@/theme/theme';
import { Avatar, Chip, EmptyState, GlassCard, IconButton, PillButton, PriceTag, Screen, ScreenHeader, StatusBadge, Text } from '@/ui';

const SELLER_STATUSES: Exclude<PostStatus, 'expired'>[] = ['available', 'reserved', 'sold'];
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

/** Post detail. The author gets the status switch, Modifier and Supprimer; others get "C'est dispo ?". */
export default function PostScreen() {
  const { id, published } = useLocalSearchParams<{ id: string; published?: string }>();
  const router = useRouter();
  const userId = useUserId();
  const { width } = useWindowDimensions();
  const query = usePost(id);
  const post = query.data;
  const city = useCity(post?.city_id).data;
  const setStatus = useSetPostStatus(id);
  const remove = useDeletePost(id);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const flags = usePostFlags(id).data;
  const { like, save } = useSocialActions();

  if (query.isPending) {
    return (
      <Screen>
        <ScreenHeader />
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </Screen>
    );
  }
  if (!post) {
    return (
      <Screen>
        <ScreenHeader />
        <EmptyState title={fr.post.notFound} />
      </Screen>
    );
  }

  const isOwner = post.author_id === userId;
  const status = effectiveStatus(post);
  const imageWidth = width - spacing.screen * 2;
  const images = post.post_media.filter((m) => m.storage_path);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / imageWidth));

  const confirmDelete = () =>
    Alert.alert(fr.post.deleteTitle, fr.post.deleteBody, [
      { text: fr.common.cancel, style: 'cancel' },
      { text: fr.post.delete, style: 'destructive', onPress: () => remove.mutate(undefined, { onSuccess: () => router.back(), onError: (e) => setError(toUserMessage(e)) }) },
    ]);

  return (
    <Screen>
      <ScreenHeader
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        right={
          isOwner ? undefined : (
            <View style={styles.headerActions}>
              <IconButton
                label={flags?.liked ? fr.feed.unlike : fr.feed.like}
                icon={<Heart color={flags?.liked ? colors.accent : colors.primary} fill={flags?.liked ? colors.accent : 'transparent'} size={20} />}
                onPress={() => like.mutate({ postId: post.id, liked: !flags?.liked })}
                testID="post-like"
              />
              <IconButton
                label={flags?.saved ? fr.feed.unsave : fr.feed.save}
                icon={<Bookmark color={colors.primary} fill={flags?.saved ? colors.primary : 'transparent'} size={20} />}
                onPress={() => save.mutate({ postId: post.id, saved: !flags?.saved })}
                testID="post-save"
              />
              <IconButton label={fr.feed.more} icon={<Ellipsis color={colors.primary} size={20} />} onPress={() => setMenuOpen(true)} testID="post-more" />
            </View>
          )
        }
      />

      {published ? (
        <View style={styles.published} testID="post-published">
          <CircleCheck color={colors.success} size={20} />
          <Text variant="bodyStrong" tone="success">
            {fr.post.published}
          </Text>
        </View>
      ) : null}

      <View style={[styles.gallery, { width: imageWidth, height: imageWidth * 1.25 }]}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32}>
          {images.map((m) => (
            <Image key={m.id} source={{ uri: publicUrl('post-media', m.storage_path!) }} style={{ width: imageWidth, height: imageWidth * 1.25 }} contentFit="cover" transition={150} />
          ))}
        </ScrollView>
        {images.length > 1 ? (
          <View style={styles.counter}>
            <Text variant="label" tone="onPrimary">
              {fr.post.photoCount(page + 1, images.length)}
            </Text>
          </View>
        ) : null}
        {status !== 'available' ? (
          <View style={styles.badge}>
            <StatusBadge kind={status} solid />
          </View>
        ) : null}
      </View>

      <View style={styles.titleRow}>
        <Text variant="h2" style={styles.flex}>
          {post.title}
        </Text>
        <PriceTag priceCents={post.price_cents} mode={post.price_mode} />
      </View>
      <View style={styles.meta}>
        <Chip label={fr.post.types[post.type]} />
        {city ? (
          <View style={styles.city}>
            <MapPin color={colors.textSecondary} size={14} />
            <Text variant="caption" tone="secondary">
              {formatCity(city)}
            </Text>
          </View>
        ) : null}
      </View>

      {post.description ? <Text style={styles.block}>{post.description}</Text> : null}
      {post.hashtags.length > 0 ? (
        <Text tone="primary" style={styles.block}>
          {post.hashtags.map((t) => `#${t}`).join('  ')}
        </Text>
      ) : null}

      {post.shop ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${fr.post.seeShop} ${post.shop.name}`} onPress={() => router.push({ pathname: '/shop/[slug]', params: { slug: post.shop!.slug } })} style={styles.block}>
          <GlassCard padding={spacing.md}>
            <View style={styles.shop}>
              <Avatar name={post.shop.name} uri={post.shop.avatar_url} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">{post.shop.name}</Text>
                <Text variant="caption" tone="secondary">
                  @{post.shop.slug}
                </Text>
              </View>
              {post.shop.is_founder ? <StatusBadge kind="founder" /> : null}
            </View>
          </GlassCard>
        </Pressable>
      ) : null}

      {isOwner ? (
        <GlassCard style={styles.block}>
          <Text variant="label" tone="secondary">
            {fr.post.changeStatus.toUpperCase()}
          </Text>
          {status === 'expired' || status === 'hidden' ? (
            <View style={styles.statusRow}>
              <StatusBadge kind={status} />
            </View>
          ) : (
            <View style={styles.statusRow}>
              {SELLER_STATUSES.map((s) => (
                <Chip key={s} label={fr.status[s]} selected={post.status === s} onPress={() => setStatus.mutate(s, { onError: (e) => setError(toUserMessage(e)) })} />
              ))}
            </View>
          )}
          <Text variant="caption" tone="secondary">
            {fr.post.publishedOn(dateFormat.format(new Date(post.published_at)))} · {fr.post.expiresOn(dateFormat.format(new Date(post.expires_at)))}
          </Text>
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <PillButton label={fr.post.edit} variant="secondary" icon={<Pencil color={colors.primary} size={16} />} onPress={() => router.push({ pathname: '/post/[id]/edit', params: { id: post.id } })} style={styles.flex} testID="post-edit" />
            <PillButton label={fr.post.delete} variant="ghost" icon={<Trash2 color={colors.primary} size={16} />} loading={remove.isPending} onPress={confirmDelete} style={styles.flex} testID="post-delete" />
          </View>
        </GlassCard>
      ) : (
        <View style={styles.block}>
          <PillButton label={fr.post.askAvailable} variant="accent" size="lg" fullWidth disabled />
          <Text variant="caption" tone="secondary" align="center" style={styles.soon}>
            {fr.post.askSoon}
          </Text>
        </View>
      )}
      {!isOwner && post.shop ? (
        <ContentMenu visible={menuOpen} onClose={() => setMenuOpen(false)} target={{ type: 'post', id: post.id }} seller={{ userId: post.author_id, name: post.shop.name }} onBlocked={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxxl },
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  published: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.successSoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  gallery: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.mutedSoft },
  counter: { position: 'absolute', right: spacing.md, bottom: spacing.md, backgroundColor: 'rgba(21, 18, 43, 0.6)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badge: { position: 'absolute', left: spacing.md, top: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  city: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  block: { marginTop: spacing.lg },
  shop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  soon: { marginTop: spacing.sm },
});
