import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, StyleSheet, type ViewStyle } from 'react-native';

import { colors, radius, sizes } from '@/theme/theme';

export interface IconButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  icon: ReactNode;
  /** Required for screen readers. */
  label: string;
  variant?: 'glass' | 'primary' | 'plain';
  size?: number;
  style?: ViewStyle;
}

export function IconButton({ icon, label, variant = 'glass', size = sizes.touchMin, onPress, style, ...rest }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={(e) => {
        void Haptics.selectionAsync();
        onPress?.(e);
      }}
      style={({ pressed }) => [styles.base, { width: size, height: size }, variants[variant], pressed && styles.pressed, style]}
      {...rest}
    >
      {icon}
    </Pressable>
  );
}

const variants = StyleSheet.create({
  glass: { backgroundColor: colors.glassOpaque, borderWidth: 1, borderColor: colors.glassBorder },
  primary: { backgroundColor: colors.primary },
  plain: { backgroundColor: 'transparent' },
});

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
