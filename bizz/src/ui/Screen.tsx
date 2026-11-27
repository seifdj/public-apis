import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, sizes, spacing } from '@/theme/theme';

interface ScreenProps extends PropsWithChildren {
  /** Scrollable content (default) or a fixed container. */
  scroll?: boolean;
  /** Reserve space for the floating tab bar. */
  withTabBar?: boolean;
  padded?: boolean;
  style?: ViewStyle;
}

/** White background with the two soft halos (navy top-left, orange bottom-right). */
export function Halos() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.halo, styles.haloPrimary]} />
      <View style={[styles.halo, styles.haloAccent]} />
    </View>
  );
}

export function Screen({ children, scroll = true, withTabBar = false, padded = true, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = withTabBar ? sizes.tabBarHeight + sizes.tabBarBottomGap + insets.bottom + spacing.lg : insets.bottom + spacing.lg;
  const content: ViewStyle = {
    paddingTop: insets.top + spacing.lg,
    paddingBottom: bottomPad,
    paddingHorizontal: padded ? spacing.screen : 0,
  };
  return (
    <View style={styles.root}>
      <Halos />
      {scroll ? (
        <ScrollView contentContainerStyle={[content, style]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, content, style]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  halo: { position: 'absolute', width: 360, height: 360, borderRadius: 180 },
  haloPrimary: { top: -140, left: -120, backgroundColor: colors.haloPrimary, transform: [{ scaleX: 1.2 }] },
  haloAccent: { bottom: -160, right: -140, backgroundColor: colors.haloAccent, transform: [{ scaleX: 1.1 }] },
});
