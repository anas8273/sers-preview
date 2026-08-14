/**
 * Template Store — Zustand
 * القالب/الثيم الحالي المُختار + إعدادات التصدير
 * مشترك بين المعاينة والتصدير في كل الأقسام
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ─── Types ───────────────────────────────────────────────
export interface ThemePreferences {
  /** معرّف الثيم المُختار */
  themeId: string;
  /** عائلة الخط */
  fontFamily: string;
  /** حجم صفحة التصدير */
  pageSize: 'A4' | 'letter';
  /** اتجاه الكتابة */
  direction: 'rtl' | 'ltr';
  /** إظهار شعار الوزارة */
  showMoeLogo: boolean;
  /** إظهار شعار المدرسة */
  showSchoolLogo: boolean;
}

interface TemplateState {
  preferences: ThemePreferences;
  // ─── Actions ─────
  setPreferences: (prefs: Partial<ThemePreferences>) => void;
  setThemeId: (id: string) => void;
  setFontFamily: (font: string) => void;
  resetPreferences: () => void;
}

// ─── Defaults ────────────────────────────────────────────
export const DEFAULT_THEME_PREFS: ThemePreferences = {
  themeId: 'official-white',
  fontFamily: "'Cairo', 'Tajawal', sans-serif",
  pageSize: 'A4',
  direction: 'rtl',
  showMoeLogo: true,
  showSchoolLogo: true,
};

// ─── Store ───────────────────────────────────────────────
export const useTemplateStore = create<TemplateState>()(
  persist(
    (set) => ({
      preferences: { ...DEFAULT_THEME_PREFS },

      setPreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),

      setThemeId: (id) =>
        set((state) => ({
          preferences: { ...state.preferences, themeId: id },
        })),

      setFontFamily: (font) =>
        set((state) => ({
          preferences: { ...state.preferences, fontFamily: font },
        })),

      resetPreferences: () =>
        set({ preferences: { ...DEFAULT_THEME_PREFS } }),
    }),
    {
      name: 'sers-template',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    }
  )
);
