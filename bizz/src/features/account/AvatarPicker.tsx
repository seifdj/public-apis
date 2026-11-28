import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { fr } from '@/i18n/fr';
import { colors, sizes, spacing } from '@/theme/theme';
import { Avatar, Text } from '@/ui';

export interface AvatarPickerProps {
  name: string;
  /** Local file URI picked by the user, or the current remote URL. */
  uri: string | null;
  onPicked: (localUri: string) => void;
}

export function AvatarPicker({ name, uri, onPicked }: AvatarPickerProps) {
  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) onPicked(asset.uri);
  };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={uri ? fr.profileSetup.photoChange : fr.profileSetup.photo} onPress={pick} style={styles.root}>
      <View>
        <Avatar name={name || '?'} uri={uri} size={sizes.avatarLg + 8} />
        <View style={styles.badge}>
          <Camera color={colors.textOnPrimary} size={16} />
        </View>
      </View>
      <Text variant="bodyStrong" tone="primary">
        {uri ? fr.profileSetup.photoChange : fr.profileSetup.photo}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: spacing.sm, alignSelf: 'center', minHeight: sizes.touchMin },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
});
