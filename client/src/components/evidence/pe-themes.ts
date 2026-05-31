/**
 * Performance Evidence — Theme Configs
 * قوالب شواهد الأداء الوظيفي (8 قوالب مطابقة للهوية البصرية)
 * مستخرجة من PerformanceEvidence.tsx لإعادة الاستخدام
 */
import type { ThemeConfig } from './pe-types';

// القالب 1: إطارات مستديرة - الهوية البصرية الرسمية
export const DEFAULT_PE_THEME: ThemeConfig = {
  id: 'default', name: 'الهوية البصرية تدرج',
  layoutType: 'white-header-classic',
  headerBg: '#ffffff', headerText: '#1a6b6a',
  accent: '#1a6b6a', borderColor: '#2ea87a',
  titleBg: '#1a6b6a', fieldLabelBg: '#1a6b6a',
  footerBg: '#1a6b6a',
  tableStyle: false, titleStyle: 'rounded', showTopLine: false, showBottomBar: true,
  fieldStyle: 'fieldset', signatureStyle: 'dotted',
  coverStyle: 'gradient-center', sectionCoverStyle: 'full-gradient', coverAccent2: '#5bb784',
  headerVariant: 'right-text-center-logo-left-info',
  headerSeparator: false,
};

// 8 قوالب مدمجة — كل قالب بتنسيق مختلف فعلاً
export const BUILTIN_PE_THEMES: ThemeConfig[] = [
  DEFAULT_PE_THEME,
  {
    id: 'builtin-dark-table', name: 'جدول رسمي',
    layoutType: 'dark-header-table',
    headerBg: '#1a6b6a', headerText: '#ffffff',
    accent: '#1a6b6a', borderColor: '#2ea87a',
    titleBg: '#1a6b6a', fieldLabelBg: '#1a6b6a',
    footerBg: '#1a6b6a',
    tableStyle: true, titleStyle: 'full-width', showTopLine: false, showBottomBar: true,
    fieldStyle: 'table', signatureStyle: 'boxed',
    coverStyle: 'top-bar', sectionCoverStyle: 'numbered-bar', coverAccent2: '#5bb784',
    headerVariant: 'right-text-center-logo-left-info',
    bodyBg: '#ffffff',
  },
  {
    id: 'builtin-lined', name: 'خطوط أنيقة',
    layoutType: 'white-header-classic',
    headerBg: '#ffffff', headerText: '#1a6b6a',
    accent: '#1a6b6a', borderColor: '#2ea87a',
    titleBg: '#1a6b6a', fieldLabelBg: '#e8f5f0',
    footerBg: '#1a6b6a',
    tableStyle: false, titleStyle: 'underlined', showTopLine: true, showBottomBar: true,
    fieldStyle: 'underlined', signatureStyle: 'lined',
    coverStyle: 'split-left', sectionCoverStyle: 'left-stripe', coverAccent2: '#5bb784',
    headerVariant: 'right-text-center-logo-left-info',
    headerSeparator: true,
    bodyBg: '#ffffff',
  },
  {
    id: 'builtin-cards', name: 'بطاقات حديثة',
    layoutType: 'white-header-cards',
    headerBg: '#ffffff', headerText: '#1a6b6a',
    accent: '#1a6b6a', borderColor: '#2ea87a',
    titleBg: '#1a6b6a', fieldLabelBg: '#f0f7f4',
    footerBg: '#1a6b6a',
    tableStyle: false, titleStyle: 'badge', showTopLine: false, showBottomBar: true,
    fieldStyle: 'cards', signatureStyle: 'stamped',
    coverStyle: 'framed-elegant', sectionCoverStyle: 'card-center', coverAccent2: '#5bb784',
    headerVariant: 'right-text-left-logo',
    headerSeparator: false,
    bodyBg: '#ffffff',
  },
  {
    id: 'builtin-minimal', name: 'تصميم نظيف',
    layoutType: 'minimal-clean',
    headerBg: '#ffffff', headerText: '#1a6b6a',
    accent: '#1a6b6a', borderColor: '#2ea87a',
    titleBg: '#1a6b6a', fieldLabelBg: '#f0f4f8',
    footerBg: '#1a6b6a',
    tableStyle: false, titleStyle: 'simple', showTopLine: false, showBottomBar: false,
    fieldStyle: 'minimal', signatureStyle: 'dotted',
    coverStyle: 'minimal-line', sectionCoverStyle: 'clean-divider', coverAccent2: '#5bb784',
    headerVariant: 'center-logo-banner',
    headerSeparator: false,
    bodyBg: '#ffffff',
  },
  {
    id: 'builtin-official-pro', name: 'النموذج الرسمي',
    layoutType: 'dark-header-table',
    headerBg: '#0d4f4f', headerText: '#ffffff',
    accent: '#0d4f4f', borderColor: '#1a8a7a',
    titleBg: '#0d4f4f', fieldLabelBg: '#0d4f4f',
    footerBg: '#0d4f4f',
    tableStyle: true, titleStyle: 'full-width', showTopLine: true, showBottomBar: true,
    fieldStyle: 'table', signatureStyle: 'boxed',
    coverStyle: 'diagonal', sectionCoverStyle: 'numbered-bar', coverAccent2: '#1a8a7a',
    headerVariant: 'full-header-sections',
    headerSeparator: true,
    bodyBg: '#f9fafb',
  },
  {
    id: 'builtin-ink-saver', name: 'توفير حبر',
    layoutType: 'white-header-classic',
    headerBg: '#ffffff', headerText: '#374151',
    accent: '#6B7280', borderColor: '#D1D5DB',
    titleBg: '#F3F4F6', fieldLabelBg: '#F9FAFB',
    footerBg: '#F3F4F6',
    tableStyle: false, titleStyle: 'underlined', showTopLine: false, showBottomBar: false,
    fieldStyle: 'underlined', signatureStyle: 'dotted',
    coverStyle: 'minimal-line', sectionCoverStyle: 'clean-divider', coverAccent2: '#9CA3AF',
    headerVariant: 'right-text-center-logo-left-info',
    headerSeparator: false,
    bodyBg: '#ffffff',
  },
  {
    id: 'builtin-gold-accent', name: 'الهوية الذهبية',
    layoutType: 'dark-header-table',
    headerBg: '#1a3a4a', headerText: '#ffffff',
    accent: '#1a3a4a', borderColor: '#C8A951',
    titleBg: '#1a3a4a', fieldLabelBg: '#1a3a4a',
    footerBg: '#1a3a4a',
    tableStyle: true, titleStyle: 'full-width', showTopLine: true, showBottomBar: true,
    fieldStyle: 'cards', signatureStyle: 'stamped',
    coverStyle: 'gradient-center', sectionCoverStyle: 'card-center', coverAccent2: '#C8A951',
    headerVariant: 'right-text-left-logo',
    headerSeparator: true,
    bodyBg: '#FFFDF5',
  },
];

/**
 * Convert DB template rows to ThemeConfig objects.
 * If DB has templates, uses ONLY those (no hardcoded mixing).
 * If DB is empty, falls back to BUILTIN_PE_THEMES.
 */
export function mergeDBThemes(
  dbThemes: Array<{
    id: number; name: string; headerBg: string; headerText: string;
    accent: string; borderColor: string; bodyBg: string;
    description?: string | null; fontFamily?: string | null;
    layoutType?: string | null;
    templateLayout?: Record<string, any> | null;
  }>
): ThemeConfig[] {
  // If DB is empty, use built-in themes as fallback
  if (!dbThemes || dbThemes.length === 0) return [...BUILTIN_PE_THEMES];

  // Convert DB rows to ThemeConfig objects using templateLayout JSON
  return dbThemes.map(db => {
    const layout = db.templateLayout || {};
    return {
      id: `db-${db.id}`,
      name: db.name || `قالب #${db.id}`,
      layoutType: (layout.layoutType || db.layoutType || 'white-header-classic') as ThemeConfig['layoutType'],
      headerBg: db.headerBg || '#ffffff',
      headerText: db.headerText || '#1a6b6a',
      accent: db.accent || '#1a6b6a',
      borderColor: db.borderColor || '#e5e7eb',
      titleBg: layout.titleBg || db.accent || '#1a6b6a',
      fieldLabelBg: layout.fieldLabelBg || db.accent || '#1a6b6a',
      footerBg: layout.footerBg || db.accent || '#1a6b6a',
      tableStyle: layout.tableStyle ?? false,
      bodyBg: db.bodyBg || '#ffffff',
      titleStyle: layout.titleStyle || 'rounded',
      fieldStyle: layout.fieldStyle || 'fieldset',
      signatureStyle: layout.signatureStyle || 'dotted',
      coverStyle: layout.coverStyle || 'gradient-center',
      sectionCoverStyle: layout.sectionCoverStyle || 'full-gradient',
      coverAccent2: layout.coverAccent2 || db.accent || '#1a6b6a',
      headerVariant: layout.headerVariant || 'right-text-center-logo-left-info',
      headerSeparator: layout.headerSeparator ?? false,
      showTopLine: layout.showTopLine ?? false,
      showBottomBar: layout.showBottomBar ?? true,
      sidebarBg: layout.sidebarBg,
    };
  });
}
