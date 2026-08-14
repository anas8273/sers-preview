/**
 * Editor Store — Zustand
 * حالة المحرر الحالي: formData + dirty tracking + view mode
 * لا يُحفظ في localStorage — حالة مؤقتة للجلسة فقط
 */
import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────
export type EditorView = 'templates' | 'editor' | 'preview' | 'saved';

interface EditorState {
  /** بيانات النموذج الحالي */
  formData: Record<string, string>;
  /** هل تم التعديل منذ آخر حفظ */
  isDirty: boolean;
  /** عرض الصفحة الحالي */
  currentView: EditorView;
  /** هل يتم الحفظ حالياً */
  isSaving: boolean;
  /** هل يتم التصدير حالياً */
  isExporting: boolean;
  /** معرّف التقرير/النموذج الحالي */
  currentId: string | null;
  // ─── Actions ─────
  setFormData: (data: Record<string, string>) => void;
  updateField: (fieldId: string, value: string) => void;
  setView: (view: EditorView) => void;
  setCurrentId: (id: string | null) => void;
  setSaving: (saving: boolean) => void;
  setExporting: (exporting: boolean) => void;
  markClean: () => void;
  resetEditor: () => void;
}

// ─── Store ───────────────────────────────────────────────
export const useEditorStore = create<EditorState>()((set) => ({
  formData: {},
  isDirty: false,
  currentView: 'templates',
  isSaving: false,
  isExporting: false,
  currentId: null,

  setFormData: (data) =>
    set({ formData: data, isDirty: true }),

  updateField: (fieldId, value) =>
    set((state) => ({
      formData: { ...state.formData, [fieldId]: value },
      isDirty: true,
    })),

  setView: (view) =>
    set({ currentView: view }),

  setCurrentId: (id) =>
    set({ currentId: id }),

  setSaving: (saving) =>
    set({ isSaving: saving }),

  setExporting: (exporting) =>
    set({ isExporting: exporting }),

  markClean: () =>
    set({ isDirty: false }),

  resetEditor: () =>
    set({
      formData: {},
      isDirty: false,
      currentView: 'templates',
      isSaving: false,
      isExporting: false,
      currentId: null,
    }),
}));
