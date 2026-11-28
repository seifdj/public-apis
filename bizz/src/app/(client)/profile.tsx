import { useRouter } from 'expo-router';
import { Ban, Bell, Bookmark, Heart, MapPin, Repeat, Store } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AccountMenu } from '@/features/account/AccountMenu';
import { formatCity } from '@/features/account/CityPicker';
import { useCity, useMyProfile, useMyShop, useSwitchMode } from '@/features/account/hooks';
import { fr } from '@/i18n/fr';
import { colors, sizes, spacing } from '@/theme/theme';
import { Avatar, GlassCard, ListRow, PillButton, Screen, Text } from '@/ui';

/** Client profile: identity, "Ouvre ta boutique" or "Mode prestataire", account settings. */
export default function ProfileScreen() {
  const router = useRouter();
  const profile = useMyProfile().data;
  const city = useCity(profile?.city_id).data;
  const switchMode = useSwitchMode();
  const shop = useMyShop().data;
  if (!profile) return <Screen withTabBar>{null}</Screen>;

  return (
    <Screen withTabBar>
      <Text variant="h1">{fr.nav.profile}</Text>

      <GlassCard size="xl" style={styles.block}>
        <View style={styles.identity}>
          <Avatar name={profile.display_name} uri={profile.avatar_url} size={sizes.avatarLg} />
          <View style={styles.flex}>
            <Text variant="h2" numberOfLines={1}>
              {profile.display_name}
            </Text>
            <Text tone="secondary">@{profile.username}</Text>
            {city ? (
              <View style={styles.city}>
                <MapPin color={colors.textSecondary} size={14} />
                <Text variant="caption" tone="secondary">
                  {formatCity(city)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </GlassCard>

      {profile.role === 'seller' ? (
        <>
          <PillButton
            label={fr.profile.sellerMode}
            size="lg"
            fullWidth
            icon={<Repeat color={colors.textOnPrimary} size={18} />}
            loading={switchMode.isPending}
            onPress={() =>
              switchMode.mutate('seller', {
                onSuccess: () => router.replace('/(seller)/dashboard'),
              })
            }
            style={styles.block}
            testID="switch-seller"
          />
          {shop ? (
            <PillButton
              label={fr.shop.view}
              variant="secondary"
              fullWidth
              icon={<Store color={colors.primary} size={18} />}
              onPress={() =>
                router.push({
                  pathname: '/shop/[slug]',
                  params: { slug: shop.slug },
                })
              }
              style={styles.shopLink}
              testID="view-my-shop"
            />
          ) : null}
        </>
      ) : (
        <GlassCard style={styles.block}>
          <View style={styles.shopRow}>
            <View style={styles.shopIcon}>
              <Store color={colors.accentText} size={24} />
            </View>
            <View style={styles.flex}>
              <Text variant="h3">{fr.profile.openShopTitle}</Text>
              <Text variant="caption" tone="secondary">
                {fr.profile.openShopBody}
              </Text>
            </View>
          </View>
          <PillButton label={fr.nav.openShop} variant="accent" fullWidth onPress={() => router.push('/open-shop')} style={styles.shopCta} testID="open-shop" />
        </GlassCard>
      )}

      <GlassCard style={styles.block} padding={16}>
        <ListRow first icon={<Bookmark color={colors.primary} size={20} />} label={fr.library.saved} onPress={() => router.push('/saved')} />
        <ListRow icon={<Heart color={colors.primary} size={20} />} label={fr.library.following} onPress={() => router.push('/following')} />
        <ListRow icon={<Bell color={colors.primary} size={20} />} label={fr.alerts.title} onPress={() => router.push('/alerts')} />
        <ListRow icon={<Ban color={colors.primary} size={20} />} label={fr.library.blocked} onPress={() => router.push('/blocked')} />
      </GlassCard>

      <View style={styles.block}>
        <AccountMenu profile={profile} />
      </View>
      <Text variant="caption" tone="muted" align="center" style={styles.block}>
        {fr.profile.memberSince(new Date(profile.created_at).getFullYear())}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing.lg },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1 },
  city: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  shopIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopCta: { marginTop: spacing.lg },
  shopLink: { marginTop: spacing.md },
});
