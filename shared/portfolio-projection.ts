export const PORTFOLIO_SCHEMA_VERSION = 1 as const;
export const PORTFOLIO_MAX_ENTRIES = 100;

export type PortfolioEntryKind = "work" | "asset";

export type PortfolioEntry = {
  id: string;
  sectionTitle: string;
  kind: PortfolioEntryKind;
  refId: number;
  note?: string;
};

export type PortfolioDraftData = {
  schemaVersion: typeof PORTFOLIO_SCHEMA_VERSION;
  revision: number;
  introduction: string;
  entries: PortfolioEntry[];
  updatedAt: string;
};

export type PortfolioReadiness = {
  status: "ready" | "needs_attention" | "incomplete";
  label: string;
  workCount: number;
  assetCount: number;
  missingReasons: string[];
};

export class PortfolioValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortfolioValidationError";
  }
}

export function normalizePortfolioDraft(value: unknown): PortfolioDraftData {
  if (!value || typeof value !== "object") {
    return {
      schemaVersion: PORTFOLIO_SCHEMA_VERSION,
      revision: 0,
      introduction: "",
      entries: [],
      updatedAt: new Date(0).toISOString(),
    };
  }
  const input = value as Record<string, unknown>;
  const introduction = typeof input.introduction === "string" ? input.introduction.trim() : "";
  if (introduction.length > 5_000) {
    throw new PortfolioValidationError("مقدمة ملف الإنجاز أطول من الحد المسموح (5000 حرف)");
  }
  const rawEntries = Array.isArray(input.entries) ? input.entries : [];
  if (rawEntries.length > PORTFOLIO_MAX_ENTRIES) {
    throw new PortfolioValidationError("عدد عناصر ملف الإنجاز يتجاوز الحد المسموح (100 عنصر)");
  }

  const seenRefs = new Set<string>();
  const entries: PortfolioEntry[] = [];
  for (let i = 0; i < rawEntries.length; i++) {
    const raw = rawEntries[i];
    if (!raw || typeof raw !== "object") {
      throw new PortfolioValidationError("أحد عناصر ملف الإنجاز غير صالح");
    }
    const item = raw as Record<string, unknown>;
    const kind = item.kind;
    if (kind !== "work" && kind !== "asset") {
      throw new PortfolioValidationError("نوع المرجع يجب أن يكون عملًا أو شاهدًا");
    }
    const refId = Number(item.refId);
    if (!Number.isSafeInteger(refId) || refId <= 0) {
      throw new PortfolioValidationError("معرّف المرجع غير صالح");
    }
    const refKey = `${kind}:${refId}`;
    if (seenRefs.has(refKey)) {
      throw new PortfolioValidationError("لا يمكن تكرار نفس العمل أو الشاهد داخل ملف الإنجاز");
    }
    seenRefs.add(refKey);

    const sectionTitle = typeof item.sectionTitle === "string" ? item.sectionTitle.trim() : "";
    if (!sectionTitle || sectionTitle.length > 128) {
      throw new PortfolioValidationError("أدخل عنوان قسم صالح لكل عنصر (1 إلى 128 حرفًا)");
    }
    const note = typeof item.note === "string" ? item.note.trim() : undefined;
    if (note && note.length > 1_000) {
      throw new PortfolioValidationError("ملاحظة العنصر أطول من الحد المسموح (1000 حرف)");
    }
    const id = typeof item.id === "string" && item.id.trim().length > 0 && item.id.length <= 64
      ? item.id.trim()
      : `${kind}-${refId}`;
    entries.push({
      id,
      sectionTitle,
      kind,
      refId,
      ...(note ? { note } : {}),
    });
  }

  const revision = Number.isInteger(input.revision) && Number(input.revision) >= 0 ? Number(input.revision) : 0;
  const updatedAt = typeof input.updatedAt === "string" ? input.updatedAt : new Date(0).toISOString();

  return {
    schemaVersion: PORTFOLIO_SCHEMA_VERSION,
    revision,
    introduction,
    entries,
    updatedAt,
  };
}

export function computePortfolioReadiness(draft: Pick<PortfolioDraftData, "introduction" | "entries">): PortfolioReadiness {
  const workCount = draft.entries.filter(entry => entry.kind === "work").length;
  const assetCount = draft.entries.filter(entry => entry.kind === "asset").length;
  const missingReasons: string[] = [];

  if (draft.entries.length === 0) {
    missingReasons.push("أضف عملًا أو شاهدًا واحدًا على الأقل");
  }
  if (!draft.introduction.trim()) {
    missingReasons.push("أضف مقدمة موجزة لملف الإنجاز");
  }

  if (draft.entries.length === 0) {
    return { status: "incomplete", label: "غير مكتمل", workCount, assetCount, missingReasons };
  }
  if (missingReasons.length > 0 || (workCount === 0 && assetCount < 2)) {
    if (workCount === 0 && assetCount < 2) {
      missingReasons.push("يُفضّل ربط تقرير واحد على الأقل أو شاهدين");
    }
    return { status: "needs_attention", label: "يحتاج استكمالًا", workCount, assetCount, missingReasons };
  }
  return { status: "ready", label: "جاهز للتثبيت", workCount, assetCount, missingReasons: [] };
}
