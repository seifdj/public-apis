import { Redirect } from 'expo-router';
import { WifiOff } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useGate } from '@/features/account/hooks';
import { signOut } from '@/features/auth/api';
import { fr } from '@/i18n/fr';
import { colors, spacing } from '@/theme/theme';
import { EmptyState, PillButton, Screen } from '@/ui';

/** Entry point and fallback of every guard: sends the user where their account state says. */
export default function Index() {
  const { state, retry } = useGate();

  switch (state) {
    case 'signedOut':
      return <Redirect href="/(onboarding)" />;
    case 'needsProfile':
      return <Redirect href="/profile-setup" />;
    case 'deleted':
      return <Redirect href="/account-deleted" />;
    case 'needsShop':
      return <Redirect href="/open-shop" />;
    case 'seller':
      return <Redirect href="/(seller)/dashboard" />;
    case 'client':
      return <Redirect href="/(client)/feed" />;
    case 'error':
      return (
        <Screen scroll={false} style={styles.center}>
          <EmptyState icon={<WifiOff color={colors.primary} size={28} />} title={fr.errors.network} actionLabel={fr.common.retry} onAction={retry} />
          <PillButton label={fr.auth.signOut} variant="ghost" onPress={() => void signOut()} style={styles.signOut} />
        </Screen>
      );
    default:
      return (
        <Screen scroll={false} style={styles.center}>
          <View accessibilityLabel={fr.common.loading}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        </Screen>
      );
  }
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  signOut: { alignSelf: 'center', marginTop: spacing.md },
});
