import { APP_NAME, APP_WORDMARK } from '@/config/brand';
import { colors, fonts } from '@/theme/theme';
import { Text } from '@/ui/Text';

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <Text accessibilityRole="header" accessibilityLabel={APP_NAME} style={{ fontFamily: fonts.titleStrong, fontSize: size, lineHeight: size * 1.2, color: colors.accentText, letterSpacing: -0.5 }}>
      {APP_WORDMARK}
    </Text>
  );
}
