import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useCategories } from '@/features/posts/hooks';
import { usePlaceLabel } from '@/features/search/usePlaceLabel';
import { fr } from '@/i18n/fr';
import type { PostType } from '@/lib/database.types';
import { centsToInput, parsePriceInput, sanitizePriceInput } from '@/lib/price';
import { usePlaceStore } from '@/store/place';
import { emptyFilters, type SearchFilters, type SearchSort } from '@/store/search';
import { spacing } from '@/theme/theme';
import { Chip, PillButton, Sheet, Text, TextField, Toggle } from '@/ui';

const TYPES: PostType[] = ['object', 'service', 'creation', 'rental'];
const SORTS: SearchSort[] = ['relevance', 'recent', 'price_asc', 'price_desc', 'distance'];
const RATINGS = [4, 4.5];

export interface FiltersSheetProps {
  visible: boolean;
  filters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" tone="secondary">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

/** All the filters of the results screen in one sheet. Changes apply when "Voir les résultats" is pressed. */
export function FiltersSheet({ visible, filters, onApply, onClose }: FiltersSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={fr.search.filters}>
      {visible ? <FiltersForm filters={filters} onApply={onApply} /> : null}
    </Sheet>
  );
}

function FiltersForm({ filters, onApply }: Pick<FiltersSheetProps, 'filters' | 'onApply'>) {
  const categories = useCategories().data ?? [];
  const radiusKm = usePlaceStore((s) => s.radiusKm);
  const { label } = usePlaceLabel();
  const [draft, setDraft] = useState(filters);
  const [min, setMin] = useState(centsToInput(filters.priceMinCents));
  const [max, setMax] = useState(centsToInput(filters.priceMaxCents));
  const patch = (p: Partial<SearchFilters>) => setDraft((d) => ({ ...d, ...p }));

  const apply = () => onApply({ ...draft, priceMinCents: parsePriceInput(min), priceMaxCents: parsePriceInput(max) });
  const reset = () => {
    setDraft({ ...emptyFilters, query: filters.query });
    setMin('');
    setMax('');
  };

  return (
    <>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.nearby}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{fr.search.nearbyOnly}</Text>
            <Text variant="caption" tone="secondary">
              {fr.search.nearbyOnlyHint(label, radiusKm)}
            </Text>
          </View>
          <Toggle
            accessibilityLabel={fr.search.nearbyOnly}
            value={draft.nearbyOnly}
            onValueChange={(v) => patch({ nearbyOnly: v, sort: v ? draft.sort : draft.sort === 'distance' ? 'relevance' : draft.sort })}
            testID="filter-nearby"
          />
        </View>

        <Section title={fr.search.type}>
          <View style={styles.chips}>
            <Chip label={fr.search.allTypes} selected={draft.type === null} onPress={() => patch({ type: null })} />
            {TYPES.map((t) => (
              <Chip key={t} label={fr.post.types[t]} selected={draft.type === t} onPress={() => patch({ type: t })} testID={`filter-type-${t}`} />
            ))}
          </View>
        </Section>

        <Section title={fr.search.category}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Chip label={fr.search.allCategories} selected={draft.categoryId === null} onPress={() => patch({ categoryId: null })} />
            {categories.map((c) => (
              <Chip key={c.id} label={c.label} selected={draft.categoryId === c.id} onPress={() => patch({ categoryId: c.id })} />
            ))}
          </ScrollView>
        </Section>

        <Section title={fr.search.price}>
          <View style={styles.prices}>
            <View style={styles.flex}>
              <TextField
                label={fr.search.priceMin}
                value={min}
                onChangeText={(t) => setMin(sanitizePriceInput(t))}
                keyboardType="decimal-pad"
                placeholder="0"
                right={<Text tone="secondary">€</Text>}
                testID="filter-price-min"
              />
            </View>
            <View style={styles.flex}>
              <TextField
                label={fr.search.priceMax}
                value={max}
                onChangeText={(t) => setMax(sanitizePriceInput(t))}
                keyboardType="decimal-pad"
                placeholder="100"
                right={<Text tone="secondary">€</Text>}
                testID="filter-price-max"
              />
            </View>
          </View>
        </Section>

        <Section title={fr.search.rating}>
          <View style={styles.chips}>
            <Chip label={fr.search.ratingAny} selected={draft.minRating === null} onPress={() => patch({ minRating: null })} />
            {RATINGS.map((r) => (
              <Chip key={r} label={fr.search.ratingMin(String(r).replace('.', ','))} selected={draft.minRating === r} onPress={() => patch({ minRating: r })} />
            ))}
          </View>
        </Section>

        <Section title={fr.search.sort}>
          <View style={styles.chips}>
            {SORTS.map((s) => (
              <Chip key={s} label={fr.search.sorts[s]} selected={draft.sort === s} onPress={() => patch({ sort: s })} testID={`filter-sort-${s}`} />
            ))}
          </View>
        </Section>
      </ScrollView>
      <View style={styles.footer}>
        <PillButton label={fr.search.reset} variant="secondary" onPress={reset} />
        <PillButton label={fr.search.apply} onPress={apply} style={styles.flex} testID="filters-apply" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  flex: { flex: 1 },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipsRow: { gap: spacing.sm },
  prices: { flexDirection: 'row', gap: spacing.md },
  nearby: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  footer: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
