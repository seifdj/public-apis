import { Bell, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useCity } from '@/features/account/hooks';

import { useCategories } from '@/features/posts/hooks';
import { useAlertActions, useAlerts } from '@/features/search/hooks';
import { fr } from '@/i18n/fr';
import type { Category, SearchAlert } from '@/lib/database.types';
import { colors, spacing } from '@/theme/theme';
import { EmptyState, formatPrice, GlassCard, IconButton, Screen, ScreenHeader, Text, Toggle } from '@/ui';

/** "layer cake · Food et pâtisserie · Service · jusqu'à 50 €" */
function describeAlert(alert: SearchAlert, categories: Category[], cityName: string | null): { title: string; details: string } {
  const category = categories.find((c) => c.id === alert.category_id);
  const title = alert.query?.trim() || category?.label || fr.alerts.anyKeyword;
  const parts = [
    alert.query?.trim() && category ? category.label : null,
    alert.type ? fr.post.types[alert.type] : null,
    alert.price_min_cents !== null ? fr.alerts.from(formatPrice(alert.price_min_cents)) : null,
    alert.price_max_cents !== null ? fr.alerts.upTo(formatPrice(alert.price_max_cents)) : null,
    alert.radius_km !== null ? (cityName ? fr.alerts.around(cityName, alert.radius_km) : fr.place.km(alert.radius_km)) : null,
    alert.is_active ? null : fr.alerts.paused,
  ].filter((p): p is string => !!p);
  return { title, details: parts.join(' · ') };
}

function AlertRow({ alert, categories, first, onToggle, onDelete }: { alert: SearchAlert; categories: Category[]; first: boolean; onToggle: (active: boolean) => void; onDelete: () => void }) {
  const city = useCity(alert.city_id).data;
  const { title, details } = describeAlert(alert, categories, city?.name ?? null);
  return (
    <View style={[styles.row, !first && styles.divider]} testID="alert-row">
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {details ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {details}
          </Text>
        ) : null}
      </View>
      <Toggle accessibilityLabel={title} value={alert.is_active} onValueChange={onToggle} />
      <IconButton label={fr.alerts.delete} variant="plain" icon={<Trash2 color={colors.danger} size={20} />} onPress={onDelete} testID="alert-delete" />
    </View>
  );
}

/** Mes alertes de recherche : activer, mettre en pause, supprimer. */
export default function AlertsScreen() {
  const query = useAlerts();
  const categories = useCategories().data ?? [];
  const { remove, toggle } = useAlertActions();
  const alerts = query.data ?? [];

  return (
    <Screen>
      <ScreenHeader title={fr.alerts.title} />
      {query.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : alerts.length === 0 ? (
        <EmptyState icon={<Bell color={colors.primary} size={28} />} title={fr.alerts.empty.title} description={fr.alerts.empty.body} />
      ) : (
        <>
          <GlassCard testID="alerts-list">
            {alerts.map((alert, i) => (
              <AlertRow key={alert.id} alert={alert} categories={categories} first={i === 0} onToggle={(active) => toggle.mutate({ id: alert.id, active })} onDelete={() => remove.mutate(alert.id)} />
            ))}
          </GlassCard>
          <Text variant="caption" tone="secondary" align="center" style={styles.note}>
            {fr.alerts.notifications}
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxxl },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  note: { marginTop: spacing.lg },
});
