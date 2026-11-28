import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { type PhoneFlow, sendPhoneCode } from '@/features/auth/api';
import { fr } from '@/i18n/fr';
import { toUserMessage } from '@/lib/errors';
import { formatFrenchMobileInput, parseFrenchMobile } from '@/lib/phone';
import { spacing } from '@/theme/theme';
import { PillButton, Text, TextField } from '@/ui';

export interface PhoneStepProps {
  flow: PhoneFlow;
  initialPhone?: string;
  onCodeSent: (phoneE164: string) => void;
}

export function PhoneStep({ flow, initialPhone = '', onCodeSent }: PhoneStepProps) {
  const [value, setValue] = useState(initialPhone);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const parsed = parseFrenchMobile(value);

  const submit = async () => {
    if (!parsed.valid) {
      setError(fr.auth.phoneInvalid);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await sendPhoneCode(parsed.e164, flow);
      onCodeSent(parsed.e164);
    } catch (e) {
      setError(e instanceof Error && e.message === 'notConfigured' ? fr.errors.notConfigured : toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text variant="h1">{flow === 'link' ? fr.auth.phoneLinkTitle : fr.auth.phoneTitle}</Text>
      <Text tone="secondary">{flow === 'link' ? fr.auth.phoneLinkSubtitle : fr.auth.phoneSubtitle}</Text>
      <View style={styles.field}>
        <TextField
          label={fr.auth.phoneLabel}
          value={value}
          onChangeText={(t) => {
            setValue(formatFrenchMobileInput(t));
            if (error) setError(null);
          }}
          placeholder={fr.auth.phonePlaceholder}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
          error={error}
          testID="phone-input"
        />
      </View>
      <PillButton label={fr.auth.sendCode} size="lg" fullWidth loading={loading} disabled={value.trim().length === 0} onPress={submit} testID="phone-submit" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  field: { marginTop: spacing.lg, marginBottom: spacing.sm },
});
