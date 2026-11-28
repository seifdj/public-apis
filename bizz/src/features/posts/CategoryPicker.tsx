import { Baby, Cake, Car, ChevronDown, Dumbbell, KeyRound, Lamp, Package, Palette, PartyPopper, Scissors, Shirt, Smartphone, Sparkles, Wrench, X } from 'lucide-react-native';
import { type ComponentType, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCategories } from '@/features/posts/hooks';
import { fr } from '@/i18n/fr';
import type { Category } from '@/lib/database.types';
import { colors, radius, spacing } from '@/theme/theme';
import { Halos, IconButton, Text } from '@/ui';

type IconType = ComponentType<{ color: string; size: number; strokeWidth?: number }>;

/** categories.icon (Lucide name stored in the database) -> component. */
const icons: Record<string, IconType> = {
  cake: Cake,
  sparkles: Sparkles,
  scissors: Scissors,
  shirt: Shirt,
  palette: Palette,
  lamp: Lamp,
  smartphone: Smartphone,
  baby: Baby,
  wrench: Wrench,
  'party-popper': PartyPopper,
  car: Car,
  'key-round': KeyRound,
  dumbbell: Dumbbell,
  package: Package,
};

export function CategoryIcon({ name, color = colors.primary, size = 22 }: { name: string; color?: string; size?: number }) {
  const Icon = icons[name] ?? Package;
  return <Icon color={color} size={size} />;
}

export interface CategoryPickerProps {
  value: number | null;
  onChange: (category: Category) => void;
  error?: string | null;
}

export function CategoryPicker({ value, onChange, error }: CategoryPickerProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const categories = useCategories().data ?? [];
  const selected = categories.find((c) => c.id === value) ?? null;

  return (
    <View style={styles.root}>
      <Text variant="label" tone="secondary" style={styles.label}>
        {fr.post.category}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${fr.post.category}${selected ? `, ${selected.label}` : ''}`} onPress={() => setOpen(true)} style={[styles.box, !!error && styles.boxError]} testID="category-field">
        {selected ? <CategoryIcon name={selected.icon} size={18} /> : null}
        <Text variant="bodyStrong" tone={selected ? 'default' : 'muted'} style={styles.flex} numberOfLines={1}>
          {selected?.label ?? fr.post.categoryPlaceholder}
        </Text>
        <ChevronDown color={colors.muted} size={18} />
      </Pressable>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType={Platform.OS === 'web' ? 'none' : 'slide'} onRequestClose={() => setOpen(false)} presentationStyle="pageSheet">
        <View style={[styles.modal, { paddingTop: insets.top + spacing.lg }]}>
          <Halos />
          <View style={styles.modalHeader}>
            <Text variant="h2" style={styles.flex}>
              {fr.post.category}
            </Text>
            <IconButton label={fr.common.close} icon={<X color={colors.primary} size={20} />} onPress={() => setOpen(false)} />
          </View>
          <ScrollView contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
            {categories.map((category) => {
              const active = category.id === value;
              return (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onChange(category);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.cell, active && styles.cellActive, pressed && styles.pressed]}
                  testID={`category-${category.slug}`}
                >
                  <View style={[styles.cellIcon, active && styles.cellIconActive]}>
                    <CategoryIcon name={category.icon} color={active ? colors.textOnPrimary : colors.primary} size={24} />
                  </View>
                  <Text variant="caption" align="center" numberOfLines={2}>
                    {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  label: { paddingHorizontal: 4 },
  flex: { flex: 1 },
  box: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.glassOpaque, borderWidth: 1.5, borderColor: colors.border },
  boxError: { borderColor: colors.danger },
  modal: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.screen },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '30.5%', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.glassOpaque, borderWidth: 1.5, borderColor: colors.border },
  cellActive: { borderColor: colors.primary },
  cellIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cellIconActive: { backgroundColor: colors.primary },
  pressed: { opacity: 0.7 },
});
