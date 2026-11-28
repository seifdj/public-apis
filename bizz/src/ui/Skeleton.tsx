import { useEffect } from 'react';
import { type DimensionValue, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, radius } from '@/theme/theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  round?: boolean;
}

export function Skeleton({ width = '100%', height = 16, round = false }: SkeletonProps) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.base, { width, height, borderRadius: round ? height / 2 : radius.sm }, style]} />;
}

const styles = StyleSheet.create({ base: { backgroundColor: colors.mutedSoft } });
