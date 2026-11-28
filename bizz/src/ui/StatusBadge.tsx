import { Check } from 'lucide-react-native';
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
  founder: { label: fr.status.founder, bg: colors.accentSoft, fg: colors.accentText },
  plus: { label: fr.common.appNamePlus, bg: colors.primary, fg: colors.textOnPrimary },
};

export interface StatusBadgeProps {
  kind: BadgeKind;
  /** Overrides the accessible label (and the text unless `hideText`). */
  label?: string;
  /** Icon-only: a check mark in the badge colours. */
  hideText?: boolean;
}

export function StatusBadge({ kind, label, hideText = false }: StatusBadgeProps) {
  const c = config[kind];
  const text = label ?? c.label;
  return (
    <View style={[styles.base, hideText && styles.iconOnly, { backgroundColor: c.bg }]} accessibilityLabel={text}>
      {hideText ? (
        <Check color={c.fg} size={14} strokeWidth={3} />
      ) : (
        <Text variant="label" style={{ color: c.fg }}>
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.pill },
  iconOnly: { width: 24, height: 24, paddingHorizontal: 0, paddingVertical: 0, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});
