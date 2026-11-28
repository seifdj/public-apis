import { useRouter } from 'expo-router';
import { ChevronRight, Search, Store } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fr } from '@/i18n/fr';
import { type Intent, useOnboardingStore } from '@/store/onboarding';
import { colors, radius, spacing } from '@/theme/theme';
import { GlassCard, Screen, ScreenHeader, Text, Wordmark } from '@/ui';

function RoleCard({ icon, title, body, accent, onPress, testID }: { icon: ReactNode; title: string; body: string; accent: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${body}`} onPress={onPress} style={({ pressed }) => pressed && styles.pressed} testID={testID}>
      <GlassCard size="xl" padding={spacing.xl}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: accent ? colors.accentSoft : colors.primarySoft }]}>{icon}</View>
          <View style={styles.flex}>
            <Text variant="h2">{title}</Text>
            <Text tone="secondary">{body}</Text>
          </View>
          <ChevronRight color={colors.muted} size={22} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

/** 2. Choix du rôle : « Je cherche » (client) ou « Je propose » (prestataire). */
export default function RoleScreen() {
  const router = useRouter();
  const setIntent = useOnboardingStore((s) => s.setIntent);
  const choose = (intent: Intent) => {
    setIntent(intent);
    router.push('/(onboarding)/phone');
  };

  return (
    <Screen>
      <ScreenHeader right={<Wordmark size={22} />} />
      <Text variant="h1">{fr.role.title}</Text>
      <Text tone="secondary" style={styles.subtitle}>
        {fr.role.subtitle}
      </Text>
      <View style={styles.cards}>
        <RoleCard testID="role-client" accent={false} icon={<Search color={colors.primary} size={28} />} title={fr.role.clientTitle} body={fr.role.clientBody} onPress={() => choose('client')} />
        <RoleCard testID="role-seller" accent icon={<Store color={colors.accentText} size={28} />} title={fr.role.sellerTitle} body={fr.role.sellerBody} onPress={() => choose('seller')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: spacing.sm },
  cards: { gap: spacing.lg, marginTop: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  icon: { width: 60, height: 60, borderRadius: radius.md + 4, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 4 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
