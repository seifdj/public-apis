import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, sizes, spacing } from '@/theme/theme';
import { Text } from '@/ui/Text';

export interface ListRowProps {
  icon?: ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  tone?: 'default' | 'danger';
  /** Replaces the chevron (badge, switch...). */
  right?: ReactNode;
  first?: boolean;
}

export function ListRow({ icon, label, value, onPress, tone = 'default', right, first = false }: ListRowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.divider, pressed && styles.pressed]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text variant="bodyStrong" tone={tone === 'danger' ? 'danger' : 'default'} style={styles.label}>
        {label}
      </Text>
      {value ? (
        <Text variant="caption" tone="secondary">
          {value}
        </Text>
      ) : null}
      {right ?? (onPress ? <ChevronRight color={colors.muted} size={18} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: sizes.touchMin + 8, paddingVertical: spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { opacity: 0.6 },
  icon: { width: 28, alignItems: 'center' },
  label: { flex: 1 },
});
