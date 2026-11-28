import { useRouter } from 'expo-router';
import { AtSign } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AvatarPicker } from '@/features/account/AvatarPicker';
import { type CityLite, uploadAvatar } from '@/features/account/api';
import { CityPicker } from '@/features/account/CityPicker';
import { useCity, useInvalidateAccount, useMyShop } from '@/features/account/hooks';
import { useUserId } from '@/features/auth/AuthProvider';
import { updateShop } from '@/features/posts/api';
import { fr } from '@/i18n/fr';
import type { Shop } from '@/lib/database.types';
import { toUserMessage } from '@/lib/errors';
import { formatFrenchMobileInput } from '@/lib/phone';
import { colors, spacing } from '@/theme/theme';
import { PillButton, Screen, ScreenHeader, Text, TextField } from '@/ui';

function ShopEditForm({ shop, shopCity }: { shop: Shop; shopCity: CityLite | null }) {
  const router = useRouter();
  const userId = useUserId();
  const invalidate = useInvalidateAccount();
  const [name, setName] = useState(shop.name);
  const [bio, setBio] = useState(shop.bio ?? '');
  const [city, setCity] = useState<CityLite | null>(shopCity);
  const [avatarUri, setAvatarUri] = useState<string | null>(shop.avatar_url);
  const [instagram, setInstagram] = useState(shop.instagram ?? '');
  const [snapchat, setSnapchat] = useState(shop.snapchat ?? '');
  const [tiktok, setTiktok] = useState(shop.tiktok ?? '');
  const [whatsapp, setWhatsapp] = useState(shop.whatsapp ? formatFrenchMobileInput(shop.whatsapp) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (set: (v: string) => void) => (t: string) => set(t.replace(/\s/g, '').replace(/^@+/, '').slice(0, 30));
  const canSave = name.trim().length >= 2 && !!city && !saving;

  const save = async () => {
    if (!canSave || !city || !userId) return;
    setSaving(true);
    setError(null);
    try {
      const isLocalFile = !!avatarUri && !/^https?:/.test(avatarUri);
      const avatarUrl = isLocalFile ? await uploadAvatar(userId, avatarUri) : undefined;
      await updateShop(shop.id, {
        name: name.trim(),
        bio: bio.trim() || null,
        city_id: city.id,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        instagram: instagram || null,
        snapchat: snapchat || null,
        tiktok: tiktok || null,
        whatsapp: whatsapp.replace(/[^\d+]/g, '') || null,
      });
      await invalidate();
      router.back();
    } catch (e) {
      setError(toUserMessage(e));
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <AvatarPicker name={name} uri={avatarUri} onPicked={setAvatarUri} />
      <TextField label={fr.openShop.name} value={name} onChangeText={setName} maxLength={40} autoCapitalize="words" hint={fr.openShop.slug(shop.slug)} testID="shop-name" />
      <TextField label={fr.openShop.bio} optional={fr.common.optional} value={bio} onChangeText={setBio} placeholder={fr.openShop.bioPlaceholder} maxLength={300} multiline testID="shop-bio" />
      <CityPicker label={fr.openShop.city} value={city} onChange={setCity} />
      <Text variant="h3" style={styles.links}>
        {fr.openShop.links}
      </Text>
      <TextField label={fr.openShop.instagram} optional={fr.common.optional} value={instagram} onChangeText={handle(setInstagram)} placeholder={fr.openShop.handlePlaceholder} autoCapitalize="none" autoCorrect={false} left={<AtSign color={colors.muted} size={18} />} />
      <TextField label={fr.openShop.snapchat} optional={fr.common.optional} value={snapchat} onChangeText={handle(setSnapchat)} placeholder={fr.openShop.handlePlaceholder} autoCapitalize="none" autoCorrect={false} left={<AtSign color={colors.muted} size={18} />} />
      <TextField label={fr.openShop.tiktok} optional={fr.common.optional} value={tiktok} onChangeText={handle(setTiktok)} placeholder={fr.openShop.handlePlaceholder} autoCapitalize="none" autoCorrect={false} left={<AtSign color={colors.muted} size={18} />} />
      <TextField label={fr.openShop.whatsapp} optional={fr.common.optional} value={whatsapp} onChangeText={(t) => setWhatsapp(formatFrenchMobileInput(t))} placeholder={fr.openShop.whatsappPlaceholder} keyboardType="phone-pad" />
      {error ? (
        <Text variant="caption" tone="danger" align="center">
          {error}
        </Text>
      ) : null}
      <PillButton label={fr.common.save} size="lg" fullWidth loading={saving} disabled={!canSave} onPress={save} testID="shop-save" />
    </View>
  );
}

/** Modifier la boutique : nom, bio, photo, ville, réseaux. */
export default function ShopEditScreen() {
  const shop = useMyShop();
  const city = useCity(shop.data?.city_id);
  const ready = !shop.isPending && (!shop.data || !city.isPending);
  return (
    <Screen>
      <ScreenHeader title={fr.shop.editTitle} />
      {ready && shop.data ? <ShopEditForm shop={shop.data} shopCity={city.data ?? null} /> : <ActivityIndicator color={colors.primary} style={styles.loader} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxxl },
  form: { gap: spacing.lg },
  links: { marginTop: spacing.sm },
});
