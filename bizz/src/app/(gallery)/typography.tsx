import { StyleSheet } from 'react-native';

import { fr } from '@/i18n/fr';
import { spacing, typography } from '@/theme/theme';
import { GlassCard, Screen, Text } from '@/ui';

export default function TypographyScreen() {
  return (
    <Screen withTabBar>
      <Text variant="h1">{fr.gallery.sectionType}</Text>
      <GlassCard style={styles.card}>
        {(Object.keys(typography) as (keyof typeof typography)[]).map((v) => (
          <Text key={v} variant={v}>
            {v} · {fr.common.tagline}
          </Text>
        ))}
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { marginTop: spacing.lg, gap: spacing.md } });
