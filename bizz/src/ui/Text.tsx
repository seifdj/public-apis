import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';

import { colors, typography } from '@/theme/theme';

type Variant = keyof typeof typography;
type Tone = 'default' | 'secondary' | 'primary' | 'accent' | 'danger' | 'success' | 'onPrimary' | 'muted';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  align?: 'left' | 'center' | 'right';
}

const toneColor: Record<Tone, string> = {
  default: colors.text,
  secondary: colors.textSecondary,
  primary: colors.primary,
  accent: colors.accentText,
  danger: colors.danger,
  success: colors.success,
  onPrimary: colors.textOnPrimary,
  muted: colors.muted,
};

export function Text({ variant = 'body', tone = 'default', align, style, ...rest }: TextProps) {
  return <RNText {...rest} style={[typography[variant], { color: toneColor[tone] }, align ? { textAlign: align } : null, style]} />;
}

export const textStyles = StyleSheet.create({ ...typography });
