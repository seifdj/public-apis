import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius, shadows, sizes, spacing } from '@/theme/theme';
import { Text } from '@/ui/Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
type Size = 'md' | 'lg' | 'sm';

export interface PillButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  haptic?: boolean;
  style?: ViewStyle;
}

const heights: Record<Size, number> = { sm: sizes.touchMin, md: 48, lg: 54 };

export function PillButton({ label, variant = 'primary', size = 'md', loading, icon, iconRight, fullWidth, haptic = true, disabled, onPress, style, ...rest }: PillButtonProps) {
  const isDisabled = disabled || loading;
  const tone = variant === 'primary' || variant === 'accent' || variant === 'danger' ? 'onPrimary' : variant === 'secondary' ? 'primary' : 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        { height: heights[size], paddingHorizontal: size === 'sm' ? spacing.lg : spacing.xxl },
        variantStyles[variant],
        variant === 'primary' || variant === 'accent' ? shadows.button : null,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={tone === 'onPrimary' ? colors.textOnPrimary : colors.primary} /> : icon}
        <Text variant="bodyStrong" tone={tone}>
          {label}
        </Text>
        {iconRight}
      </View>
    </Pressable>
  );
}

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  accent: { backgroundColor: colors.accent },
  danger: { backgroundColor: colors.danger },
  secondary: { backgroundColor: colors.primarySoft },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
});

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', minHeight: sizes.touchMin, alignSelf: 'flex-start' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  fullWidth: { alignSelf: 'stretch' },
});
