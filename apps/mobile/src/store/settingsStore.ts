import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppLanguage = 'he' | 'en';

interface SettingsState {
  // Accessibility preferences (patient app)
  highContrastMode: boolean;
  fontScale: number; // 1.0 = default; 1.5 = 150%; up to 2.0
  reducedMotion: boolean;
  // App language. null = follow device locale (the language switcher UI
  // that writes this lands in the Hebrew/RTL milestone).
  language: AppLanguage | null;

  setHighContrast: (enabled: boolean) => void;
  setFontScale: (scale: number) => void;
  setReducedMotion: (enabled: boolean) => void;
  setLanguage: (language: AppLanguage | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      highContrastMode: false,
      fontScale: 1.0,
      reducedMotion: false,
      language: null,

      setHighContrast: (enabled) => set({ highContrastMode: enabled }),
      setFontScale: (scale) => set({ fontScale: Math.min(Math.max(scale, 1.0), 2.0) }),
      setReducedMotion: (enabled) => set({ reducedMotion: enabled }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'caresync-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
