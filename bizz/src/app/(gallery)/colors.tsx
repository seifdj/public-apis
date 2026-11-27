import { StyleSheet, View } from 'react-native';

import { fr } from '@/i18n/fr';
import { colors, radius, spacing } from '@/theme/theme';
import { GlassCard, Screen, Text } from '@/ui';

const swatches: { name: string; value: string; onDark?: boolean }[] = [
  { name: 'primary', value: colors.primary, onDark: true },
  { name: 'accent', value: colors.accent, onDark: true },
  { name: 'accentText', value: colors.accentText, onDark: true },
  { name: 'text', value: colors.text, onDark: true },
  { name: 'textSecondary', value: colors.textSecondary, onDark: true },
  { name: 'danger', value: colors.danger, onDark: true },
  { name: 'success', value: colors.success, onDark: true },
  { name: 'background', value: colors.background },
];

export default function ColorsScreen() {
  return (
    <Screen withTabBar>
      <Text variant="h1">{fr.gallery.sectionColors}</Text>
      <GlassCard style={styles.card}>
        {swatches.map((s) => (
          <View key={s.name} style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: s.value }]} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{s.name}</Text>
              <Text variant="caption" tone="secondary">
                {s.value}
              </Text>
            </View>
          </View>
        ))}
      </GlassCard>
      <GlassCard style={styles.card}>
        <Text variant="h3">Contraste</Text>
        <Text tone="secondary">Texte secondaire sur blanc (#55516E) : 7,2:1</Text>
        <Text tone="accent">Orange texte sur blanc (#D9700A) : 3,3:1, réservé aux prix en gras ≥ 18 px</Text>
        <Text tone="primary">Marine sur blanc (#163E6F) : 10,1:1</Text>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  swatch: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  flex: { flex: 1 },
});
