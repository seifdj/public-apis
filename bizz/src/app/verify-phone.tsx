import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useInvalidateAccount } from '@/features/account/hooks';
import { OtpStep } from '@/features/auth/OtpStep';
import { PhoneStep } from '@/features/auth/PhoneStep';
import { Screen, ScreenHeader } from '@/ui';

/** For accounts created with Apple or Google: add and verify a phone number (required to publish). */
export default function VerifyPhoneScreen() {
  const router = useRouter();
  const invalidate = useInvalidateAccount();
  const [phone, setPhone] = useState<string | null>(null);

  return (
    <Screen>
      <ScreenHeader onBack={() => (phone ? setPhone(null) : router.back())} />
      {phone ? (
        <OtpStep
          flow="link"
          phoneE164={phone}
          onChangeNumber={() => setPhone(null)}
          onVerified={() => {
            void invalidate();
            router.back();
          }}
        />
      ) : (
        <PhoneStep flow="link" onCodeSent={setPhone} />
      )}
    </Screen>
  );
}
