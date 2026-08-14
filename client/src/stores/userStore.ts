/**
 * User Store — Zustand
 * بيانات المستخدم المشتركة عبر كل الأقسام (مركز التقارير، شواهد الأداء، السيرة الذاتية)
 * يُحفظ تلقائياً في localStorage عبر persist middleware
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ─── Types ───────────────────────────────────────────────
export interface PersonalInfo {
  /** سطور الترويسة (المملكة/الوزارة/الإدارة/المدرسة) */
  department: string;
  /** العام الدراسي */
  year: string;
  /** اسم مُعدّ التقرير */
  preparer: string;
}

export interface UserProfile {
  /** الاسم الكامل */
  fullName: string;
  /** البريد الإلكتروني */
  email: string;
  /** رقم الجوال */
  phone: string;
  /** التخصص */
  specialization: string;
  /** المسمى الوظيفي */
  jobTitle: string;
}

interface UserState {
  personalInfo: PersonalInfo;
  profile: UserProfile;
  // ─── Actions ─────
  setPersonalInfo: (info: Partial<PersonalInfo>) => void;
  setProfile: (profile: Partial<UserProfile>) => void;
  resetPersonalInfo: () => void;
  resetAll: () => void;
}

// ─── Defaults ────────────────────────────────────────────
export const DEFAULT_PERSONAL_INFO: PersonalInfo = {
  department: 'المملكة العربية السعودية\nوزارة التعليم\nالإدارة العامة للتعليم بمنطقة...\nمدرسة...',
  year: '',
  preparer: '',
};

const DEFAULT_PROFILE: UserProfile = {
  fullName: '',
  email: '',
  phone: '',
  specialization: '',
  jobTitle: '',
};

// ─── Store ───────────────────────────────────────────────
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      personalInfo: { ...DEFAULT_PERSONAL_INFO },
      profile: { ...DEFAULT_PROFILE },

      setPersonalInfo: (info) =>
        set((state) => ({
          personalInfo: { ...state.personalInfo, ...info },
        })),

      setProfile: (profile) =>
        set((state) => ({
          profile: { ...state.profile, ...profile },
        })),

      resetPersonalInfo: () =>
        set({ personalInfo: { ...DEFAULT_PERSONAL_INFO } }),

      resetAll: () =>
        set({
          personalInfo: { ...DEFAULT_PERSONAL_INFO },
          profile: { ...DEFAULT_PROFILE },
        }),
    }),
    {
      name: 'sers-user',
      storage: createJSONStorage(() => localStorage),
      // Only persist these fields
      partialize: (state) => ({
        personalInfo: state.personalInfo,
        profile: state.profile,
      }),
    }
  )
);
