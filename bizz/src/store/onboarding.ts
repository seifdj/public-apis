import { create } from 'zustand';

export type Intent = 'client' | 'seller';

interface OnboardingState {
  /** Choice made on "Tu viens pour quoi ?". Drives the "Ouvre ta boutique" step after sign-up. */
  intent: Intent | null;
  /** Phone number waiting for its SMS code (E.164). */
  pendingPhone: string | null;
  /** The seller chose "Plus tard" on the shop form: do not show it again automatically. */
  shopPromptDismissed: boolean;
  setIntent: (intent: Intent | null) => void;
  setPendingPhone: (phone: string | null) => void;
  dismissShopPrompt: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  intent: null,
  pendingPhone: null,
  shopPromptDismissed: false,
  setIntent: (intent) => set({ intent }),
  setPendingPhone: (pendingPhone) => set({ pendingPhone }),
  dismissShopPrompt: () => set({ shopPromptDismissed: true }),
  reset: () => set({ intent: null, pendingPhone: null, shopPromptDismissed: false }),
}));
