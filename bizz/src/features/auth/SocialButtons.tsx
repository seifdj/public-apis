import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { isAppleSignInAvailable, signInWithApple, signInWithGoogle } from '@/features/auth/api';
import { fr } from '@/i18n/fr';
import { toUserMessage } from '@/lib/errors';
import { colors, radius, spacing } from '@/theme/theme';
import { PillButton, Text } from '@/ui';

/** "ou" divider + Apple (iOS only, native button required by Apple) + Google. */
export function SocialButtons() {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'ios') void isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const run = async (provider: 'apple' | 'google') => {
    setError(null);
    setBusy(provider);
    try {
      await (provider === 'apple' ? signInWithApple() : signInWithGoogle());
    } catch (e) {
      setError(e instanceof Error && e.message === 'notConfigured' ? fr.errors.notConfigured : toUserMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text variant="caption" tone="secondary">
          {fr.auth.or}
        </Text>
        <View style={styles.line} />
      </View>
      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radius.pill}
          style={styles.apple}
          onPress={() => run('apple')}
        />
      ) : null}
      <PillButton label={fr.auth.google} variant="ghost" size="lg" fullWidth loading={busy === 'google'} disabled={busy !== null} onPress={() => run('google')} />
      {error ? (
        <Text variant="caption" tone="danger" align="center" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md, marginTop: spacing.xl },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  apple: { height: 54, alignSelf: 'stretch' },
});
