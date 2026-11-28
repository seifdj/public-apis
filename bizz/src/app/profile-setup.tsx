import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { AtSign } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AvatarPicker } from '@/features/account/AvatarPicker';
import { type CityLite, completeProfile, isUsernameAvailable, uploadAvatar } from '@/features/account/api';
import { CityPicker } from '@/features/account/CityPicker';
import { useInvalidateAccount, useMyProfile } from '@/features/account/hooks';
import { signOut } from '@/features/auth/api';
import { useUserId } from '@/features/auth/AuthProvider';
import { fr } from '@/i18n/fr';
import { toUserMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/queryClient';
import { isValidUsernameFormat, sanitizeUsernameInput, suggestUsername } from '@/lib/username';
import { colors, fonts, sizes, spacing } from '@/theme/theme';
import { Checkbox, PillButton, Screen, Text, TextField, Wordmark } from '@/ui';

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/** 3c. Fin d'inscription : photo, nom, pseudo, ville, CGU. */
export default function ProfileSetupScreen() {
  const userId = useUserId();
  const profile = useMyProfile().data;
  const invalidate = useInvalidateAccount();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [city, setCity] = useState<CityLite | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url ?? null);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDisplayName = (value: string) => {
    setDisplayName(value);
    if (!usernameTouched) setUsername(suggestUsername(value));
  };

  const candidate = useDebounced(username, 350);
  const formatOk = isValidUsernameFormat(username);
  const availability = useQuery({
    queryKey: queryKeys.usernameAvailable(candidate),
    queryFn: () => isUsernameAvailable(candidate),
    enabled: isValidUsernameFormat(candidate),
    staleTime: 15_000,
  });
  const checking = formatOk && (candidate !== username || availability.isFetching);
  const available = formatOk && candidate === username && availability.data === true;
  const taken = formatOk && candidate === username && availability.data === false;

  const canSubmit = displayName.trim().length > 0 && available && !!city && accepted && !submitting;

  const submit = async () => {
    if (!canSubmit || !city || !userId) return;
    setSubmitting(true);
    setError(null);
    try {
      const isLocalFile = !!avatarUri && !/^https?:/.test(avatarUri);
      const avatarUrl = isLocalFile ? await uploadAvatar(userId, avatarUri) : null;
      await completeProfile({ username, displayName: displayName.trim(), cityId: city.id, avatarUrl });
      await invalidate(); // the root guard then leaves this screen
    } catch (e) {
      setError(toUserMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          {error ? (
            <Text variant="caption" tone="danger" align="center" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <PillButton label={fr.profileSetup.submit} size="lg" fullWidth loading={submitting} disabled={!canSubmit} onPress={submit} testID="profile-submit" />
        </>
      }
    >
      <View style={styles.top}>
        <Wordmark size={22} />
        <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.signOut}>
          <Text variant="caption" tone="secondary">
            {fr.auth.signOut}
          </Text>
        </Pressable>
      </View>
      <Text variant="h1">{fr.profileSetup.title}</Text>
      <Text tone="secondary" style={styles.subtitle}>
        {fr.profileSetup.subtitle}
      </Text>

      <View style={styles.form}>
        <AvatarPicker name={displayName} uri={avatarUri} onPicked={setAvatarUri} />
        <TextField
          label={fr.profileSetup.displayName}
          value={displayName}
          onChangeText={onDisplayName}
          placeholder={fr.profileSetup.displayNamePlaceholder}
          maxLength={40}
          autoCapitalize="words"
          textContentType="givenName"
          returnKeyType="next"
          testID="display-name"
        />
        <TextField
          label={fr.profileSetup.username}
          value={username}
          onChangeText={(t) => {
            setUsernameTouched(true);
            setUsername(sanitizeUsernameInput(t));
          }}
          placeholder={fr.profileSetup.usernamePlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={24}
          left={<AtSign color={colors.muted} size={18} />}
          hint={checking ? fr.profileSetup.usernameChecking : fr.profileSetup.usernameHint}
          success={available ? fr.profileSetup.usernameFree : null}
          error={taken ? fr.profileSetup.usernameTaken : null}
          testID="username"
        />
        <CityPicker label={fr.profileSetup.city} value={city} onChange={setCity} />
        <Checkbox checked={accepted} onChange={setAccepted} label={`${fr.profileSetup.acceptPrefix}${fr.auth.terms}${fr.auth.legalAnd}${fr.auth.privacy}`}>
          <Text variant="caption" tone="secondary">
            {fr.profileSetup.acceptPrefix}
            <Link href="/legal/terms" style={styles.link}>
              {fr.auth.terms}
            </Link>
            {fr.auth.legalAnd}
            <Link href="/legal/privacy" style={styles.link}>
              {fr.auth.privacy}
            </Link>
            .
          </Text>
        </Checkbox>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  signOut: { minHeight: sizes.touchMin, justifyContent: 'center' },
  subtitle: { marginTop: spacing.xs },
  form: { gap: spacing.lg, marginTop: spacing.xl },
  link: { color: colors.primary, fontFamily: fonts.bodySemibold, textDecorationLine: 'underline' },
});
