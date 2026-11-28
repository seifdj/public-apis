import { useRouter } from 'expo-router';
import { Clock, Smartphone } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useCity, useMyProfile, useMyShop } from '@/features/account/hooks';
import { useAllowance, useCreatePost } from '@/features/posts/hooks';
import { PostForm } from '@/features/posts/PostForm';
import { quotaHeadline, resetCountdown } from '@/features/posts/QuotaCard';
import { fr } from '@/i18n/fr';
import { colors, radius, spacing } from '@/theme/theme';
import { EmptyState, GlassCard, PillButton, Screen, ScreenHeader, Text } from '@/ui';

/** 9. Publier : compteur du quota, photos, type, titre, prix, ville, catégorie. */
export default function PublishScreen() {
  const router = useRouter();
  const profile = useMyProfile().data;
  const shop = useMyShop().data;
  const shopCity = useCity(shop?.city_id).data;
  const allowance = useAllowance();
  const create = useCreatePost();

  let content;
  if (!profile || !shop || allowance.isPending || (shop.city_id && shopCity === undefined)) {
    content = <ActivityIndicator color={colors.primary} style={styles.loader} />;
  } else if (!profile.phone_verified) {
    content = (
      <GlassCard>
        <EmptyState icon={<Smartphone color={colors.primary} size={28} />} title={fr.quota.verifyPhoneTitle} description={fr.quota.verifyPhoneBody} actionLabel={fr.profile.verifyPhone} onAction={() => router.push('/verify-phone')} />
      </GlassCard>
    );
  } else if (allowance.data && !allowance.data.canPost) {
    content = (
      <GlassCard testID="quota-exhausted">
        <EmptyState icon={<Clock color={colors.primary} size={28} />} title={fr.quota.exhaustedTitle} description={`${fr.quota.exhaustedBody}\n${resetCountdown(allowance.data.nextReset)}`} />
        <PillButton label={fr.quota.publishMore} variant="accent" fullWidth onPress={() => router.replace('/publish-more')} />
      </GlassCard>
    );
  } else {
    const headline = allowance.data ? quotaHeadline(allowance.data) : null;
    content = (
      <>
        {headline ? (
          <View style={styles.quota} testID="publish-quota">
            <Text variant="bodyStrong" tone="primary">
              {headline.title}
            </Text>
            <Text variant="caption" tone="secondary">
              {headline.body}
            </Text>
          </View>
        ) : null}
        <PostForm
          initial={{ images: [], type: 'object', title: '', priceMode: 'fixed', priceCents: null, city: shopCity ?? null, categoryId: null, description: '', hashtags: [] }}
          submitLabel={fr.post.publish}
          onSubmit={async (input) => {
            const id = await create.mutateAsync(input);
            router.replace({ pathname: '/post/[id]', params: { id, published: '1' } });
          }}
        />
      </>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={fr.post.newTitle} />
      {content}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxxl },
  quota: { backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg, gap: 2 },
});
