import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { fr } from '@/i18n/fr';
import { colors, sizes, spacing } from '@/theme/theme';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';

export interface ScreenHeaderProps {
  title?: string;
  /** Defaults to router.back() when navigation history exists. Pass `null` to hide the button. */
  onBack?: (() => void) | null;
  right?: ReactNode;
}

export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  const router = useRouter();
  const showBack = onBack !== null && (onBack !== undefined || router.canGoBack());
  return (
    <View style={styles.root}>
      <View style={styles.side}>
        {showBack ? <IconButton label={fr.common.back} icon={<ChevronLeft color={colors.primary} size={22} />} onPress={onBack ?? (() => router.back())} /> : null}
      </View>
      {title ? (
        <Text variant="h3" align="center" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.title} />
      )}
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', minHeight: sizes.touchMin, marginBottom: spacing.lg },
  side: { minWidth: sizes.touchMin, minHeight: sizes.touchMin, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  title: { flex: 1, marginHorizontal: spacing.sm },
});
