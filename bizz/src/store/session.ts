import { create } from 'zustand';

import type { ActiveMode } from '@/lib/database.types';

interface SessionState {
  /** Navigation mode of a seller account. Mirrors `profiles.active_mode`; the server stays the source of truth. */
  activeMode: ActiveMode;
  setActiveMode: (mode: ActiveMode) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeMode: 'client',
  setActiveMode: (activeMode) => set({ activeMode }),
}));
