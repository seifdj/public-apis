import { useRouter } from 'expo-router';
import { Eye, MapPin, Pencil } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AccountMenu } from '@/features/account/AccountMenu';
import { formatCity } from '@/features/account/CityPicker';
import { useCity, useMyProfile, useMyShop } from '@/features/account/hooks';
import { fr } from '@/i18n/fr';
import { colors, sizes, spacing } from '@/theme/theme';
import { Avatar, Chip, GlassCard, PillButton, Screen, StatusBadge, Text } from '@/ui';

/** Seller "Boutique" tab: shop summary, public page and edit, then the account settings. */
export default function ShopScreen() {
  const router = useRouter();
  const profile = useMyProfile().data;
  const shop = useMyShop().data;
  const city = useCity(shop?.city_id).data;
  if (!profile || !shop) return <Screen withTabBar>{null}</Screen>;

  const links = [
    shop.instagram ? `${fr.openShop.instagram} @${shop.instagram}` : null,
    shop.snapchat ? `${fr.openShop.snapchat} @${shop.snapchat}` : null,
    shop.tiktok ? `${fr.openShop.tiktok} @${shop.tiktok}` : null,
    shop.whatsapp ? fr.openShop.whatsapp : null,
  ].filter((l): l is string => l !== null);

  return (
    <Screen withTabBar>
      <Text variant="h1">{fr.nav.shop}</Text>
      <GlassCard size="xl" style={styles.block}>
        <View style={styles.center}>
          <Avatar name={shop.name} uri={shop.avatar_url} size={sizes.avatarLg} />
          <Text variant="h2" align="center">
            {shop.name}
          </Text>
          <Text tone="secondary">@{shop.slug}</Text>
          <View style={styles.row}>
            {shop.is_founder ? <StatusBadge kind="founder" /> : null}
            {city ? (
              <View style={styles.city}>
                <MapPin color={colors.textSecondary} size={14} />
                <Text variant="caption" tone="secondary">
                  {formatCity(city)}
                </Text>
              </View>
            ) : null}
          </View>
          {shop.bio ? (
            <Text align="center" tone="secondary">
              {shop.bio}
            </Text>
          ) : null}
        </View>
        {links.length > 0 ? (
          <View style={styles.links}>
            {links.map((l) => (
              <Chip key={l} label={l} />
            ))}
          </View>
        ) : null}
        <View style={styles.actions}>
          <PillButton label={fr.shop.view} variant="secondary" icon={<Eye color={colors.primary} size={16} />} onPress={() => router.push({ pathname: '/shop/[slug]', params: { slug: shop.slug } })} style={styles.flex} testID="shop-view" />
          <PillButton label={fr.post.edit} variant="ghost" icon={<Pencil color={colors.primary} size={16} />} onPress={() => router.push('/shop-edit')} style={styles.flex} testID="shop-edit" />
        </View>
      </GlassCard>
      <View style={styles.block}>
        <AccountMenu profile={profile} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing.lg },
  center: { alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  city: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  flex: { flex: 1 },
});
