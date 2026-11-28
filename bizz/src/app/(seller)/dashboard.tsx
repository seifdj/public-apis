import { useRouter } from 'expo-router';
import { Plus, Repeat } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useMyShop, useSwitchMode } from '@/features/account/hooks';
import { fr } from '@/i18n/fr';
import { colors, radius, shadows, spacing } from '@/theme/theme';
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

/** 8. Espace prestataire. Step 2 shows the shell; quota, stats and requests are wired in steps 3 and 7. */
export default function DashboardScreen() {
  const router = useRouter();
  const shop = useMyShop().data;
  const switchMode = useSwitchMode();

  return (
    <Screen withTabBar>
      <View style={styles.header}>
        <Avatar name={shop?.name ?? ''} uri={shop?.avatar_url} />
        <View style={styles.flex}>
          <Text variant="caption" tone="secondary">
            {fr.nav.dashboard}
          </Text>
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

      <View style={[styles.quota, shadows.button]}>
        <View style={styles.flex}>
          <Text variant="h3" tone="onPrimary">
            {fr.seller.freePostTitle}
          </Text>
          <Text variant="caption" style={styles.quotaBody}>
            {fr.seller.freePostBody}
          </Text>
        </View>
        <PillButton label={fr.nav.publish} variant="accent" size="sm" icon={<Plus color={colors.textOnPrimary} size={16} />} onPress={() => router.push('/publish')} />
      </View>

      <View style={styles.stats}>
        <Stat value="0" label={fr.seller.statsViews} />
        <Stat value="0" label={fr.seller.statsMessages} />
        <Stat value={String(shop?.followers_count ?? 0)} label={fr.seller.statsFollowers} />
      </View>

      {shop?.is_founder ? (
        <GlassCard style={styles.block}>
          <View style={styles.founder}>
            <StatusBadge kind="founder" />
            <Text variant="caption" tone="secondary" style={styles.flex}>
              {shop.founder_rank ? `N° ${shop.founder_rank}` : ''}
            </Text>
          </View>
        </GlassCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  quota: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.primary },
  quotaBody: { color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  stat: { flex: 1 },
  block: { marginTop: spacing.lg },
  founder: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
