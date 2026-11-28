import type { BottomTabBarProps } from 'expo-router/tabs';
import * as Haptics from 'expo-haptics';
import { Plus } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadows, sizes, spacing } from '@/theme/theme';
import { GlassCard } from '@/ui/GlassCard';
import { Text } from '@/ui/Text';

export interface TabIconProps {
  color: string;
  size: number;
  strokeWidth?: number;
}

export interface GlassTabBarProps extends BottomTabBarProps {
  /** Route name -> line icon. */
  icons: Record<string, ComponentType<TabIconProps>>;
  /** Optional raised square button in the middle. */
  centerAction?: { label: string; onPress: () => void };
  /** Unread counters per route name. */
  badges?: Record<string, number | undefined>;
}

/**
 * Floating pill tab bar used by the four navigations. Accepts any number of
 * tabs; when `centerAction` is set, the raised + button is inserted in the middle.
 */
export function GlassTabBar({ state, descriptors, emitter, navigateToTab, icons, centerAction, badges }: GlassTabBarProps) {
  const insets = useSafeAreaInsets();
  // Expo Router hides a tab with `href: null`; the option is not in the base type.
  const routes = state.routes.filter((r) => (descriptors[r.key]?.options as { href?: string | null } | undefined)?.href !== null);
  const mid = Math.ceil(routes.length / 2);

  const renderTab = (route: (typeof routes)[number]) => {
    const index = state.routes.findIndex((r) => r.key === route.key);
    const focused = state.index === index;
    const options = descriptors[route.key]?.options;
    const Icon = icons[route.name];
    const label = typeof options?.title === 'string' ? options.title : route.name;
    const badge = badges?.[route.name];
    const color = focused ? colors.primary : colors.textSecondary;

    const onPress = () => {
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigateToTab(route.key);
      void Haptics.selectionAsync();
    };

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={options?.tabBarAccessibilityLabel ?? label}
        onPress={onPress}
        onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
        style={styles.tab}
      >
        <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>
          {Icon ? <Icon color={color} size={22} strokeWidth={focused ? 2.4 : 2} /> : null}
          {badge ? (
            <View style={styles.badge} accessibilityLabel={`${badge}`}>
              <Text variant="label" tone="onPrimary" style={styles.badgeText}>
                {badge > 99 ? '99+' : badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="label" style={[styles.label, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.root, { bottom: insets.bottom + sizes.tabBarBottomGap }]}>
      <GlassCard size="xl" padding={0} floating style={styles.bar}>
        <View style={styles.row}>
          {routes.slice(0, centerAction ? mid : routes.length).map(renderTab)}
          {centerAction ? <View style={styles.centerSpacer} /> : null}
          {centerAction ? routes.slice(mid).map(renderTab) : null}
        </View>
      </GlassCard>
      {centerAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={centerAction.label}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            centerAction.onPress();
          }}
          style={({ pressed }) => [styles.plus, shadows.button, pressed && styles.plusPressed]}
        >
          <Plus color={colors.textOnPrimary} size={28} strokeWidth={2.6} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  bar: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', height: sizes.tabBarHeight, paddingHorizontal: 4 },
  label: { fontSize: 11, letterSpacing: 0 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: sizes.touchMin },
  iconWrap: { width: 36, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  iconWrapFocused: { backgroundColor: colors.primarySoft },
  centerSpacer: { width: sizes.plusButton + 4 },
  plus: {
    position: 'absolute',
    top: -(sizes.plusButton / 2) + sizes.tabBarHeight / 2 - 8,
    width: sizes.plusButton,
    height: sizes.plusButton,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  plusPressed: { transform: [{ scale: 0.95 }] },
  badge: { position: 'absolute', top: -4, right: -2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, lineHeight: 12 },
});
