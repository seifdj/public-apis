import { Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { PostAllowance } from '@/features/posts/api';
import { fr } from '@/i18n/fr';
import { colors, radius, shadows, spacing } from '@/theme/theme';
import { PillButton, Text } from '@/ui';

export function resetCountdown(nextReset: string, now = Date.now()): string {
  const ms = Math.max(0, new Date(nextReset).getTime() - now);
  const minutes = Math.ceil(ms / 60_000);
  return fr.quota.resetIn(Math.floor(minutes / 60), minutes % 60);
}

export function quotaHeadline(a: PostAllowance): { title: string; body: string } {
  const freeLeft = Math.max(0, a.freeDaily - a.usedToday);
  if (freeLeft > 0) return { title: fr.quota.freeLeft(freeLeft), body: fr.quota.resetsAtMidnight };
  if (a.credits > 0) return { title: fr.quota.credits(a.credits), body: fr.quota.creditsLeft(a.credits) };
  return { title: fr.quota.freeUsed, body: resetCountdown(a.nextReset) };
}

/** Navy card of the seller dashboard: what is left today, and the Publier (or Publier plus) button. */
export function QuotaCard({ allowance, onPublish, onPublishMore }: { allowance: PostAllowance | undefined; onPublish: () => void; onPublishMore: () => void }) {
  const headline = allowance ? quotaHeadline(allowance) : { title: fr.common.loading, body: '' };
  const canPost = allowance?.canPost ?? true;
  return (
    <View style={[styles.root, shadows.button]} testID="quota-card">
      <View style={styles.flex}>
        <Text variant="h3" tone="onPrimary">
          {headline.title}
        </Text>
        {headline.body ? (
          <Text variant="caption" style={styles.body}>
            {headline.body}
          </Text>
        ) : null}
      </View>
      {canPost ? (
        <PillButton label={fr.nav.publish} variant="accent" size="sm" icon={<Plus color={colors.textOnPrimary} size={16} />} onPress={onPublish} testID="quota-publish" />
      ) : (
        <PillButton label={fr.quota.publishMore} variant="accent" size="sm" onPress={onPublishMore} testID="quota-more" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.primary },
  flex: { flex: 1 },
  body: { color: 'rgba(255,255,255,0.88)', marginTop: 2 },
});
