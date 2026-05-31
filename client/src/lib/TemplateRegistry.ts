/**
 * TemplateRegistry — الجسر المعماري المركزي للقوالب
 * يربط كل قالب بالقسم والتصنيف الخاص به ديناميكياً
 * يضمن عدم اختفاء أي قالب من لوحة الإدارة
 */

// ─── Section Definition ─────────────────────────────────────
export interface TemplateSection {
  id: string;
  label: string;
  icon: string;
  color: string;
  /** Keywords used for fuzzy-matching template names when sectionId is missing */
  keywords: string[];
}

// ─── All known sections (single source of truth) ────────────
export const TEMPLATE_SECTIONS: TemplateSection[] = [
  { id: "all",          label: "الكل",            icon: "📋", color: "#6B7280", keywords: [] },
  { id: "performance",  label: "شواهد الأداء",     icon: "📊", color: "#059669", keywords: ["شاهد", "أداء", "performance", "evidence", "وظيفي"] },
  { id: "certificates", label: "الشهادات",         icon: "🏆", color: "#D97706", keywords: ["شهادة", "certificate", "شكر", "تقدير", "award"] },
  { id: "covers",       label: "الأغلفة",          icon: "📕", color: "#7C3AED", keywords: ["غلاف", "cover", "واجهة"] },
  { id: "reports",      label: "التقارير",          icon: "📝", color: "#2563EB", keywords: ["تقرير", "report", "نهائي", "final"] },
  { id: "exams",        label: "الاختبارات",        icon: "📄", color: "#DC2626", keywords: ["اختبار", "exam", "امتحان", "test"] },
  { id: "radio",        label: "الإذاعة",           icon: "📻", color: "#0891B2", keywords: ["إذاعة", "radio", "مدرسية"] },
  { id: "smartcv",      label: "السيرة الذاتية",    icon: "👤", color: "#4F46E5", keywords: ["سيرة", "cv", "ذاتية", "resume"] },
  { id: "portfolio",    label: "ملف الإنجاز",       icon: "📁", color: "#0D9488", keywords: ["إنجاز", "portfolio", "ملف"] },
  { id: "evaluation",   label: "التقييم النهائي",   icon: "⭐", color: "#F59E0B", keywords: ["تقييم", "evaluation", "نهائي", "final evaluation"] },
  { id: "treatment",    label: "الخطة العلاجية",    icon: "💊", color: "#EC4899", keywords: ["علاج", "treatment", "خطة علاجية"] },
  { id: "identity",     label: "الهوية البصرية",    icon: "🎨", color: "#8B5CF6", keywords: ["هوية", "identity", "بصرية", "branding"] },
];

// ─── Quick lookups ──────────────────────────────────────────
const sectionMap = new Map(TEMPLATE_SECTIONS.map(s => [s.id, s]));

/**
 * getSection — resolve the section a template belongs to.
 *
 * Priority:
 *  1. Explicit `templateLayout.sectionId`
 *  2. Top-level `sectionId` field on template
 *  3. Fuzzy match against template name using section keywords
 *  4. Fallback to "performance" (most common)
 */
export function getTemplateSection(template: {
  name?: string;
  sectionId?: string;
  templateLayout?: Record<string, any> | null;
}): TemplateSection {
  // 1. Explicit sectionId in layout
  const layoutSectionId = template.templateLayout?.sectionId;
  if (layoutSectionId && sectionMap.has(layoutSectionId)) {
    return sectionMap.get(layoutSectionId)!;
  }

  // 2. Top-level sectionId
  if (template.sectionId && sectionMap.has(template.sectionId)) {
    return sectionMap.get(template.sectionId)!;
  }

  // 3. Fuzzy match by template name
  if (template.name) {
    const nameLower = template.name.toLowerCase();
    for (const section of TEMPLATE_SECTIONS) {
      if (section.id === "all") continue;
      if (section.keywords.some(kw => nameLower.includes(kw.toLowerCase()))) {
        return section;
      }
    }
  }

  // 4. Fallback
  return sectionMap.get("performance")!;
}

/**
 * getSectionId — shorthand to get just the section ID string
 */
export function getSectionId(template: Parameters<typeof getTemplateSection>[0]): string {
  return getTemplateSection(template).id;
}

/**
 * filterBySection — filter templates by section ID
 *  - "all" → returns everything
 *  - otherwise → matches via getTemplateSection()
 */
export function filterBySection<T extends { name?: string; sectionId?: string; templateLayout?: Record<string, any> | null }>(
  templates: T[],
  sectionId: string,
): T[] {
  if (sectionId === "all") return templates;
  return templates.filter(t => getSectionId(t) === sectionId);
}

/**
 * countBySection — count templates per section
 * Returns a Map of sectionId → count
 */
export function countBySection<T extends { name?: string; sectionId?: string; templateLayout?: Record<string, any> | null }>(
  templates: T[],
): Map<string, number> {
  const counts = new Map<string, number>();
  // Initialize all sections at 0
  for (const sec of TEMPLATE_SECTIONS) {
    if (sec.id === "all") continue;
    counts.set(sec.id, 0);
  }
  // Count each template
  for (const t of templates) {
    const sid = getSectionId(t);
    counts.set(sid, (counts.get(sid) || 0) + 1);
  }
  return counts;
}

/**
 * getSectionColor — get the accent color for a section
 */
export function getSectionColor(sectionId: string): string {
  return sectionMap.get(sectionId)?.color || "#6B7280";
}

/**
 * getSectionLabel — get the localized label for a section
 */
export function getSectionLabel(sectionId: string): string {
  return sectionMap.get(sectionId)?.label || sectionId;
}

/**
 * isCanvasTemplate — determines if a template is a "New Canvas JSON" template
 * vs. a "Legacy React" template.
 *
 * - Legacy templates have canvasData === null (seeded defaults, React components)
 * - Canvas templates have canvasData !== null (created via AdvancedTemplateBuilder)
 */
export function isCanvasTemplate(template: { canvasData?: any }): boolean {
  return template.canvasData != null;
}
