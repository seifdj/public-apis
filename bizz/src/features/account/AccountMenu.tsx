import { useRouter } from 'expo-router';
import { FileText, LayoutGrid, LogOut, ShieldCheck, Smartphone, Trash2 } from 'lucide-react-native';
import { Alert } from 'react-native';

import { useAccountDeletion } from '@/features/account/hooks';
import { signOut } from '@/features/auth/api';
import { fr } from '@/i18n/fr';
import type { Profile } from '@/lib/database.types';
import { toUserMessage } from '@/lib/errors';
import { colors } from '@/theme/theme';
import { GlassCard, ListRow, StatusBadge, Text } from '@/ui';

/** Account section shared by the client profile and the seller shop tab. */
export function AccountMenu({ profile }: { profile: Profile }) {
  const router = useRouter();
  const { request } = useAccountDeletion();

  const confirmDelete = () => {
    Alert.alert(fr.profile.deleteTitle, fr.profile.deleteBody, [
      { text: fr.common.cancel, style: 'cancel' },
      {
        text: fr.profile.deleteConfirm,
        style: 'destructive',
        onPress: () => request.mutate(undefined, { onError: (e) => Alert.alert(toUserMessage(e)) }),
      },
    ]);
  };

  return (
    <GlassCard padding={16}>
      <Text variant="label" tone="secondary">
        {fr.profile.sectionAccount.toUpperCase()}
      </Text>
      {profile.phone_verified ? (
        <ListRow first icon={<Smartphone color={colors.primary} size={20} />} label={fr.profile.phoneVerified} right={<StatusBadge kind="available" label={fr.profile.phoneVerified} hideText />} />
      ) : (
        <ListRow first icon={<Smartphone color={colors.primary} size={20} />} label={fr.profile.verifyPhone} onPress={() => router.push('/verify-phone')} />
      )}
      <ListRow icon={<FileText color={colors.primary} size={20} />} label={fr.profile.terms} onPress={() => router.push('/legal/terms')} />
      <ListRow icon={<ShieldCheck color={colors.primary} size={20} />} label={fr.profile.privacy} onPress={() => router.push('/legal/privacy')} />
      {__DEV__ ? <ListRow icon={<LayoutGrid color={colors.primary} size={20} />} label={fr.profile.devGallery} onPress={() => router.push('/(gallery)/components')} /> : null}
      <ListRow icon={<LogOut color={colors.primary} size={20} />} label={fr.profile.signOut} onPress={() => void signOut().catch((e) => Alert.alert(toUserMessage(e)))} />
      <ListRow tone="danger" icon={<Trash2 color={colors.danger} size={20} />} label={fr.profile.deleteAccount} onPress={confirmDelete} />
    </GlassCard>
  );
}
