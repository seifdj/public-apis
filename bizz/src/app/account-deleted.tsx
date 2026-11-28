import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { useAccountDeletion } from '@/features/account/hooks';
import { signOut } from '@/features/auth/api';
import { fr } from '@/i18n/fr';
import { toUserMessage } from '@/lib/errors';
import { colors, spacing } from '@/theme/theme';
import { EmptyState, PillButton, Screen, Text } from '@/ui';

/** Shown while an account is waiting for permanent deletion. The user can change their mind. */
export default function AccountDeletedScreen() {
  const { cancel } = useAccountDeletion();
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen
      scroll={false}
      style={styles.center}
      footer={
        <>
          {error ? (
            <Text variant="caption" tone="danger" align="center">
              {error}
            </Text>
          ) : null}
          <PillButton label={fr.accountDeleted.restore} size="lg" fullWidth loading={cancel.isPending} onPress={() => cancel.mutate(undefined, { onError: (e) => setError(toUserMessage(e)) })} testID="restore-account" />
          <PillButton label={fr.auth.signOut} variant="secondary" fullWidth onPress={() => void signOut()} />
        </>
      }
    >
      <EmptyState icon={<Trash2 color={colors.primary} size={28} />} title={fr.accountDeleted.title} description={fr.accountDeleted.body} />
    </Screen>
  );
}

const styles = StyleSheet.create({ center: { justifyContent: 'center', gap: spacing.md } });
