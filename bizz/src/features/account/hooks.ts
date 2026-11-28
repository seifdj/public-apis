import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cancelAccountDeletion, fetchCity, fetchMyProfile, fetchMyShop, requestAccountDeletion, setActiveMode } from '@/features/account/api';
import { useSession, useUserId } from '@/features/auth/AuthProvider';
import type { ActiveMode, Profile } from '@/lib/database.types';
import { queryKeys } from '@/lib/queryClient';
import { useOnboardingStore } from '@/store/onboarding';

export function useMyProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.profile(userId ?? 'none'),
    queryFn: fetchMyProfile,
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useMyShop() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.myShop(userId ?? 'none'),
    queryFn: () => fetchMyShop(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useCity(cityId: number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.city(cityId ?? 0),
    queryFn: () => fetchCity(cityId!),
    enabled: !!cityId,
    staleTime: Infinity,
  });
}

export function useInvalidateAccount() {
  const client = useQueryClient();
  const userId = useUserId();
  return async () => {
    if (!userId) return;
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.profile(userId) }),
      client.invalidateQueries({ queryKey: queryKeys.myShop(userId) }),
      client.invalidateQueries({ queryKey: ['shop'] }), // public shop pages, whatever the slug
    ]);
  };
}

/** Switches client <-> seller navigation. The profile cache is updated first so the UI follows at once. */
export function useSwitchMode() {
  const client = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: (mode: ActiveMode) => setActiveMode(mode),
    onMutate: (mode) => {
      if (!userId) return;
      client.setQueryData<Profile | null>(queryKeys.profile(userId), (prev) => (prev ? { ...prev, active_mode: mode } : prev));
    },
    onSettled: () => {
      if (userId) void client.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
  });
}

export function useAccountDeletion() {
  const invalidate = useInvalidateAccount();
  const request = useMutation({ mutationFn: requestAccountDeletion, onSuccess: invalidate });
  const cancel = useMutation({ mutationFn: cancelAccountDeletion, onSuccess: invalidate });
  return { request, cancel };
}

export type GateState = 'loading' | 'error' | 'signedOut' | 'needsProfile' | 'deleted' | 'needsShop' | 'client' | 'seller';

/**
 * Single source of truth for "where should this user be?".
 *   signedOut    -> onboarding
 *   needsProfile -> profile form (terms not accepted yet)
 *   deleted      -> account pending deletion
 *   needsShop    -> chose "Je propose" at sign-up and has no shop yet
 *   client / seller -> tabs matching profiles.active_mode
 */
export function useGate(): { state: GateState; profile: Profile | null; retry: () => void } {
  const { session, initializing } = useSession();
  const profileQuery = useMyProfile();
  const intent = useOnboardingStore((s) => s.intent);
  const dismissed = useOnboardingStore((s) => s.shopPromptDismissed);
  const profile = profileQuery.data ?? null;
  const retry = () => void profileQuery.refetch();

  if (initializing) return { state: 'loading', profile, retry };
  if (!session) return { state: 'signedOut', profile: null, retry };
  if (profileQuery.isPending) return { state: 'loading', profile, retry };
  if (profileQuery.isError && !profile) return { state: 'error', profile, retry };
  if (!profile || !profile.terms_accepted_at) return { state: 'needsProfile', profile, retry };
  if (profile.deleted_at) return { state: 'deleted', profile, retry };
  if (profile.role === 'client' && intent === 'seller' && !dismissed) return { state: 'needsShop', profile, retry };
  return { state: profile.active_mode === 'seller' && profile.role === 'seller' ? 'seller' : 'client', profile, retry };
}
