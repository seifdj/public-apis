import { create } from 'zustand';

export type GlassMode = 'blur' | 'opaque';

interface UiState {
  /** Rendering of glass cards. Android can switch to opaque if blur is too costly. */
  glassMode: GlassMode;
  setGlassMode: (mode: GlassMode) => void;
}

export const useUiStore = create<UiState>((set) => ({
  // Blur everywhere by default; the gallery switch lets you compare on Android.
  glassMode: 'blur',
  setGlassMode: (glassMode) => set({ glassMode }),
}));
