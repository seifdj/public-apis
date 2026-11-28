import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera, X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { DraftImage } from '@/features/posts/api';
import { fr } from '@/i18n/fr';
import { publicUrl } from '@/lib/media';
import { colors, radius, spacing } from '@/theme/theme';
import { Text } from '@/ui';

export const MAX_PHOTOS = 10;
const TILE = 96;

export function draftImageUri(image: DraftImage): string {
  return image.localUri ?? (image.storagePath ? publicUrl('post-media', image.storagePath) : '');
}

export interface MediaPickerProps {
  images: DraftImage[];
  onChange: (images: DraftImage[]) => void;
  error?: string | null;
}

/** Horizontal strip: "add" tile, then the photos. Tap a photo to make it the cover, the cross removes it. */
export function MediaPicker({ images, onChange, error }: MediaPickerProps) {
  const remaining = MAX_PHOTOS - images.length;

  const add = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: remaining,
      quality: 0.9,
    });
    if (result.canceled) return;
    const picked = result.assets.slice(0, remaining).map((asset, i) => ({
      key: `${Date.now()}-${i}`,
      localUri: asset.uri,
      width: asset.width,
      height: asset.height,
    }));
    onChange([...images, ...picked]);
  };

  const makeCover = (key: string) => {
    const target = images.find((i) => i.key === key);
    if (target) onChange([target, ...images.filter((i) => i.key !== key)]);
  };

  return (
    <View style={styles.root}>
      <View style={styles.labelRow}>
        <Text variant="label" tone="secondary">
          {fr.post.photos}
        </Text>
        <Text variant="label" tone="muted">
          {fr.post.photoCount(images.length, MAX_PHOTOS)}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {remaining > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${fr.post.addPhoto} ${fr.post.photos}`} onPress={add} style={[styles.tile, styles.add, !!error && styles.addError]} testID="add-photo">
            <Camera color={colors.primary} size={26} />
            <Text variant="label" tone="primary">
              {fr.post.addPhoto}
            </Text>
          </Pressable>
        ) : null}
        {images.map((image, index) => (
          <View key={image.key} style={styles.tile}>
            <Pressable accessibilityRole="button" accessibilityLabel={index === 0 ? fr.post.cover : fr.post.makeCover} onPress={() => makeCover(image.key)} style={StyleSheet.absoluteFill}>
              <Image source={{ uri: draftImageUri(image) }} style={styles.image} contentFit="cover" />
            </Pressable>
            {index === 0 ? (
              <View style={styles.cover}>
                <Text variant="label" tone="onPrimary" style={styles.coverText}>
                  {fr.post.cover}
                </Text>
              </View>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel={fr.post.removePhoto} hitSlop={8} onPress={() => onChange(images.filter((i) => i.key !== image.key))} style={styles.remove}>
              <X color={colors.textOnPrimary} size={14} strokeWidth={3} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <Text variant="caption" tone={error ? 'danger' : 'secondary'}>
        {error ?? fr.post.photosHint(MAX_PHOTOS)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  strip: { gap: spacing.sm, paddingVertical: 2 },
  tile: { width: TILE, height: TILE * 1.25, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.mutedSoft },
  add: { alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.primarySoft, borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed' },
  addError: { borderColor: colors.danger },
  image: { width: '100%', height: '100%' },
  cover: { position: 'absolute', left: 6, bottom: 6, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  coverText: { fontSize: 10, lineHeight: 14 },
  remove: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(21, 18, 43, 0.65)', alignItems: 'center', justifyContent: 'center' },
});
