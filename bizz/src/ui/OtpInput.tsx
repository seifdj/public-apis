import { type ComponentRef, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, fonts, radius } from '@/theme/theme';
import { Text } from '@/ui/Text';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
  label: string;
}

/** Six boxes driven by one hidden input, so SMS autofill and paste work on both platforms. */
export function OtpInput({ value, onChange, length = 6, error = false, autoFocus = true, label }: OtpInputProps) {
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const cells = Array.from({ length }, (_, i) => value[i] ?? '');
  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel={label} style={styles.root}>
      <View style={styles.row} pointerEvents="none">
        {cells.map((char, i) => {
          const active = i === Math.min(value.length, length - 1);
          return (
            <View key={i} style={[styles.cell, active && styles.cellActive, error && styles.cellError]}>
              <Text variant="h2">{char}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus={autoFocus}
        maxLength={length}
        caretHidden
        accessibilityLabel={label}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cell: {
    flex: 1,
    height: 58,
    maxWidth: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.glassOpaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { borderColor: colors.primary },
  cellError: { borderColor: colors.danger },
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, fontFamily: fonts.body, color: 'transparent' },
});
