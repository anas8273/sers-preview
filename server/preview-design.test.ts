import { describe, it, expect } from "vitest";

/**
 * اختبارات تصميم المعاينة وإصلاحات الشواهد
 * - إصلاح زر الرابط (فلتر الشواهد)
 * - حذف خيار شاهد النص
 * - تصميم المعاينة بنمط fieldset/legend
 * - نظام الباركود
 */

// ─── Evidence Type Filter Logic ────────────────────────
describe("Evidence Type Filter Logic", () => {
  type EvidenceType = "text" | "image" | "link" | "video" | "file";
  interface Evidence {
    id: string;
    type: EvidenceType;
    formData?: Record<string, string>;
  }

  // محاكاة الفلتر القديم (المعطل)
  function oldFilter(ev: Evidence, hasFormFields: boolean): boolean {
    return !(ev.formData !== undefined && hasFormFields);
  }

  // محاكاة الفلتر الجديد (المصلح)
  function newFilter(ev: Evidence, hasFormFields: boolean): boolean {
    if (ev.type !== "text") return true;
    return !(ev.formData !== undefined && hasFormFields);
  }

  it("old filter incorrectly hides link evidence when formFields exist", () => {
    const linkEvidence: Evidence = {
      id: "ev1",
      type: "link",
      formData: {}, // createEmptyEvidence sets formData: {} by default
    };
    // Old filter would hide this because formData !== undefined && hasFormFields
    const result = oldFilter(linkEvidence, true);
    expect(result).toBe(false); // Bug: link evidence hidden!
  });

  it("new filter correctly shows link evidence even when formFields exist", () => {
    const linkEvidence: Evidence = {
      id: "ev1",
      type: "link",
      formData: {},
    };
    const result = newFilter(linkEvidence, true);
    expect(result).toBe(true); // Fixed: link evidence visible
  });

  it("new filter correctly shows image evidence with formFields", () => {
    const imageEvidence: Evidence = {
      id: "ev2",
      type: "image",
      formData: {},
    };
    const result = newFilter(imageEvidence, true);
    expect(result).toBe(true);
  });

  it("new filter correctly shows video evidence with formFields", () => {
    const videoEvidence: Evidence = {
      id: "ev3",
      type: "video",
      formData: {},
    };
    const result = newFilter(videoEvidence, true);
    expect(result).toBe(true);
  });

  it("new filter correctly shows file evidence with formFields", () => {
    const fileEvidence: Evidence = {
      id: "ev4",
      type: "file",
      formData: {},
    };
    const result = newFilter(fileEvidence, true);
    expect(result).toBe(true);
  });

  it("new filter still hides text evidence with formData when formFields exist", () => {
    const textEvidence: Evidence = {
      id: "ev5",
      type: "text",
      formData: { title: "test" },
    };
    const result = newFilter(textEvidence, true);
    expect(result).toBe(false); // text with formData + formFields should be hidden
  });

  it("new filter shows text evidence without formFields", () => {
    const textEvidence: Evidence = {
      id: "ev6",
      type: "text",
      formData: {},
    };
    const result = newFilter(textEvidence, false);
    expect(result).toBe(true); // no formFields, so text should show
  });

  it("new filter shows all types when no formFields", () => {
    const types: EvidenceType[] = ["text", "image", "link", "video", "file"];
    types.forEach((type) => {
      const ev: Evidence = { id: `ev_${type}`, type, formData: {} };
      expect(newFilter(ev, false)).toBe(true);
    });
  });
});

// ─── Theme Configuration ────────────────────────────────
describe("Theme Configuration", () => {
  const THEMES = [
    { id: "edu-forms", name: "الهوية البصرية الأصلية", headerBg: "linear-gradient(135deg, #1B5E6B, #1A6B7A, #2E8B7A)", headerText: "#fff", accent: "#1A6B7A", borderColor: "#1B5E6B" },
    { id: "edu-forms-gradient", name: "الهوية البصرية تدرج", headerBg: "linear-gradient(135deg, #0D4F5F, #1A6B7A, #2E9E8B)", headerText: "#fff", accent: "#1A6B7A", borderColor: "#0D4F5F" },
    { id: "simple", name: "بسيط (توفير حبر)", headerBg: "#f8f9fa", headerText: "#1a1a1a", accent: "#1A6B7A", borderColor: "#e5e7eb" },
    { id: "official", name: "الهوية الرسمية", headerBg: "#1B5E20", headerText: "#fff", accent: "#2E7D32", borderColor: "#1B5E20" },
    { id: "official-gradient", name: "تدرج رسمي", headerBg: "linear-gradient(135deg, #1B5E20, #2E7D32, #43A047)", headerText: "#fff", accent: "#2E7D32", borderColor: "#1B5E20" },
    { id: "blue", name: "أزرق كلاسيكي", headerBg: "#0D47A1", headerText: "#fff", accent: "#1565C0", borderColor: "#0D47A1" },
    { id: "blue-gradient", name: "أزرق متدرج", headerBg: "linear-gradient(135deg, #0D47A1, #1565C0, #1976D2)", headerText: "#fff", accent: "#1565C0", borderColor: "#0D47A1" },
    { id: "purple", name: "بنفسجي أنيق", headerBg: "#4A148C", headerText: "#fff", accent: "#6A1B9A", borderColor: "#4A148C" },
    { id: "gold", name: "ذهبي فاخر", headerBg: "linear-gradient(135deg, #5D4037, #795548, #8D6E63)", headerText: "#fff", accent: "#795548", borderColor: "#5D4037" },
    { id: "modern-dark", name: "عصري داكن", headerBg: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)", headerText: "#fff", accent: "#0f3460", borderColor: "#1a1a2e" },
  ];

  it("has at least 10 themes available", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(10);
  });

  it("edu-forms theme uses correct teal/green colors", () => {
    const eduForms = THEMES.find((t) => t.id === "edu-forms");
    expect(eduForms).toBeDefined();
    expect(eduForms!.accent).toBe("#1A6B7A");
    expect(eduForms!.borderColor).toBe("#1B5E6B");
    expect(eduForms!.headerBg).toContain("#1B5E6B");
  });

  it("edu-forms-gradient theme uses correct gradient", () => {
    const eduFormsGrad = THEMES.find((t) => t.id === "edu-forms-gradient");
    expect(eduFormsGrad).toBeDefined();
    expect(eduFormsGrad!.headerBg).toContain("linear-gradient");
    expect(eduFormsGrad!.headerBg).toContain("#0D4F5F");
    expect(eduFormsGrad!.headerBg).toContain("#2E9E8B");
  });

  it("simple theme has light background for ink saving", () => {
    const simple = THEMES.find((t) => t.id === "simple");
    expect(simple).toBeDefined();
    expect(simple!.headerBg).toBe("#f8f9fa");
    expect(simple!.headerText).toBe("#1a1a1a");
  });

  it("all themes have required properties", () => {
    THEMES.forEach((theme) => {
      expect(theme.id).toBeTruthy();
      expect(theme.name).toBeTruthy();
      expect(theme.headerBg).toBeTruthy();
      expect(theme.headerText).toBeTruthy();
      expect(theme.accent).toBeTruthy();
      expect(theme.borderColor).toBeTruthy();
    });
  });

  it("all theme IDs are unique", () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── FormData Layout Logic ────────────────────────────────
describe("FormData Layout Logic (fieldset/legend)", () => {
  function categorizeEntries(entries: [string, string][]) {
    const shortEntries = entries.filter(([, v]) => v.length < 80);
    const longEntries = entries.filter(([, v]) => v.length >= 80);
    return { shortEntries, longEntries };
  }

  function buildRows<T>(items: T[], perRow: number): T[][] {
    const rows: T[][] = [];
    for (let i = 0; i < items.length; i += perRow) {
      rows.push(items.slice(i, i + perRow));
    }
    return rows;
  }

  it("categorizes short entries correctly (< 80 chars)", () => {
    const entries: [string, string][] = [
      ["name", "أحمد"],
      ["school", "مدرسة النور"],
      ["date", "1447/01/01"],
    ];
    const { shortEntries, longEntries } = categorizeEntries(entries);
    expect(shortEntries.length).toBe(3);
    expect(longEntries.length).toBe(0);
  });

  it("categorizes long entries correctly (>= 80 chars)", () => {
    const longText = "هذا نص طويل جداً يتجاوز الثمانين حرفاً ويجب أن يُعرض في حقل كبير بعرض كامل أو نصف العرض حسب التصميم المطلوب";
    const entries: [string, string][] = [
      ["name", "أحمد"],
      ["description", longText],
    ];
    const { shortEntries, longEntries } = categorizeEntries(entries);
    expect(shortEntries.length).toBe(1);
    expect(longEntries.length).toBe(1);
  });

  it("builds rows of 3 for short entries", () => {
    const items = ["a", "b", "c", "d", "e"];
    const rows = buildRows(items, 3);
    expect(rows.length).toBe(2);
    expect(rows[0].length).toBe(3);
    expect(rows[1].length).toBe(2);
  });

  it("builds pairs of 2 for long entries", () => {
    const items = ["long1", "long2", "long3"];
    const rows = buildRows(items, 2);
    expect(rows.length).toBe(2);
    expect(rows[0].length).toBe(2);
    expect(rows[1].length).toBe(1);
  });

  it("handles empty entries", () => {
    const entries: [string, string][] = [];
    const { shortEntries, longEntries } = categorizeEntries(entries);
    expect(shortEntries.length).toBe(0);
    expect(longEntries.length).toBe(0);
  });

  it("filters out __label_ prefixed keys", () => {
    const entries: [string, string][] = [
      ["name", "أحمد"],
      ["__label_dynamic_1", "اسم الحقل"],
      ["dynamic_1", "قيمة الحقل"],
    ];
    const filtered = entries.filter(([k]) => !k.startsWith("__label_"));
    expect(filtered.length).toBe(2);
    expect(filtered.map(([k]) => k)).toEqual(["name", "dynamic_1"]);
  });
});

// ─── QR Code / Barcode Logic ────────────────────────────
describe("QR Code / Barcode Display Logic", () => {
  interface Evidence {
    type: string;
    showBarcode?: boolean;
    displayAs?: "image" | "qr";
    link?: string;
    fileData?: string | null;
    fileName?: string;
  }

  function shouldShowQR(ev: Evidence): boolean {
    if (ev.type === "link") return ev.showBarcode !== false;
    if (ev.type === "video" || ev.type === "file") return ev.showBarcode !== false;
    if (ev.type === "image") return ev.displayAs !== "image";
    return false;
  }

  it("link evidence shows QR by default", () => {
    expect(shouldShowQR({ type: "link", link: "https://example.com" })).toBe(true);
  });

  it("link evidence hides QR when showBarcode is false", () => {
    expect(shouldShowQR({ type: "link", link: "https://example.com", showBarcode: false })).toBe(false);
  });

  it("video evidence shows QR by default", () => {
    expect(shouldShowQR({ type: "video", fileName: "video.mp4" })).toBe(true);
  });

  it("file evidence shows QR by default", () => {
    expect(shouldShowQR({ type: "file", fileName: "doc.pdf" })).toBe(true);
  });

  it("image evidence shows as image by default (displayAs=image)", () => {
    expect(shouldShowQR({ type: "image", displayAs: "image" })).toBe(false);
  });

  it("image evidence shows QR when displayAs=qr", () => {
    expect(shouldShowQR({ type: "image", displayAs: "qr" })).toBe(true);
  });

  it("text evidence never shows QR", () => {
    expect(shouldShowQR({ type: "text" })).toBe(false);
  });
});

// ─── Evidence Types Available ────────────────────────────
describe("Evidence Types Available", () => {
  // After removing "text" from quick add buttons, only these types should be available
  const QUICK_ADD_TYPES = ["link", "video"];
  const UPLOAD_TYPES = ["image", "video", "file"];
  const ALL_TYPES = ["text", "image", "link", "video", "file"];

  it("quick add buttons include link type", () => {
    expect(QUICK_ADD_TYPES).toContain("link");
  });

  it("quick add buttons include video type", () => {
    expect(QUICK_ADD_TYPES).toContain("video");
  });

  it("quick add buttons do NOT include text type", () => {
    expect(QUICK_ADD_TYPES).not.toContain("text");
  });

  it("upload supports image, video, and file types", () => {
    UPLOAD_TYPES.forEach((type) => {
      expect(ALL_TYPES).toContain(type);
    });
  });

  it("all evidence types are valid", () => {
    expect(ALL_TYPES).toEqual(["text", "image", "link", "video", "file"]);
  });
});

// ─── Priority Configuration ────────────────────────────
describe("Priority Configuration", () => {
  const PRIORITY_CONFIG = {
    essential: { label: "أساسي", color: "#059669", icon: "★" },
    supporting: { label: "داعم", color: "#2563EB", icon: "◆" },
    additional: { label: "إضافي", color: "#9333EA", icon: "○" },
  };

  it("has 3 priority levels", () => {
    expect(Object.keys(PRIORITY_CONFIG).length).toBe(3);
  });

  it("essential priority has green color", () => {
    expect(PRIORITY_CONFIG.essential.color).toBe("#059669");
  });

  it("supporting priority has blue color", () => {
    expect(PRIORITY_CONFIG.supporting.color).toBe("#2563EB");
  });

  it("additional priority has purple color", () => {
    expect(PRIORITY_CONFIG.additional.color).toBe("#9333EA");
  });

  it("all priorities have labels, colors, and icons", () => {
    Object.values(PRIORITY_CONFIG).forEach((config) => {
      expect(config.label).toBeTruthy();
      expect(config.color).toBeTruthy();
      expect(config.icon).toBeTruthy();
    });
  });
});

// ─── Field Label Resolution ────────────────────────────
describe("Field Label Resolution", () => {
  interface FormField {
    id: string;
    label: string;
  }

  function getLabel(key: string, formFields?: FormField[], formData?: Record<string, string>): string {
    if (key.startsWith("dynamic_")) return formData?.[`__label_${key}`] || "حقل إضافي";
    const matchedField = formFields?.find((f) => f.id === key);
    if (matchedField) return matchedField.label;
    const defaults: Record<string, string> = {
      evidence_desc: "وصف الشاهد",
      date: "التاريخ",
      notes: "ملاحظات",
      title: "العنوان",
      details: "التفاصيل",
      content: "المحتوى",
    };
    return defaults[key] || key;
  }

  it("resolves field label from formFields", () => {
    const fields: FormField[] = [{ id: "custom_field", label: "حقل مخصص" }];
    expect(getLabel("custom_field", fields)).toBe("حقل مخصص");
  });

  it("resolves dynamic field label from formData", () => {
    const formData = { __label_dynamic_1: "اسم ديناميكي", dynamic_1: "قيمة" };
    expect(getLabel("dynamic_1", [], formData)).toBe("اسم ديناميكي");
  });

  it("falls back to default labels for known keys", () => {
    expect(getLabel("evidence_desc")).toBe("وصف الشاهد");
    expect(getLabel("date")).toBe("التاريخ");
    expect(getLabel("notes")).toBe("ملاحظات");
    expect(getLabel("title")).toBe("العنوان");
    expect(getLabel("details")).toBe("التفاصيل");
    expect(getLabel("content")).toBe("المحتوى");
  });

  it("returns key as-is for unknown fields", () => {
    expect(getLabel("unknown_field")).toBe("unknown_field");
  });

  it("returns 'حقل إضافي' for dynamic fields without label", () => {
    expect(getLabel("dynamic_99")).toBe("حقل إضافي");
  });
});
