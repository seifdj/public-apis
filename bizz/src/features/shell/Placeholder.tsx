import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { EmptyState, GlassCard, Screen, Text } from '@/ui';
import { spacing } from '@/theme/theme';

/** Tab whose feature arrives in a later step: shows what is coming instead of an empty screen. */
export function Placeholder({ heading, icon, title, body }: { heading: string; icon: ReactNode; title: string; body: string }) {
  return (
    <Screen withTabBar>
      <Text variant="h1">{heading}</Text>
      <GlassCard style={styles.card}>
        <EmptyState icon={icon} title={title} description={body} />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { marginTop: spacing.xl } });
