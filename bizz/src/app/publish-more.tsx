import { Sparkles } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { useAllowance } from '@/features/posts/hooks';
import { resetCountdown } from '@/features/posts/QuotaCard';
import { fr } from '@/i18n/fr';
import { colors, spacing } from '@/theme/theme';
import { EmptyState, GlassCard, Screen, ScreenHeader, Text } from '@/ui';

/** 10. Publier plus : packs, Bizz+ and boosts arrive with step 9 (in-app purchases). */
export default function PublishMoreScreen() {
  const allowance = useAllowance().data;
  return (
    <Screen>
      <ScreenHeader />
      <Text variant="h1">{fr.quota.publishMoreTitle}</Text>
      <GlassCard style={styles.card}>
        <EmptyState icon={<Sparkles color={colors.primary} size={28} />} title={fr.common.soon} description={fr.quota.publishMoreBody} />
      </GlassCard>
      {allowance && !allowance.canPost ? (
        <Text tone="secondary" align="center" style={styles.card}>
          {resetCountdown(allowance.nextReset)}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { marginTop: spacing.lg } });
