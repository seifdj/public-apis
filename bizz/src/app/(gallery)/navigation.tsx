import { StyleSheet } from 'react-native';

import { fr } from '@/i18n/fr';
import { spacing } from '@/theme/theme';
import { GlassCard, PillButton, Screen, Text } from '@/ui';

export default function NavigationScreen() {
  return (
    <Screen withTabBar>
      <Text variant="h1">Navigation</Text>
      <GlassCard style={styles.card}>
        <Text variant="h3">Barre flottante</Text>
        <Text tone="secondary">
          Quatre onglets, un bouton + carré arrondi surélevé au centre, badge de non-lus sur « {fr.nav.messages} ». Le même composant servira aux quatre navigations.
        </Text>
        <PillButton label="Mode client" variant="secondary" />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { marginTop: spacing.lg, gap: spacing.md } });
