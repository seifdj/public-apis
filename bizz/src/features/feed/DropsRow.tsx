import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Drop } from '@/features/social/api';
import { fr } from '@/i18n/fr';
import { colors, spacing } from '@/theme/theme';
import { Avatar, Text } from '@/ui';

/** "Drops du jour": followed shops that published today, as a row of ringed avatars. */
export function DropsRow({ drops, onOpen }: { drops: Drop[]; onOpen: (drop: Drop) => void }) {
  if (drops.length === 0) return null;
  return (
    <View style={styles.root} testID="drops-row">
      <Text variant="label" tone="secondary" style={styles.label}>
        {fr.feed.drops.toUpperCase()}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {drops.map((drop) => (
          <Pressable key={drop.shop_id} accessibilityRole="button" accessibilityLabel={`${drop.name}, ${fr.library.postsCount(drop.posts_today)}`} onPress={() => onOpen(drop)} style={styles.item}>
            <View style={styles.ring}>
              <Avatar name={drop.name} uri={drop.avatar_url} size={48} />
            </View>
            <Text variant="label" numberOfLines={1} style={styles.name}>
              {drop.slug}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: spacing.sm },
  label: { paddingHorizontal: spacing.screen, marginBottom: 6 },
  row: { paddingHorizontal: spacing.screen, gap: spacing.md },
  item: { alignItems: 'center', width: 64, gap: 4 },
  ring: { padding: 2, borderRadius: 30, borderWidth: 2, borderColor: colors.accent },
  name: { fontSize: 11, maxWidth: 64 },
});
