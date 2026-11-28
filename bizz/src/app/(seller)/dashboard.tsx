import { useRouter } from 'expo-router';
import { Repeat } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useMyShop, useSwitchMode } from '@/features/account/hooks';
import { useAllowance, useMyPosts } from '@/features/posts/hooks';
import { PostRow } from '@/features/posts/PostRow';
import { QuotaCard } from '@/features/posts/QuotaCard';
import { fr } from '@/i18n/fr';
import { colors, spacing } from '@/theme/theme';
import { Avatar, GlassCard, PillButton, Screen, StatusBadge, Text } from '@/ui';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <GlassCard style={styles.stat} padding={spacing.md}>
      <Text variant="h2">{value}</Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </GlassCard>
  );
}

/** 8. Espace prestataire : quota du jour, trois chiffres, publications récentes. Stats and requests: steps 6 and 7. */
export default function DashboardScreen() {
  const router = useRouter();
  const shop = useMyShop().data;
  const switchMode = useSwitchMode();
  const allowance = useAllowance().data;
  const posts = useMyPosts().data ?? [];
  const recent = posts.slice(0, 3);

  return (
    <Screen withTabBar>
      <View style={styles.header}>
        <Avatar name={shop?.name ?? ''} uri={shop?.avatar_url} />
        <View style={styles.flex}>
          <View style={styles.nameRow}>
            <Text variant="caption" tone="secondary">
              {fr.nav.dashboard}
            </Text>
            {shop?.is_founder ? <StatusBadge kind="founder" /> : null}
          </View>
          <Text variant="h3" numberOfLines={1}>
            {shop?.name ?? ''}
          </Text>
        </View>
        <PillButton
          label={fr.profile.clientMode}
          size="sm"
          variant="secondary"
          icon={<Repeat color={colors.primary} size={16} />}
          loading={switchMode.isPending}
          onPress={() => switchMode.mutate('client', { onSuccess: () => router.replace('/(client)/feed') })}
          testID="switch-client"
        />
      </View>

      <View style={styles.block}>
        <QuotaCard allowance={allowance} onPublish={() => router.push('/publish')} onPublishMore={() => router.push('/publish-more')} />
      </View>

      <View style={styles.stats}>
        <Stat value="0" label={fr.seller.statsViews} />
        <Stat value="0" label={fr.seller.statsMessages} />
        <Stat value={String(shop?.followers_count ?? 0)} label={fr.seller.statsFollowers} />
      </View>

      {recent.length > 0 ? (
        <GlassCard style={styles.block}>
          <View style={styles.sectionHeader}>
            <Text variant="h3">{fr.myPosts.recent}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/(seller)/posts')} hitSlop={10}>
              <Text variant="bodyStrong" tone="primary">
                {fr.common.seeAll}
              </Text>
            </Pressable>
          </View>
          {recent.map((post, i) => (
            <PostRow key={post.id} post={post} first={i === 0} onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })} />
          ))}
        </GlassCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  block: { marginTop: spacing.lg },
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  stat: { flex: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
});
