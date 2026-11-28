import { Ban } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { useBlockActions, useBlockedUsers } from '@/features/social/hooks';
import { fr } from '@/i18n/fr';
import { colors, spacing } from '@/theme/theme';
import { Avatar, EmptyState, GlassCard, ListRow, PillButton, Screen, ScreenHeader } from '@/ui';

/** Comptes bloqués : la liste, avec « Débloquer ». */
export default function BlockedScreen() {
  const query = useBlockedUsers();
  const { unblock } = useBlockActions();
  const users = query.data ?? [];
  return (
    <Screen>
      <ScreenHeader title={fr.library.blocked} />
      {query.isPending ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : users.length === 0 ? (
        <EmptyState icon={<Ban color={colors.primary} size={28} />} title={fr.library.blockedEmpty.title} description={fr.library.blockedEmpty.body} />
      ) : (
        <GlassCard testID="blocked-list">
          {users.map((user, i) => (
            <ListRow
              key={user.user_id}
              first={i === 0}
              icon={<Avatar name={user.shop_name ?? user.display_name} uri={user.avatar_url} size={36} />}
              label={user.shop_name ?? user.display_name}
              right={<PillButton label={fr.library.unblock} size="sm" variant="secondary" loading={unblock.isPending && unblock.variables === user.user_id} onPress={() => unblock.mutate(user.user_id)} testID="unblock" />}
            />
          ))}
        </GlassCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ loader: { marginTop: spacing.xxxl } });
