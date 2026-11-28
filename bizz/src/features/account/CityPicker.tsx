import { useQuery } from '@tanstack/react-query';
import { MapPin, Search, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type CityLite, searchCities } from '@/features/account/api';
import { fr } from '@/i18n/fr';
import { queryKeys } from '@/lib/queryClient';
import { colors, radius, sizes, spacing } from '@/theme/theme';
import { Halos, IconButton, Text, TextField } from '@/ui';

export interface CityPickerProps {
  label: string;
  value: CityLite | null;
  onChange: (city: CityLite) => void;
  error?: string | null;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function formatCity(city: CityLite): string {
  return `${city.name} (${city.department})`;
}

/** Field that opens a full-screen search over the 35 000 French communes. */
export function CityPicker({ label, value, onChange, error }: CityPickerProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const term = useDebounced(query.trim(), 250);
  const enabled = open && term.length >= 2;
  const results = useQuery({ queryKey: queryKeys.citySearch(term), queryFn: () => searchCities(term), enabled, staleTime: 5 * 60_000 });

  return (
    <View style={styles.root}>
      <Text variant="label" tone="secondary" style={styles.label}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}${value ? `, ${formatCity(value)}` : ''}`}
        onPress={() => setOpen(true)}
        style={[styles.box, !!error && styles.boxError]}
        testID="city-field"
      >
        <MapPin color={colors.primary} size={18} />
        <Text variant="bodyStrong" tone={value ? 'default' : 'muted'} style={styles.flex}>
          {value ? formatCity(value) : fr.profileSetup.cityPlaceholder}
        </Text>
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
              {fr.cityPicker.title}
            </Text>
            <IconButton label={fr.common.close} icon={<X color={colors.primary} size={20} />} onPress={() => setOpen(false)} />
          </View>
          <TextField
            label={fr.cityPicker.title}
            value={query}
            onChangeText={setQuery}
            placeholder={fr.cityPicker.placeholder}
            autoFocus={Platform.OS !== 'web'}
            autoCorrect={false}
            returnKeyType="search"
            left={<Search color={colors.muted} size={18} />}
            right={results.isFetching ? <ActivityIndicator color={colors.primary} /> : null}
            testID="city-search"
          />
          <FlatList
            data={enabled ? (results.data ?? []) : []}
            keyExtractor={(c) => String(c.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, paddingTop: spacing.md }}
            ListEmptyComponent={
              <Text tone="secondary" align="center" style={styles.empty}>
                {results.isError ? fr.errors.network : enabled && results.isSuccess ? fr.cityPicker.empty : fr.cityPicker.hint}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                  setQuery('');
                }}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              >
                <MapPin color={colors.primary} size={18} />
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{item.name}</Text>
                  <Text variant="caption" tone="secondary">
                    {item.postal_codes.slice(0, 3).join(', ') || item.department}
                  </Text>
                </View>
                <Text variant="caption" tone="secondary">
                  {item.department}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  label: { paddingHorizontal: 4 },
  flex: { flex: 1 },
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
  boxError: { borderColor: colors.danger },
  modal: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.screen },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  empty: { marginTop: spacing.xxl },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: sizes.touchMin + 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemPressed: { opacity: 0.6 },
});
