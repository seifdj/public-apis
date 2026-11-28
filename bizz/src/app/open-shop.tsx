import { useRouter } from 'expo-router';
import { AtSign, BadgeCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { type CityLite, openShop } from '@/features/account/api';
import { CityPicker } from '@/features/account/CityPicker';
import { useCity, useGate, useInvalidateAccount } from '@/features/account/hooks';
import { fr } from '@/i18n/fr';
import { toUserMessage } from '@/lib/errors';
import { formatFrenchMobileInput } from '@/lib/phone';
import { useOnboardingStore } from '@/store/onboarding';
import { colors, spacing } from '@/theme/theme';
import { GlassCard, PillButton, Screen, ScreenHeader, Text, TextField } from '@/ui';

const FOUNDER_LIMIT = 500;

/** 3d. « Ouvre ta boutique » : passe le compte en prestataire. Reached from sign-up, the profile, or the + button. */
export default function OpenShopScreen() {
  const router = useRouter();
  const { state, profile } = useGate();
  const invalidate = useInvalidateAccount();
  const dismissShopPrompt = useOnboardingStore((s) => s.dismissShopPrompt);
  const profileCity = useCity(profile?.city_id).data;

  const [name, setName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState('');
  // Defaults to the profile city until the seller picks another one.
  const [pickedCity, setCity] = useState<CityLite | null>(null);
  const city = pickedCity ?? profileCity ?? null;
  const [instagram, setInstagram] = useState('');
  const [snapchat, setSnapchat] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromSignUp = state === 'needsShop';
  const canSubmit = name.trim().length >= 2 && !!city && !submitting;
  const handle = (set: (v: string) => void) => (t: string) => set(t.replace(/\s/g, '').replace(/^@+/, '').slice(0, 30));

  const submit = async () => {
    if (!canSubmit || !city) return;
    setSubmitting(true);
    setError(null);
    try {
      await openShop({ name: name.trim(), bio: bio.trim(), cityId: city.id, instagram, snapchat, tiktok, whatsapp });
      dismissShopPrompt();
      await invalidate();
      router.replace('/(seller)/dashboard');
    } catch (e) {
      setError(toUserMessage(e));
      setSubmitting(false);
    }
  };

  const later = () => {
    dismissShopPrompt();
    router.replace('/(client)/feed');
  };

  return (
    <Screen
      footer={
        <>
          {error ? (
            <Text variant="caption" tone="danger" align="center" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <PillButton label={fr.openShop.submit} size="lg" fullWidth loading={submitting} disabled={!canSubmit} onPress={submit} testID="shop-submit" />
          {fromSignUp ? <PillButton label={fr.common.later} variant="secondary" fullWidth onPress={later} testID="shop-later" /> : null}
        </>
      }
    >
      <ScreenHeader onBack={fromSignUp ? null : undefined} />
      <Text variant="h1">{fr.openShop.title}</Text>
      <Text tone="secondary" style={styles.subtitle}>
        {fr.openShop.subtitle}
      </Text>

      <View style={styles.form}>
        <GlassCard padding={spacing.md}>
          <View style={styles.founder}>
            <BadgeCheck color={colors.accentText} size={22} />
            <Text variant="caption" style={styles.flex}>
              {fr.openShop.founderNote(FOUNDER_LIMIT)}
            </Text>
          </View>
        </GlassCard>
        <TextField
          label={fr.openShop.name}
          value={name}
          onChangeText={setName}
          placeholder={fr.openShop.namePlaceholder}
          maxLength={40}
          autoCapitalize="words"
          hint={profile ? fr.openShop.slug(profile.username) : undefined}
          testID="shop-name"
        />
        <TextField label={fr.openShop.bio} optional={fr.common.optional} value={bio} onChangeText={setBio} placeholder={fr.openShop.bioPlaceholder} maxLength={300} multiline testID="shop-bio" />
        <CityPicker label={fr.openShop.city} value={city} onChange={setCity} />

        <View style={styles.links}>
          <Text variant="h3">{fr.openShop.links}</Text>
          <Text variant="caption" tone="secondary">
            {fr.openShop.linksHint}
          </Text>
        </View>
        <TextField label={fr.openShop.instagram} optional={fr.common.optional} value={instagram} onChangeText={handle(setInstagram)} placeholder={fr.openShop.handlePlaceholder} autoCapitalize="none" autoCorrect={false} left={<AtSign color={colors.muted} size={18} />} />
        <TextField label={fr.openShop.snapchat} optional={fr.common.optional} value={snapchat} onChangeText={handle(setSnapchat)} placeholder={fr.openShop.handlePlaceholder} autoCapitalize="none" autoCorrect={false} left={<AtSign color={colors.muted} size={18} />} />
        <TextField label={fr.openShop.tiktok} optional={fr.common.optional} value={tiktok} onChangeText={handle(setTiktok)} placeholder={fr.openShop.handlePlaceholder} autoCapitalize="none" autoCorrect={false} left={<AtSign color={colors.muted} size={18} />} />
        <TextField label={fr.openShop.whatsapp} optional={fr.common.optional} value={whatsapp} onChangeText={(t) => setWhatsapp(formatFrenchMobileInput(t))} placeholder={fr.openShop.whatsappPlaceholder} keyboardType="phone-pad" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: spacing.xs },
  form: { gap: spacing.lg, marginTop: spacing.xl },
  founder: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  links: { marginTop: spacing.sm, gap: 2 },
});
