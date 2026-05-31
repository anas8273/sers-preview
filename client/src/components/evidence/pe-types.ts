/**
 * Performance Evidence — Types
 * أنواع البيانات المشتركة لقسم شواهد الأداء الوظيفي
 * مستخرجة من PerformanceEvidence.tsx لإعادة الاستخدام
 */
import type { LucideIcon } from 'lucide-react';

// ─── Evidence Types ──────────────────────────────────────
export type EvidenceType = 'text' | 'image' | 'link' | 'file' | 'video';
export type EvidencePriority = 'essential' | 'supporting' | 'additional';

// ─── Form Field ──────────────────────────────────────────
export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

// ─── Sub Evidence ────────────────────────────────────────
export interface SubEvidence {
  id: string;
  title: string;
  description: string;
  type: 'report' | 'upload' | 'both';
  isCustom?: boolean;
  isSubItem?: boolean;
  parentTitle?: string;
  formFields?: FormField[];
}

// ─── Criterion ───────────────────────────────────────────
export interface Criterion {
  id: string;
  title: string;
  maxScore: number;
  description: string;
  subEvidences: SubEvidence[];
}

// ─── Evidence Item ───────────────────────────────────────
export interface EvidenceItem {
  id: string;
  subEvidenceId: string;
  type: EvidenceType;
  text: string;
  link: string;
  fileData: string | null;
  fileName: string;
  displayAs: 'image' | 'qr';
  formData?: Record<string, string>;
  comment?: string;
  priority?: EvidencePriority;
  keywords?: string[];
  showBarcode?: boolean;
  uploadedUrl?: string;
}

// ─── Criterion Data ──────────────────────────────────────
export interface CriterionData {
  score: number;
  notes: string;
  evidences: EvidenceItem[];
  customSubEvidences: SubEvidence[];
}

// ─── Job Type ────────────────────────────────────────────
export interface JobType {
  id: string;
  title: string;
  icon: LucideIcon;
  emoji: string;
  criteria: Criterion[];
  hasStandards: boolean;
  color: string;
  desc: string;
}

// ─── Layout Types ────────────────────────────────────────
export type LayoutType =
  | 'dark-header-table'
  | 'dark-header-simple'
  | 'white-header-classic'
  | 'white-header-sidebar'
  | 'white-header-cards'
  | 'white-header-light'
  | 'white-header-multi'
  | 'minimal-clean';

// ─── Theme Config ────────────────────────────────────────
export interface ThemeConfig {
  id: string;
  name: string;
  layoutType: LayoutType;
  headerBg: string;
  headerText: string;
  accent: string;
  borderColor: string;
  titleBg: string;
  fieldLabelBg: string;
  footerBg: string;
  tableStyle: boolean;
  sidebarBg?: string;
  titleStyle?: 'rounded' | 'full-width' | 'bordered' | 'underlined' | 'badge' | 'simple';
  headerSeparator?: boolean;
  showTopLine?: boolean;
  showBottomBar?: boolean;
  fieldStyle?: 'table' | 'fieldset' | 'underlined' | 'cards' | 'minimal';
  signatureStyle?: 'dotted' | 'solid' | 'boxed' | 'lined' | 'stamped';
  bodyBg?: string;
  coverStyle?: 'gradient-center' | 'split-left' | 'diagonal' | 'framed-elegant' | 'top-bar' | 'minimal-line';
  sectionCoverStyle?: 'full-gradient' | 'left-stripe' | 'top-accent' | 'card-center' | 'numbered-bar' | 'clean-divider';
  coverAccent2?: string;
  headerVariant?: 'right-text-center-logo-left-info' | 'right-text-left-logo' | 'center-logo-banner' | 'full-header-sections';
}

// ─── Priority Config ─────────────────────────────────────
export const PRIORITY_CONFIG: Record<EvidencePriority, { label: string; color: string; bgColor: string; borderColor: string; icon: string }> = {
  essential: { label: 'أساسي', color: '#0097A7', bgColor: 'bg-teal-50 dark:bg-teal-950/30', borderColor: 'border-teal-300', icon: '★' },
  supporting: { label: 'داعم', color: '#2563EB', bgColor: 'bg-blue-50 dark:bg-blue-950/30', borderColor: 'border-blue-300', icon: '◆' },
  additional: { label: 'إضافي', color: '#9333EA', bgColor: 'bg-violet-50 dark:bg-violet-950/30', borderColor: 'border-violet-300', icon: '○' },
};

// ─── Utility Functions ───────────────────────────────────

/** إنشاء شاهد فارغ */
export function createEmptyEvidence(subEvidenceId: string = ''): EvidenceItem {
  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    subEvidenceId,
    type: 'text',
    text: '',
    link: '',
    fileData: null,
    fileName: '',
    displayAs: 'image',
    formData: {},
    priority: 'essential',
    keywords: [],
    showBarcode: true,
  };
}
