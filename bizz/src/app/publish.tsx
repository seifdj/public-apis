import { Plus } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { fr } from '@/i18n/fr';
import { colors, spacing } from '@/theme/theme';
import { EmptyState, GlassCard, Screen, ScreenHeader } from '@/ui';

/** 9. Publier. The form (photos, type, title, price, city, category) arrives with step 3. */
export default function PublishScreen() {
  return (
    <Screen>
      <ScreenHeader title={fr.nav.publish} />
      <GlassCard style={styles.card}>
        <EmptyState icon={<Plus color={colors.primary} size={28} />} title={fr.placeholders.publish.title} description={fr.placeholders.publish.body} />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { marginTop: spacing.lg } });
