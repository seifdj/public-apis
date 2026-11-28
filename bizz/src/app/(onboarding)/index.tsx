import { useRouter } from 'expo-router';
import { ArrowRight, Cake, Heart, Sparkles } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { fr } from '@/i18n/fr';
import { colors, radius, shadows, sizes, spacing } from '@/theme/theme';
import { GlassCard, PillButton, PriceTag, Screen, StatusBadge, Text, Wordmark } from '@/ui';
import { useOnboardingStore } from '@/store/onboarding';

/** 1. Accueil : cartes produit flottantes, « Ton bizz, ta vitrine. », « C'est parti ». */
export default function WelcomeScreen() {
  const router = useRouter();
  const setIntent = useOnboardingStore((s) => s.setIntent);

  return (
    <Screen
      footer={
        <>
          <PillButton
            label={fr.welcome.cta}
            size="lg"
            fullWidth
            iconRight={<ArrowRight color={colors.textOnPrimary} size={20} />}
            onPress={() => router.push('/(onboarding)/role')}
            testID="welcome-cta"
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setIntent(null);
              router.push('/(onboarding)/phone');
            }}
            style={styles.link}
            testID="welcome-login"
          >
            <Text variant="bodyStrong" tone="primary">
              {fr.welcome.haveAccount}
            </Text>
          </Pressable>
        </>
      }
    >
      <Wordmark />

      <View style={styles.hero} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.backCard, styles.backCardLeft]} />
        <View style={[styles.backCard, styles.backCardRight]} />
        <GlassCard size="xl" padding={spacing.md} floating style={styles.mainCard}>
          <View style={styles.photo}>
            <Cake color={colors.accent} size={84} strokeWidth={1.4} />
          </View>
          <View style={styles.mainCardFooter}>
            <Text variant="caption" tone="secondary">
              {fr.welcome.cardShop}
            </Text>
            <PriceTag priceCents={3500} />
          </View>
        </GlassCard>

        <View style={[styles.float, styles.floatSold]}>
          <StatusBadge kind="available" label={fr.welcome.cardSold} />
        </View>
        <View style={[styles.float, styles.floatLike, styles.chip]}>
          <Heart color={colors.accent} size={16} fill={colors.accent} />
          <Text variant="label">248</Text>
        </View>
        <View style={[styles.float, styles.floatPrice, styles.chip]}>
          <Sparkles color={colors.primary} size={16} />
          <Text variant="label" tone="primary">
            60 €
          </Text>
        </View>
        <View style={[styles.float, styles.floatAsk]}>
          <Text variant="label" tone="onPrimary">
            {fr.welcome.cardAsk}
          </Text>
        </View>
      </View>

      <Text variant="display">{fr.welcome.titleLine1}</Text>
      <Text variant="display" tone="accent">
        {fr.welcome.titleLine2}
      </Text>
      <Text variant="bodyLg" tone="secondary" style={styles.body}>
        {fr.welcome.body}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 340, marginVertical: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  backCard: { position: 'absolute', width: 170, height: 210, borderRadius: radius.xl },
  backCardLeft: { backgroundColor: colors.primarySoft, left: 6, top: 56, transform: [{ rotate: '-10deg' }] },
  backCardRight: { backgroundColor: colors.accentSoft, right: 6, top: 30, transform: [{ rotate: '9deg' }] },
  mainCard: { width: 210, transform: [{ rotate: '-3deg' }] },
  photo: { height: 190, borderRadius: radius.lg, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  mainCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, paddingHorizontal: 4 },
  float: { position: 'absolute', ...shadows.glass },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  floatSold: { top: 14, right: 18, backgroundColor: colors.background, borderRadius: radius.pill },
  floatLike: { left: 6, bottom: 40 },
  floatPrice: { left: 26, top: 30 },
  floatAsk: { right: 6, bottom: 4, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, height: 36, justifyContent: 'center' },
  body: { marginTop: spacing.md },
  link: { minHeight: sizes.touchMin, alignItems: 'center', justifyContent: 'center' },
});
