import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CityLite } from '@/features/account/api';
import { CityPicker } from '@/features/account/CityPicker';
import type { DraftImage, PostInput } from '@/features/posts/api';
import { CategoryPicker } from '@/features/posts/CategoryPicker';
import { MediaPicker } from '@/features/posts/MediaPicker';
import { fr } from '@/i18n/fr';
import type { PostType, PriceMode } from '@/lib/database.types';
import { toUserMessage } from '@/lib/errors';
import { hashtagsToInput, parseHashtags } from '@/lib/hashtags';
import { centsToInput, parsePriceInput, sanitizePriceInput } from '@/lib/price';
import { spacing } from '@/theme/theme';
import { Chip, PillButton, Text, TextField, Toggle } from '@/ui';

const TYPES: PostType[] = ['object', 'service', 'creation', 'rental'];

export interface PostFormValues {
  images: DraftImage[];
  type: PostType;
  title: string;
  priceMode: PriceMode;
  priceCents: number | null;
  city: CityLite | null;
  categoryId: number | null;
  description: string;
  hashtags: string[];
}

export interface PostFormProps {
  initial: PostFormValues;
  submitLabel: string;
  onSubmit: (input: PostInput) => Promise<void>;
}

type Errors = Partial<Record<'images' | 'title' | 'price' | 'category' | 'city', string>>;

/**
 * One-screen form shared by "Publier" and "Modifier". Required: photos, title, price (or
 * "sur devis"), city, category. The server validates everything again.
 */
export function PostForm({ initial, submitLabel, onSubmit }: PostFormProps) {
  const [images, setImages] = useState(initial.images);
  const [type, setType] = useState(initial.type);
  const [title, setTitle] = useState(initial.title);
  const [onQuote, setOnQuote] = useState(initial.priceMode === 'on_quote');
  const [price, setPrice] = useState(centsToInput(initial.priceCents));
  const [city, setCity] = useState(initial.city);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [description, setDescription] = useState(initial.description);
  const [hashtags, setHashtags] = useState(hashtagsToInput(initial.hashtags));
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clear = (key: keyof Errors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const submit = async () => {
    const priceCents = onQuote ? null : parsePriceInput(price);
    const next: Errors = {};
    if (images.length === 0) next.images = fr.post.errPhotos;
    if (title.trim().length < 3 || title.trim().length > 80) next.title = fr.post.errTitle;
    if (!onQuote && priceCents === null) next.price = fr.post.errPrice;
    if (!categoryId) next.category = fr.post.errCategory;
    if (!city) next.city = fr.post.errCity;
    setErrors(next);
    if (Object.keys(next).length > 0 || !city || !categoryId) return;

    setSubmitting(true);
    setServerError(null);
    try {
      await onSubmit({
        images,
        type,
        title,
        description,
        hashtags: parseHashtags(hashtags),
        priceMode: onQuote ? 'on_quote' : 'fixed',
        priceCents,
        categoryId,
        cityId: city.id,
      });
    } catch (e) {
      setServerError(toUserMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <MediaPicker
        images={images}
        onChange={(v) => {
          setImages(v);
          clear('images');
        }}
        error={errors.images}
      />

      <View style={styles.group}>
        <Text variant="label" tone="secondary" style={styles.label}>
          {fr.post.type}
        </Text>
        <View style={styles.chips}>
          {TYPES.map((t) => (
            <Chip key={t} label={fr.post.types[t]} selected={type === t} onPress={() => setType(t)} />
          ))}
        </View>
      </View>

      <TextField
        label={fr.post.title}
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          clear('title');
        }}
        placeholder={fr.post.titlePlaceholder}
        maxLength={80}
        error={errors.title}
        testID="post-title"
      />

      <View style={styles.priceRow}>
        <View style={styles.flex}>
          <TextField
            label={fr.post.price}
            value={onQuote ? '' : price}
            onChangeText={(t) => {
              setPrice(sanitizePriceInput(t));
              clear('price');
            }}
            placeholder={onQuote ? fr.post.onQuote : fr.post.pricePlaceholder}
            keyboardType="decimal-pad"
            editable={!onQuote}
            error={errors.price}
            right={
              <Text variant="bodyStrong" tone="secondary">
                €
              </Text>
            }
            testID="post-price"
          />
        </View>
        <View style={styles.quote}>
          <Text variant="label" tone="secondary">
            {fr.post.onQuote}
          </Text>
          <Toggle
            accessibilityLabel={fr.post.onQuote}
            value={onQuote}
            onValueChange={(v) => {
              setOnQuote(v);
              clear('price');
            }}
            testID="post-on-quote"
          />
        </View>
      </View>

      <CityPicker
        label={fr.post.city}
        value={city}
        onChange={(c) => {
          setCity(c);
          clear('city');
        }}
        error={errors.city}
      />
      <CategoryPicker
        value={categoryId}
        onChange={(c) => {
          setCategoryId(c.id);
          clear('category');
        }}
        error={errors.category}
      />

      <TextField
        label={fr.post.description}
        optional={fr.common.optional}
        value={description}
        onChangeText={setDescription}
        placeholder={fr.post.descriptionPlaceholder}
        maxLength={1000}
        multiline
        testID="post-description"
      />
      <TextField
        label={fr.post.hashtags}
        optional={fr.common.optional}
        value={hashtags}
        onChangeText={setHashtags}
        placeholder={fr.post.hashtagsPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        testID="post-hashtags"
      />

      {serverError ? (
        <Text variant="caption" tone="danger" align="center" accessibilityLiveRegion="polite" testID="post-error">
          {serverError}
        </Text>
      ) : null}
      <PillButton label={submitting ? fr.post.publishing : submitLabel} size="lg" fullWidth loading={submitting} onPress={submit} testID="post-submit" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  group: { gap: 6 },
  label: { paddingHorizontal: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  flex: { flex: 1 },
  quote: { alignItems: 'center', gap: 6, paddingTop: 2 },
});
