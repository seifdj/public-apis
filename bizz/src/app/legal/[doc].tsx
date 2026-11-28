import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { fr } from '@/i18n/fr';
import { spacing } from '@/theme/theme';
import { GlassCard, Screen, ScreenHeader, Text } from '@/ui';

/** CGU and privacy policy. Provisional text until step 14 (store preparation). */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const isPrivacy = doc === 'privacy';
  const paragraphs = isPrivacy ? fr.legal.privacyBody : fr.legal.termsBody;
  return (
    <Screen>
      <ScreenHeader />
      <Text variant="h1">{isPrivacy ? fr.legal.privacyTitle : fr.legal.termsTitle}</Text>
      <GlassCard style={styles.note} padding={spacing.md}>
        <Text variant="caption" tone="secondary">
          {fr.legal.draft}
        </Text>
      </GlassCard>
      <View style={styles.body}>
        {paragraphs.map((p) => (
          <Text key={p}>{p}</Text>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: spacing.lg },
  body: { gap: spacing.lg, marginTop: spacing.xl },
});
