import { BlurView } from 'expo-blur';
import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { useUiStore } from '@/store/ui';
import { blur, colors, radius, shadows, spacing } from '@/theme/theme';

export interface GlassCardProps extends Omit<ViewProps, 'children'>, PropsWithChildren {
  /** 24 px (lg, default) or 30 px (xl) corners. */
  size?: 'lg' | 'xl';
  padding?: number;
  /** Stronger shadow for floating elements (tab bar, sheets). */
  floating?: boolean;
  /** Solid white, no blur: for panels over a photo, where text must stay readable. */
  opaque?: boolean;
  style?: ViewStyle;
}

/**
 * Frosted-glass card: 70 % white over a background blur, white hairline,
 * soft navy shadow. On Android, `glassMode = 'opaque'` swaps the blur for a
 * 92 % white fill (spec §6).
 */
export function GlassCard({ children, size = 'lg', padding = spacing.lg, floating = false, opaque = false, style, ...rest }: GlassCardProps) {
  const glassMode = useUiStore((s) => s.glassMode);
  const useBlur = glassMode === 'blur' && !opaque;
  const r = size === 'xl' ? radius.xl : radius.lg;
  const fill = opaque ? colors.background : useBlur ? colors.glass : colors.glassOpaque;

  return (
    <View {...rest} style={[styles.shadow, floating ? shadows.floating : shadows.glass, { borderRadius: r }, style]}>
      <View style={[styles.clip, { borderRadius: r }]}>
        {useBlur ? (
          <BlurView
            intensity={blur.intensity}
            tint={blur.tint}
            blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
        <View style={[styles.border, { borderRadius: r }]} pointerEvents="none" />
        <View style={{ padding }}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { backgroundColor: 'transparent' },
  clip: { overflow: 'hidden' },
  border: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1, borderColor: colors.glassBorder },
});
