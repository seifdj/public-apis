import { type PropsWithChildren, type ReactNode, useId } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { colors, sizes, spacing } from '@/theme/theme';

interface ScreenProps extends PropsWithChildren {
  /** Scrollable content (default) or a fixed container. */
  scroll?: boolean;
  /** Reserve space for the floating tab bar. */
  withTabBar?: boolean;
  padded?: boolean;
  /** Pinned under the content, above the keyboard (primary action of a form). */
  footer?: ReactNode;
  style?: ViewStyle;
}

/** One blurred disc: a single colour fading to transparent (no hard edge on any platform). */
function Halo({ color, size, style }: { color: string; size: number; style: ViewStyle }) {
  // Unique per instance: on the web, SVG ids are global and hidden screens stay mounted.
  const id = `halo-${useId().replace(/\W/g, '')}`;
  return (
    <View style={[styles.halo, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.26} />
            <Stop offset="0.55" stopColor={color} stopOpacity={0.12} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** White background with the two soft halos (navy top-left, orange bottom-right). */
export function Halos() {
  return (
    <View pointerEvents="none" style={styles.halos}>
      <Halo color={colors.primary} size={520} style={styles.haloPrimary} />
      <Halo color={colors.accent} size={560} style={styles.haloAccent} />
    </View>
  );
}

export function Screen({ children, scroll = true, withTabBar = false, padded = true, footer, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = withTabBar ? sizes.tabBarHeight + sizes.tabBarBottomGap + insets.bottom + spacing.lg : footer ? spacing.lg : insets.bottom + spacing.lg;
  const horizontal = padded ? spacing.screen : 0;
  const content: ViewStyle = { paddingTop: insets.top + spacing.lg, paddingBottom: bottomPad, paddingHorizontal: horizontal };
  return (
    <View style={styles.root}>
      <Halos />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView style={styles.flex} contentContainerStyle={[styles.grow, content, style]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, content, style]}>{children}</View>
        )}
        {footer ? <View style={[styles.footer, { paddingHorizontal: horizontal, paddingBottom: insets.bottom + spacing.md }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  halos: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  footer: { paddingTop: spacing.md, gap: spacing.sm },
  halo: { position: 'absolute' },
  haloPrimary: { top: -220, left: -200 },
  haloAccent: { bottom: -260, right: -240 },
});
