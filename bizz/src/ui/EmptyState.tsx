import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme/theme';
import { PillButton } from '@/ui/PillButton';
import { Text } from '@/ui/Text';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text variant="h3" align="center">
        {title}
      </Text>
      {description ? (
        <Text tone="secondary" align="center">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? <PillButton label={actionLabel} onPress={onAction} variant="secondary" style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  action: { marginTop: spacing.md },
});
