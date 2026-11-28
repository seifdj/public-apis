import { Bookmark, Heart, Inbox, Share2, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { fr } from '@/i18n/fr';
import { useUiStore } from '@/store/ui';
import { colors, spacing } from '@/theme/theme';
import { Avatar, Chip, EmptyState, GlassCard, IconButton, PillButton, PriceTag, Screen, ScreenHeader, Skeleton, StatusBadge, Text } from '@/ui';

export default function ComponentsScreen() {
  const glassMode = useUiStore((s) => s.glassMode);
  const setGlassMode = useUiStore((s) => s.setGlassMode);
  const [selected, setSelected] = useState('Objet');
  const [loading, setLoading] = useState(false);

  return (
    <Screen withTabBar>
      <ScreenHeader />
      <Text variant="h1">{fr.gallery.title}</Text>
      <Text tone="secondary" style={styles.subtitle}>
        {fr.gallery.subtitle}
      </Text>

      <GlassCard style={styles.block}>
        <View style={styles.rowBetween}>
          <View>
            <Text variant="bodyStrong">{fr.gallery.glassMode}</Text>
            <Text variant="caption" tone="secondary">
              {glassMode === 'blur' ? fr.gallery.glassBlur : fr.gallery.glassOpaque}
            </Text>
          </View>
          <Switch value={glassMode === 'blur'} onValueChange={(v) => setGlassMode(v ? 'blur' : 'opaque')} trackColor={{ true: colors.primary }} />
        </View>
      </GlassCard>

      <Text variant="h3" style={styles.section}>
        {fr.gallery.sectionCards}
      </Text>
      <GlassCard size="xl" style={styles.block}>
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Avatar name="Sweet Cakes" />
            <View>
              <Text variant="bodyStrong">Sweet Cakes Lyon</Text>
              <Text variant="caption" tone="secondary">
                @sweetcakes · Vénissieux · 2 km
              </Text>
            </View>
          </View>
          <PillButton label="Suivre" size="sm" />
        </View>
        <View style={[styles.rowBetween, styles.mt]}>
          <View>
            <Text variant="bodyStrong">Layer cake perso 8 parts</Text>
            <View style={[styles.row, styles.mtXs]}>
              <StatusBadge kind="available" />
              <StatusBadge kind="sponsored" />
            </View>
          </View>
          <PriceTag priceCents={3500} />
        </View>
        <View style={[styles.row, styles.mt]}>
          <IconButton label="J'aime" icon={<Heart color={colors.primary} size={20} />} />
          <IconButton label="Enregistrer" icon={<Bookmark color={colors.primary} size={20} />} />
          <IconButton label="Partager en story" icon={<Share2 color={colors.primary} size={20} />} />
          <View style={styles.flex} />
          <PillButton label="C'est dispo ?" variant="accent" size="sm" />
        </View>
      </GlassCard>

      <Text variant="h3" style={styles.section}>
        {fr.gallery.sectionButtons}
      </Text>
      <View style={styles.wrap}>
        <PillButton label="Primaire" />
        <PillButton label="Secondaire" variant="secondary" />
        <PillButton label="Contour" variant="ghost" />
        <PillButton label="Accent" variant="accent" />
        <PillButton label="Suspendre" variant="danger" />
        <PillButton label="Désactivé" disabled />
        <PillButton label={loading ? 'Chargement' : 'Charger 2 s'} loading={loading} onPress={() => { setLoading(true); setTimeout(() => setLoading(false), 2000); }} />
      </View>
      <PillButton label="Pleine largeur" size="lg" fullWidth icon={<Sparkles color={colors.textOnPrimary} size={18} />} style={styles.mt} />

      <Text variant="h3" style={styles.section}>
        {fr.gallery.sectionChips}
      </Text>
      <View style={styles.wrap}>
        {['Objet', 'Service', 'Création', 'Location'].map((label) => (
          <Chip key={label} label={label} selected={selected === label} onPress={() => setSelected(label)} />
        ))}
      </View>
      <View style={[styles.wrap, styles.mt]}>
        {(['available', 'reserved', 'sold', 'expired', 'hidden', 'sponsored', 'founder', 'plus'] as const).map((k) => (
          <StatusBadge key={k} kind={k} />
        ))}
      </View>
      <View style={[styles.wrap, styles.mt]}>
        <PriceTag priceCents={3500} />
        <PriceTag priceCents={1299} />
        <PriceTag priceCents={0} />
        <PriceTag priceCents={null} mode="on_quote" />
      </View>

      <Text variant="h3" style={styles.section}>
        Chargement
      </Text>
      <GlassCard>
        <View style={styles.row}>
          <Skeleton width={48} height={48} round />
          <View style={[styles.flex, { gap: spacing.sm }]}>
            <Skeleton width="60%" />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      </GlassCard>

      <Text variant="h3" style={styles.section}>
        {fr.gallery.sectionEmpty}
      </Text>
      <GlassCard>
        <EmptyState icon={<Inbox color={colors.primary} size={28} />} title="Aucun message" description="Quand un client t'écrit, la conversation apparaît ici." actionLabel="Voir le feed" onAction={() => {}} />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: spacing.xs },
  section: { marginTop: spacing.xxl, marginBottom: spacing.md },
  block: { marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mt: { marginTop: spacing.lg },
  mtXs: { marginTop: spacing.xs, gap: spacing.xs },
  flex: { flex: 1 },
});
