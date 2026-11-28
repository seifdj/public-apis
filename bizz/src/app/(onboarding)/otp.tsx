import { Redirect, useRouter } from 'expo-router';

import { OtpStep } from '@/features/auth/OtpStep';
import { useOnboardingStore } from '@/store/onboarding';
import { Screen, ScreenHeader, Wordmark } from '@/ui';

/** 3b. Code SMS à 6 chiffres. Once verified, the session appears and the root guard takes over. */
export default function OtpScreen() {
  const router = useRouter();
  const phone = useOnboardingStore((s) => s.pendingPhone);
  if (!phone) return <Redirect href="/(onboarding)/phone" />;

  return (
    <Screen>
      <ScreenHeader right={<Wordmark size={22} />} />
      <OtpStep flow="signin" phoneE164={phone} onVerified={() => {}} onChangeNumber={() => router.back()} />
    </Screen>
  );
}
