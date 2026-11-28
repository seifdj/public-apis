import { Link, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { PhoneStep } from '@/features/auth/PhoneStep';
import { SocialButtons } from '@/features/auth/SocialButtons';
import { fr } from '@/i18n/fr';
import { formatE164ForDisplay } from '@/lib/phone';
import { useOnboardingStore } from '@/store/onboarding';
import { colors, fonts, spacing } from '@/theme/theme';
import { Screen, ScreenHeader, Text, Wordmark } from '@/ui';

/** 3a. Inscription / connexion : numéro de téléphone, Apple ou Google. */
export default function PhoneScreen() {
  const router = useRouter();
  const pendingPhone = useOnboardingStore((s) => s.pendingPhone);
  const setPendingPhone = useOnboardingStore((s) => s.setPendingPhone);

  return (
    <Screen>
      <ScreenHeader right={<Wordmark size={22} />} />
      <PhoneStep
        flow="signin"
        initialPhone={pendingPhone ? formatE164ForDisplay(pendingPhone) : ''}
        onCodeSent={(phone) => {
          setPendingPhone(phone);
          router.push('/(onboarding)/otp');
        }}
      />
      <SocialButtons />
      <Text variant="caption" tone="secondary" align="center" style={styles.legal}>
        {fr.auth.legalPrefix}
        <Link href="/legal/terms" style={styles.link}>
          {fr.auth.terms}
        </Link>
        {fr.auth.legalAnd}
        <Link href="/legal/privacy" style={styles.link}>
          {fr.auth.privacy}
        </Link>
        .
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  legal: { marginTop: spacing.xl },
  link: { color: colors.primary, fontFamily: fonts.bodySemibold, textDecorationLine: 'underline' },
});
