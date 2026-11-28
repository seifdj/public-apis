import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme/theme';
import { Text } from '@/ui/Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/** Filter chip: white glass by default, navy when selected. */
export function Chip({ label, selected = false, icon, onPress, style, testID }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      style={({ pressed }) => [styles.base, selected ? styles.selected : styles.idle, pressed && styles.pressed, style]}
    >
      {icon}
      <Text variant="caption" tone={selected ? 'onPrimary' : 'primary'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  idle: { backgroundColor: colors.primarySoft, borderColor: 'transparent' },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.8 },
});
