import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { type PhoneFlow, sendPhoneCode, verifyPhoneCode } from '@/features/auth/api';
import { fr } from '@/i18n/fr';
import { toUserMessage } from '@/lib/errors';
import { formatE164ForDisplay } from '@/lib/phone';
import { sizes, spacing } from '@/theme/theme';
import { OtpInput, PillButton, Text } from '@/ui';

const RESEND_DELAY_S = 30;

export interface OtpStepProps {
  flow: PhoneFlow;
  phoneE164: string;
  onVerified: () => void;
  onChangeNumber: () => void;
}

export function OtpStep({ flow, phoneE164, onVerified, onChangeNumber }: OtpStepProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_DELAY_S);
  const submitted = useRef<string | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const verify = async (token: string) => {
    if (token.length !== 6 || loading) return;
    submitted.current = token;
    setLoading(true);
    setError(null);
    try {
      await verifyPhoneCode(phoneE164, token, flow);
      onVerified();
    } catch (e) {
      setError(toUserMessage(e));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit once the sixth digit is typed (or autofilled from the SMS).
  useEffect(() => {
    if (code.length === 6 && submitted.current !== code) void verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const resend = async () => {
    setError(null);
    try {
      await sendPhoneCode(phoneE164, flow);
      setSeconds(RESEND_DELAY_S);
    } catch (e) {
      setError(toUserMessage(e));
    }
  };

  return (
    <View style={styles.root}>
      <Text variant="h1">{fr.auth.otpTitle}</Text>
      <Text tone="secondary">{fr.auth.otpSubtitle(formatE164ForDisplay(phoneE164))}</Text>
      <View style={styles.field}>
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (v.length < 6) submitted.current = null;
            if (error) setError(null);
          }}
          error={!!error}
          label={fr.auth.otpTitle}
        />
        {error ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
      <PillButton label={fr.auth.verify} size="lg" fullWidth loading={loading} disabled={code.length !== 6} onPress={() => verify(code)} testID="otp-submit" />
      <View style={styles.links}>
        <Pressable accessibilityRole="button" disabled={seconds > 0} onPress={resend} style={styles.link}>
          <Text variant="bodyStrong" tone={seconds > 0 ? 'muted' : 'primary'}>
            {seconds > 0 ? fr.auth.otpResendIn(seconds) : fr.auth.otpResend}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onChangeNumber} style={styles.link}>
          <Text variant="bodyStrong" tone="primary">
            {fr.auth.otpChangeNumber}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  field: { marginTop: spacing.lg, marginBottom: spacing.sm, gap: spacing.sm },
  links: { alignItems: 'center', marginTop: spacing.sm },
  link: { minHeight: sizes.touchMin, justifyContent: 'center', paddingHorizontal: spacing.md },
});
