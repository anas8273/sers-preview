/**
 * User Store — Zustand
 * بيانات المستخدم المشتركة عبر كل الأقسام (مركز التقارير، شواهد الأداء، السيرة الذاتية)
 * يُحفظ تلقائياً في الخزنة الخاصة المشفرة المرتبطة بالحساب عبر persist middleware
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { privateLocalStorage } from '@/lib/private-browser-storage';

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

export interface UserState {
  personalInfo: PersonalInfo;
  profile: UserProfile;
  // ─── Actions ─────
  setPersonalInfo: (info: Partial<PersonalInfo>) => void;
  setProfile: (profile: Partial<UserProfile>) => void;
  resetPersonalInfo: () => void;
  resetAll: () => void;
}
type PersistedUserState = Pick<UserState, 'personalInfo' | 'profile'>;

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

// The legacy plain `sers-user` record is intentionally never a fallback here.
// Writes are suppressed only while an auth transition clears readable memory;
// the old encrypted record remains intact for the actor who owns it.
let suppressAuthTransitionPersistence = false;
const privateUserStorage = createJSONStorage<PersistedUserState>(() => ({
  getItem: (name: string) => privateLocalStorage.getItem(name),
  setItem: (name: string, value: string) => {
    if (!suppressAuthTransitionPersistence) privateLocalStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    if (!suppressAuthTransitionPersistence) privateLocalStorage.removeItem(name);
  },
}));

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
      storage: privateUserStorage,
      // Only persist these fields
      partialize: (state) => ({
        personalInfo: state.personalInfo,
        profile: state.profile,
      }),
    }
  )
);

/**
 * Clear only readable in-memory profile data during an actor transition.
 * This deliberately does not overwrite the previous actor's encrypted copy.
 */
export function resetUserStoreForAuthTransition() {
  suppressAuthTransitionPersistence = true;
  try {
    useUserStore.setState({
      personalInfo: { ...DEFAULT_PERSONAL_INFO },
      profile: { ...DEFAULT_PROFILE },
    });
  } finally {
    suppressAuthTransitionPersistence = false;
  }
}
