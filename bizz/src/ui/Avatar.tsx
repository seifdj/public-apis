import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors, sizes } from '@/theme/theme';
import { Text } from '@/ui/Text';

export interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ uri, name, size = sizes.avatarMd }: AvatarProps) {
  const r = size / 2;
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r }} accessibilityLabel={name} contentFit="cover" transition={150} />;
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: r }]} accessibilityLabel={name}>
      <Text variant={size >= sizes.avatarLg ? 'h2' : 'bodyStrong'} tone="primary">
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background },
});
