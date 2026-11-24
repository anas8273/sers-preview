import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isReportIdentityFieldKey,
  normalizeReportIdentity,
  REPORT_IDENTITY_KEYS,
  REPORT_IDENTITY_TEXT_LIMIT,
  REPORT_IDENTITY_VERSION,
  reportInstitution,
} from "../shared/report-appearance";
import {
  normalizeReportDraft,
  projectReportDocument,
  REPORT_SCHEMA_VERSION,
  REPORT_TEMPLATE_DEFINITIONS,
  ReportDocumentValidationError,
} from "../shared/report-projection";
import { projectReportSnapshot } from "./public-output-service";
import { escapeCssString, renderReportWorkVersionHtml } from "./work-version-report-renderer";
import { sanitizeReportSchoolLogo } from "./work-version-report-assets";
import {
  hasRevokedRendererArtifact,
  recognizedRenderer,
  REPORT_DOCX_RENDERER_VERSION,
  REPORT_PDF_RENDERER_VERSION,
} from "./work-version-output-service";

const { mockGetDb, mockCaptureAcademicContext } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockCaptureAcademicContext: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mockGetDb,
}));

vi.mock("./pdf-renderer", () => ({
  renderHtmlToPdf: vi.fn(),
}));

vi.mock("./account-db", async importOriginal => {
  const actual = await importOriginal<typeof import("./account-db")>();
  return {
    ...actual,
    captureAcademicContext: mockCaptureAcademicContext,
  };
});

import { reportDraftRouter } from "./report-draft-router";
import {
  createReportDraftVersionForUser,
  ReportDraftValidationError,
  saveReportDraftForUser,
} from "./work-report-draft-db";
import { updateWorkItemForUser, WorkVersionConflictError } from "./domain-db";

function validRgbaPngBase64(width = 8, height = 8) {
  const png = new PNG({ width, height });
  png.data.fill(180);
  return PNG.sync.write(png).toString("base64");
}

function makeCaller() {
  return reportDraftRouter.createCaller({
    req: {} as never,
    res: {} as never,
    user: { id: 1, openId: "tester", name: "Tester", role: "user" } as never,
  });
}

describe("M1 reconciled backend & shared contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reportIdentity normalization & dual-source smuggling prevention", () => {
    it("normalizes typed reportIdentity, strips control chars, slices to 120, and omits empty identity", () => {
      const longSchool = `\u0007  مدرسة ${"أ".repeat(150)}  \n`;
      const logo = validRgbaPngBase64();
      const draft = normalizeReportDraft({
        schemaVersion: REPORT_SCHEMA_VERSION,
        templateId: "program-report",
        templateVersionId: "program-report@1",
        themeId: "formal",
        fontFamily: "Cairo",
        fields: { summary: "ملخص معتمد" },
        fieldDefinitions: REPORT_TEMPLATE_DEFINITIONS["program-report"].fields,
        evidenceAssetIds: [],
        reportIdentity: {
          version: REPORT_IDENTITY_VERSION,
          schoolName: longSchool,
          reportPreparer: "  أمل \t محمد  ",
          ministryLogo: true,
          schoolLogoPng: logo,
        },
      });
      expect(draft.reportIdentity).toBeDefined();
      expect(draft.reportIdentity?.version).toBe("1");
      expect(draft.reportIdentity?.schoolName?.length).toBe(REPORT_IDENTITY_TEXT_LIMIT);
      expect(draft.reportIdentity?.schoolName).not.toMatch(/[\x00-\x1f\x7f]/);
      expect(draft.reportIdentity?.reportPreparer).toBe("أمل   محمد");
      expect(draft.reportIdentity?.schoolPrincipal).toBeUndefined();
      expect(draft.reportIdentity?.ministryLogo).toBe(true);
      expect(draft.reportIdentity?.schoolLogoPng).toBe(logo);
      expect(Object.keys(draft.fields)).toEqual(["summary"]);

      const model = projectReportDocument({ reportDraft: draft });
      expect(model.reportIdentity).toEqual(draft.reportIdentity);
      expect(model.identity.visible).toBe(true);
      expect(model.identity.signers).toEqual([{ label: "معد التقرير", name: "أمل   محمد" }]);

      const emptyIdentity = normalizeReportIdentity({ version: "1", schoolName: "   ", ministryLogo: false });
      expect(emptyIdentity).toBeUndefined();
    });

    it("migrates legacy PR #40 fields.reportIdentityVersion='1' into top-level reportIdentity cleanly and idempotently", () => {
      const logo = validRgbaPngBase64();
      const normalized = normalizeReportDraft({
        schemaVersion: 1,
        templateId: "custom",
        themeId: "classic",
        fontFamily: "Tajawal",
        fields: {
          summary: "تقرير قديم",
          reportIdentityVersion: "1",
          schoolName: "مدرسة الوفاء",
          reportPreparer: "مريم",
          schoolPrincipal: "خالد",
          ministryLogo: "yes",
          schoolLogoPng: logo,
        },
        evidenceAssetIds: [],
      });

      expect(normalized.fields).toEqual({ summary: "تقرير قديم" });
      for (const key of REPORT_IDENTITY_KEYS) {
        expect(normalized.fields).not.toHaveProperty(key);
        expect(isReportIdentityFieldKey(key)).toBe(true);
      }
      expect(normalized.reportIdentity).toEqual({
        version: "1",
        schoolName: "مدرسة الوفاء",
        reportPreparer: "مريم",
        schoolPrincipal: "خالد",
        ministryLogo: true,
        schoolLogoPng: logo,
      });

      // Second pass must be completely idempotent.
      expect(normalizeReportDraft(normalized)).toEqual({
        ...normalized,
        migratedFromSchemaVersion: undefined,
      });
      expect(reportInstitution(normalized.reportIdentity)).toEqual(
        reportInstitution({
          reportIdentityVersion: "1",
          schoolName: "مدرسة الوفاء",
          reportPreparer: "مريم",
          schoolPrincipal: "خالد",
          ministryLogo: "yes",
          schoolLogoPng: logo,
        }),
      );
    });

    it("rejects dual-source identity smuggling, missing/bad identity version, and identity keys in frozenFieldDefinitions", () => {
      expect(() => normalizeReportDraft({
        schemaVersion: REPORT_SCHEMA_VERSION,
        templateId: "custom",
        templateVersionId: "custom@1",
        themeId: "classic",
        fontFamily: "Cairo",
        fields: { summary: "نص", reportIdentityVersion: "1", schoolName: "مهرب" },
        reportIdentity: { version: "1", schoolName: "رسمي" },
        fieldDefinitions: REPORT_TEMPLATE_DEFINITIONS.custom.fields,
        evidenceAssetIds: [],
      })).toThrow(ReportDocumentValidationError);

      expect(() => normalizeReportDraft({
        schemaVersion: 1,
        templateId: "custom",
        themeId: "classic",
        fontFamily: "Cairo",
        fields: { summary: "نص", schoolName: "بلا إصدار" },
        evidenceAssetIds: [],
      })).toThrow(ReportDocumentValidationError);

      expect(() => normalizeReportDraft({
        schemaVersion: 1,
        templateId: "custom",
        themeId: "classic",
        fontFamily: "Cairo",
        fields: { summary: "نص", reportIdentityVersion: "2", schoolName: "إصدار غير مدعوم" },
        evidenceAssetIds: [],
      })).toThrow(ReportDocumentValidationError);

      expect(() => normalizeReportDraft({
        schemaVersion: REPORT_SCHEMA_VERSION,
        templateId: "custom",
        templateVersionId: "custom@1",
        themeId: "classic",
        fontFamily: "Cairo",
        fields: {},
        fieldDefinitions: [
          ...REPORT_TEMPLATE_DEFINITIONS.custom.fields,
          { key: "schoolName", label: "حقل مخترق", type: "text" },
        ],
        evidenceAssetIds: [],
      })).toThrow(ReportDocumentValidationError);
    });

    it("rejects schemaVersion: 2 fields smuggling and invalid PNG logos at reportDraftRouter.save", async () => {
      const caller = makeCaller();
      const fieldDefinitions = REPORT_TEMPLATE_DEFINITIONS.custom.fields.map(field => ({
        ...field,
        options: field.options ? [...field.options] : undefined,
      }));
      await expect(caller.save({
        workItemId: 1,
        expectedRevision: 0,
        schemaVersion: 2,
        templateId: "custom",
        templateVersionId: "custom@1",
        themeId: "classic",
        fontFamily: "Cairo",
        fields: { summary: "نص", reportIdentityVersion: "1", schoolName: "مدرسة" },
        fieldDefinitions,
        evidenceAssetIds: [],
      })).rejects.toMatchObject({ code: "BAD_REQUEST" });

      await expect(caller.save({
        workItemId: 1,
        expectedRevision: 0,
        schemaVersion: 2,
        templateId: "custom",
        templateVersionId: "custom@1",
        themeId: "classic",
        fontFamily: "Cairo",
        fields: { summary: "نص" },
        reportIdentity: {
          version: "1",
          schoolLogoPng: Buffer.from("not-a-valid-png").toString("base64"),
        },
        fieldDefinitions,
        evidenceAssetIds: [],
      })).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(mockGetDb).not.toHaveBeenCalled();
    });
  });

  describe("school logo sanitization & PublicOutput invalid-logo fault isolation", () => {
    it("sanitizes valid school logos and rejects invalid PNGs in saveReportDraftForUser & createReportDraftVersionForUser", async () => {
      const valid = validRgbaPngBase64(16, 16);
      const clean = sanitizeReportSchoolLogo(valid);
      expect(clean.width).toBe(16);
      expect(clean.height).toBe(16);
      expect(() => sanitizeReportSchoolLogo(Buffer.from("not-png").toString("base64"))).toThrow();

      const invalidPngBase64 = Buffer.from("still-valid-base64-not-png").toString("base64");

      // Stub a minimal tx for saveReportDraftForUser reaching logo sanitization.
      const saveSelectResults = [
        [{ id: 7, type: "report", status: "draft", ownerType: "personal", ownerUserId: 1, ownerOrganizationId: null }],
        [{ id: 1 }],
        [{ id: 7, type: "report", status: "draft", ownerType: "personal", ownerUserId: 1, ownerOrganizationId: null }],
        [],
      ];
      let saveIdx = 0;
      const makeSelectChain = (rows: unknown[]) => ({
        from: () => ({
          where: () => ({
            limit: () => Object.assign(Promise.resolve(rows), { for: () => Promise.resolve(rows) }),
            orderBy: () => ({
              limit: () => Object.assign(Promise.resolve(rows), { for: () => Promise.resolve(rows) }),
            }),
          }),
        }),
      });
      const fakeDbForSave = {
        transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
          select: () => makeSelectChain(saveSelectResults[saveIdx++] ?? []),
        }),
      };
      mockGetDb.mockResolvedValueOnce(fakeDbForSave);

      await expect(saveReportDraftForUser(1, {
        workItemId: 7,
        expectedRevision: 0,
        schemaVersion: 2,
        templateId: "custom",
        templateVersionId: "custom@1",
        themeId: "classic",
        fontFamily: "Cairo",
        fields: { summary: "ملخص" },
        reportIdentity: { version: "1", schoolLogoPng: invalidPngBase64 },
        fieldDefinitions: REPORT_TEMPLATE_DEFINITIONS.custom.fields,
        evidenceAssetIds: [],
      })).rejects.toBeInstanceOf(ReportDraftValidationError);

      // Stub hint read for createReportDraftVersionForUser containing an invalid logo in stored block.
      const badBlock = {
        id: 55,
        data: {
          schemaVersion: 2,
          revision: 1,
          templateId: "custom",
          templateVersionId: "custom@1",
          themeId: "classic",
          fontFamily: "Cairo",
          fields: { summary: "ملخص" },
          reportIdentity: { version: "1", schoolLogoPng: invalidPngBase64 },
          fieldDefinitions: REPORT_TEMPLATE_DEFINITIONS.custom.fields,
          evidenceAssetIds: [],
          updatedAt: "2026-11-24T00:00:00.000Z",
        },
      };
      mockGetDb.mockResolvedValueOnce({
        select: () => makeSelectChain([badBlock]),
      });

      await expect(createReportDraftVersionForUser(1, {
        workItemId: 7,
        expectedRevision: 1,
      })).rejects.toBeInstanceOf(ReportDraftValidationError);
    });

    it("isolates invalid schoolLogo in projectReportSnapshot instead of returning undefined (404)", () => {
      const invalidPngBase64 = Buffer.from("not-a-valid-png-bytes").toString("base64");
      const baseSnapshot = {
        schemaVersion: REPORT_SCHEMA_VERSION,
        kind: "report",
        work: { title: "تقرير عام", ownerUserId: 999 },
        reportDraft: {
          schemaVersion: REPORT_SCHEMA_VERSION,
          templateId: "custom",
          templateVersionId: "custom@1",
          themeId: "classic",
          fontFamily: "Cairo",
          fields: { summary: "ملخص محفوظ" },
          reportIdentity: {
            version: "1" as const,
            schoolName: "مدرسة المستقبل",
            schoolLogoPng: invalidPngBase64,
          },
          fieldDefinitions: REPORT_TEMPLATE_DEFINITIONS.custom.fields,
          evidenceAssetIds: [],
          updatedAt: "2026-11-24T00:00:00.000Z",
        },
        assets: [{ id: 1, title: "شاهد", storageKey: "private/secret-key" }],
        capturedAt: "2026-11-24T00:00:00.000Z",
      };

      const projected = projectReportSnapshot(baseSnapshot);
      expect(projected).toBeDefined();
      expect(projected?.title).toBe("تقرير عام");
      expect(projected?.institution).toEqual({
        schoolName: "مدرسة المستقبل",
        ministryLogo: false,
        signers: [],
        visible: true,
      });
      expect(projected?.institution).not.toHaveProperty("schoolLogo");
      const serialized = JSON.stringify(projected);
      expect(serialized).not.toContain("ownerUserId");
      expect(serialized).not.toContain("private/secret-key");

      // When ONLY an invalid logo was present, institution is omitted cleanly and snapshot still resolves.
      const logoOnly = projectReportSnapshot({
        ...baseSnapshot,
        reportDraft: {
          ...baseSnapshot.reportDraft,
          reportIdentity: { version: "1" as const, schoolLogoPng: invalidPngBase64 },
        },
      });
      expect(logoOnly).toBeDefined();
      expect(logoOnly?.institution).toBeUndefined();

      // When valid logo is present, sanitized schoolLogo is attached.
      const validLogo = validRgbaPngBase64(10, 10);
      const withValidLogo = projectReportSnapshot({
        ...baseSnapshot,
        reportDraft: {
          ...baseSnapshot.reportDraft,
          reportIdentity: { version: "1" as const, schoolName: "مدرسة المستقبل", schoolLogoPng: validLogo },
        },
      });
      expect(withValidLogo?.institution?.schoolLogo).toBeTruthy();
    });
  });

  describe("CSS escaping for @top-right running header", () => {
    it("escapes quotes, backslashes, and newlines in escapeCssString and rendered @top-right", () => {
      const hostile = 'مدرسة "أ" \\\n} body { display: none; } /*';
      const escaped = escapeCssString(hostile);
      expect(escaped).not.toContain("\n");
      expect(escaped).not.toContain("\r");
      expect(escaped).toContain('\\"');
      expect(escaped).toContain("\\\\");

      const html = renderReportWorkVersionHtml({
        schemaVersion: REPORT_SCHEMA_VERSION,
        kind: "report",
        work: { title: "تقرير اختبار" },
        reportDraft: {
          schemaVersion: REPORT_SCHEMA_VERSION,
          templateId: "custom",
          templateVersionId: "custom@1",
          themeId: "classic",
          fontFamily: "Cairo",
          fields: { summary: "محتوى" },
          reportIdentity: { version: "1", schoolName: hostile },
          fieldDefinitions: REPORT_TEMPLATE_DEFINITIONS.custom.fields,
          evidenceAssetIds: [],
          updatedAt: "2026-11-24T00:00:00.000Z",
        },
        capturedAt: "2026-11-24T00:00:00.000Z",
      }, 1);

      const topRightMatch = html.match(/@top-right\s*\{\s*content:\s*"((?:[^"\\]|\\.)*)";/);
      expect(topRightMatch).toBeTruthy();
      expect(topRightMatch![1]).toContain('\\"أ\\"');
      expect(topRightMatch![1]).toContain("\\\\");
      expect(topRightMatch![1]).not.toMatch(/[\r\n]/);
    });
  });

  describe("renderer versions (PDF=6, DOCX=4), wire-boundary redaction, and cross-revision revocation", () => {
    it("locks PDF=6 and DOCX=4 and recognizes r1..r6 (PDF) and r1..r4 (DOCX) only", () => {
      expect(REPORT_PDF_RENDERER_VERSION).toBe(6);
      expect(REPORT_DOCX_RENDERER_VERSION).toBe(4);

      for (let rev = 1; rev <= 6; rev++) {
        expect(recognizedRenderer(`artifact:v42:pdf:r${rev}`, 42, "pdf")).toBe(rev);
      }
      expect(recognizedRenderer("artifact:v42:pdf:r0", 42, "pdf")).toBeUndefined();
      expect(recognizedRenderer("artifact:v42:pdf:r7", 42, "pdf")).toBeUndefined();
      expect(recognizedRenderer("artifact:v99:pdf:r6", 42, "pdf")).toBeUndefined();

      for (let rev = 1; rev <= 4; rev++) {
        expect(recognizedRenderer(`artifact:v42:docx:r${rev}`, 42, "docx")).toBe(rev);
      }
      expect(recognizedRenderer("artifact:v42:docx:r0", 42, "docx")).toBeUndefined();
      expect(recognizedRenderer("artifact:v42:docx:r5", 42, "docx")).toBeUndefined();
    });

    it("blocks regeneration across any revoked historical renderer revision (r1..r6 PDF, r1..r4 DOCX)", async () => {
      const digest = "a".repeat(64);
      for (const rev of [1, 2, 5, 6]) {
        mockGetDb.mockResolvedValueOnce({
          select: () => ({
            from: () => ({
              where: () => Promise.resolve([
                { token: `artifact:v10:pdf:r${rev}`, storageKey: `outputs/work-3/version-10/${digest}.pdf` },
              ]),
            }),
          }),
        });
        expect(await hasRevokedRendererArtifact(10, "pdf", 3)).toBe(true);
      }

      for (const rev of [1, 3, 4]) {
        mockGetDb.mockResolvedValueOnce({
          select: () => ({
            from: () => ({
              where: () => Promise.resolve([
                { token: `artifact:v10:docx:r${rev}`, storageKey: `outputs/work-3/version-10/${digest}.docx` },
              ]),
            }),
          }),
        });
        expect(await hasRevokedRendererArtifact(10, "docx", 3)).toBe(true);
      }

      const source = readFileSync(resolve(process.cwd(), "server/work-version-output-service.ts"), "utf8");
      expect(source).not.toContain("storageKey: output.storageKey");
      expect(source).not.toContain("contentHash: identity[1]");
      expect(source).not.toContain("stored.url");
      expect(source).not.toContain("rendererVersion: actualRendererVersion");
    });
  });

  describe("updateWorkItemForUser academicContext preservation & archive guard", () => {
    function buildWorkWriteMocks(workRow: Record<string, unknown>) {
      const updatedPayloads: Array<Record<string, unknown>> = [];
      const selectLimit = (rows: unknown[]) => Object.assign(Promise.resolve(rows), {
        for: () => Promise.resolve(rows),
      });
      const makeTx = () => {
        let txSelectCount = 0;
        const txRows = [
          [{ id: 1 }], // lockWriteScope personal user lock
          [workRow],   // locked workItems row
        ];
        return {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => selectLimit(txRows[txSelectCount++] ?? []),
              }),
            }),
          }),
          update: () => ({
            set: (values: Record<string, unknown>) => {
              updatedPayloads.push(values);
              return { where: () => Promise.resolve() };
            },
          }),
        };
      };

      // First getDb() is in withWorkWrite; second is in getWorkItemForUser -> assertWorkAccess; third is in getWorkItemForUser linkedAssets.
      const dbMock = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([workRow]),
            }),
            innerJoin: () => ({
              where: () => Promise.resolve([]),
            }),
          }),
        }),
        transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx()),
      };
      mockGetDb.mockResolvedValue(dbMock);
      return { updatedPayloads };
    }

    it("preserves academicYearId/academicTermId/academicContext on title-only edits without calling captureAcademicContext", async () => {
      const existingContext = {
        yearId: 12,
        yearLabel: "١٤٤٨–١٤٤٩ هـ",
        yearStartsOn: "2026-08-20",
        yearEndsOn: "2027-06-20",
        termId: 34,
        termLabel: "الفصل الأول",
        termStartsOn: "2026-08-20",
        termEndsOn: "2026-12-20",
      };
      const { updatedPayloads } = buildWorkWriteMocks({
        id: 100,
        ownerType: "personal",
        ownerUserId: 1,
        ownerOrganizationId: null,
        status: "draft",
        title: "عنوان قديم",
        academicYearId: 12,
        academicTermId: 34,
        academicContext: existingContext,
      });

      const result = await updateWorkItemForUser(1, 100, { title: "عنوان جديد" });
      expect(result).toBeDefined();
      expect(mockCaptureAcademicContext).not.toHaveBeenCalled();
      expect(updatedPayloads).toEqual([{ title: "عنوان جديد" }]);
    });

    it("calls captureAcademicContext when academicYearId or academicTermId is explicitly patched", async () => {
      const captured = {
        yearId: 20,
        yearLabel: "١٤٤٩–١٤٥٠ هـ",
        yearStartsOn: "2027-08-20",
        yearEndsOn: "2028-06-20",
        termId: 40,
        termLabel: "الفصل الثاني",
        termStartsOn: "2028-01-01",
        termEndsOn: "2028-06-20",
      };
      mockCaptureAcademicContext.mockResolvedValueOnce(captured);
      const { updatedPayloads } = buildWorkWriteMocks({
        id: 101,
        ownerType: "personal",
        ownerUserId: 1,
        ownerOrganizationId: null,
        status: "draft",
        title: "تقرير",
        academicYearId: 12,
        academicTermId: 34,
        academicContext: null,
      });

      await updateWorkItemForUser(1, 101, { academicYearId: 20, academicTermId: 40 });
      expect(mockCaptureAcademicContext).toHaveBeenCalledWith(expect.anything(), "personal:1", 20, 40);
      expect(updatedPayloads).toEqual([{
        academicYearId: 20,
        academicTermId: 40,
        academicContext: captured,
      }]);
    });

    it("rejects updates on archived works", async () => {
      const { updatedPayloads } = buildWorkWriteMocks({
        id: 102,
        ownerType: "personal",
        ownerUserId: 1,
        ownerOrganizationId: null,
        status: "archived",
        title: "عمل مؤرشف",
        academicYearId: null,
        academicTermId: null,
        academicContext: null,
      });

      await expect(updateWorkItemForUser(1, 102, { title: "محاولة تعديل" })).rejects.toBeInstanceOf(WorkVersionConflictError);
      expect(updatedPayloads).toHaveLength(0);
    });
  });
});
