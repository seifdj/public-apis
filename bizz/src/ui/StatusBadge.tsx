import { StyleSheet, View } from 'react-native';

import { fr } from '@/i18n/fr';
import { colors, radius, spacing } from '@/theme/theme';
import { Text } from '@/ui/Text';

export type BadgeKind = 'available' | 'reserved' | 'sold' | 'expired' | 'hidden' | 'sponsored' | 'founder' | 'plus';

const config: Record<BadgeKind, { label: string; bg: string; fg: string }> = {
  available: { label: fr.status.available, bg: colors.successSoft, fg: colors.success },
  reserved: { label: fr.status.reserved, bg: colors.warningSoft, fg: colors.warning },
  sold: { label: fr.status.sold, bg: colors.mutedSoft, fg: colors.textSecondary },
  expired: { label: fr.status.expired, bg: colors.mutedSoft, fg: colors.muted },
  hidden: { label: fr.status.hidden, bg: colors.dangerSoft, fg: colors.danger },
  sponsored: { label: fr.status.sponsored, bg: colors.accentSoft, fg: colors.accentText },
  founder: { label: 'Fondateur', bg: colors.accentSoft, fg: colors.accentText },
  plus: { label: fr.common.appNamePlus, bg: colors.primary, fg: colors.textOnPrimary },
};

export function StatusBadge({ kind }: { kind: BadgeKind }) {
  const c = config[kind];
  return (
    <View style={[styles.base, { backgroundColor: c.bg }]} accessibilityLabel={c.label}>
      <Text variant="label" style={{ color: c.fg }}>
        {c.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.pill },
});
