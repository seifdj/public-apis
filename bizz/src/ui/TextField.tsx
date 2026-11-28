import { type ComponentRef, type ReactNode, type Ref, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { colors, fonts, radius, sizes, spacing } from '@/theme/theme';
import { Text } from '@/ui/Text';

export interface TextFieldProps extends TextInputProps {
  label: string;
  /** Shown under the field. `error` wins over `hint`. */
  hint?: string;
  error?: string | null;
  success?: string | null;
  left?: ReactNode;
  right?: ReactNode;
  optional?: string;
  /** Hides the visible label (search bars); the label stays as the accessible name. */
  hideLabel?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function TextField({ label, hint, error, success, left, right, optional, hideLabel = false, style, onFocus, onBlur, multiline, ref, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const message = error ?? success ?? hint;
  return (
    <View style={styles.root}>
      {hideLabel ? null : (
        <View style={styles.labelRow}>
          <Text variant="label" tone="secondary">
            {label}
          </Text>
          {optional ? (
            <Text variant="label" tone="muted">
              {optional}
            </Text>
          ) : null}
        </View>
      )}
      <View style={[styles.box, multiline && styles.boxMultiline, focused && styles.boxFocused, !!error && styles.boxError]}>
        {left}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          multiline={multiline}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {right}
      </View>
      {message ? (
        <Text variant="caption" tone={error ? 'danger' : success ? 'success' : 'secondary'} accessibilityLiveRegion={error ? 'polite' : 'none'}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.glassOpaque,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  boxMultiline: { alignItems: 'flex-start', paddingVertical: spacing.md },
  boxFocused: { borderColor: colors.primary },
  boxError: { borderColor: colors.danger },
  // minWidth 0 lets the input shrink beside a suffix; the box already shows focus, so no web outline.
  input: { flex: 1, minWidth: 0, minHeight: sizes.touchMin, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text, paddingVertical: 0, outlineWidth: 0 },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' },
});
