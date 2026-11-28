import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, sizes, spacing } from '@/theme/theme';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name; the visible label is passed as children (it may contain links). */
  label: string;
  children: ReactNode;
}

export function Checkbox({ checked, onChange, label, children }: CheckboxProps) {
  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        hitSlop={10}
        onPress={() => onChange(!checked)}
        style={styles.hit}
      >
        <View style={[styles.box, checked && styles.boxChecked]}>{checked ? <Check color={colors.textOnPrimary} size={16} strokeWidth={3} /> : null}</View>
      </Pressable>
      <View style={styles.label}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hit: { minWidth: sizes.touchMin, minHeight: sizes.touchMin, alignItems: 'center', justifyContent: 'center' },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  boxChecked: { backgroundColor: colors.primary },
  label: { flex: 1 },
});
