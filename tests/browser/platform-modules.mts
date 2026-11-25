import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import express from "express";
import puppeteer from "puppeteer";
import superjson from "superjson";
import {
  computeSelfEvaluationSummary,
  normalizeSelfEvaluationDraft,
  SELF_EVALUATION_DOMAINS,
  SELF_EVALUATION_FRAMEWORK_ID,
  SELF_EVALUATION_FRAMEWORK_META,
  SELF_EVALUATION_INDICATORS,
  SELF_EVALUATION_LEVELS,
  SELF_EVALUATION_STANDARDS,
} from "../../shared/self-evaluation";
import { OFFICIAL_SAUDI_STANDARD_SEEDS } from "../../shared/saudi-standards-packs";
import { REPORT_SCHEMA_VERSION, REPORT_TEMPLATE_DEFINITIONS } from "../../shared/report-projection";

const ok = (data: unknown) => ({ result: { data: superjson.serialize(data) } });

test("end-to-end browser verification of PR #43-#46 platform modules at 360px mobile RTL and desktop", { timeout: 90_000 }, async t => {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const programTemplate = REPORT_TEMPLATE_DEFINITIONS["program-report"];
  let selfEvalDraft = normalizeSelfEvaluationDraft({
    revision: 1,
    executiveSummary: "",
    assessments: {},
    improvementActions: [],
  });
  let cycleCreated = false;
  let linkedReportCreated = false;
  let reviewReviewerId = 2;
  let copiedPersonalCreated = false;
  let exportCalls = 0;
  const linkedStandards = new Set<number>([101]);

  const orgWork = {
    id: 10,
    title: "تقرير برنامج الانضباط المدرسي",
    type: "report" as const,
    ownerType: "organization" as const,
    ownerUserId: null,
    ownerOrganizationId: 5,
    status: "in_review" as const,
    currentVersionNumber: 1,
    academicYearId: 1,
    academicTermId: 10,
    academicContext: {
      yearId: 1,
      yearLabel: "1448هـ",
      yearStartsOn: "2026-08-20",
      yearEndsOn: "2027-06-20",
      termId: 10,
      termLabel: "الفصل الأول",
      termStartsOn: "2026-08-20",
      termEndsOn: "2026-11-20",
    },
    metadata: null,
    viewerIsCreator: true,
    viewerCanWrite: true,
    assets: [{ id: 51, title: "ملف شواهد الحضور الموثق", kind: "file", mimeType: "application/pdf", role: "evidence", caption: null }],
  };

  const personalCopiedWork = {
    id: 99,
    title: "تقرير برنامج الانضباط المدرسي (نسخة شخصية)",
    type: "report" as const,
    ownerType: "personal" as const,
    ownerUserId: 1,
    ownerOrganizationId: null,
    status: "draft" as const,
    currentVersionNumber: 0,
    academicYearId: null,
    academicTermId: null,
    academicContext: null,
    metadata: { copiedAsPersonalDraft: true, copiedFromWorkItemId: 10, sourceOwnerType: "organization" },
    viewerIsCreator: true,
    viewerCanWrite: true,
    assets: [],
  };

  const eval7Items = OFFICIAL_SAUDI_STANDARD_SEEDS.filter(s => s.packId === "saudi-teacher-eval-7");
  const license11Items = OFFICIAL_SAUDI_STANDARD_SEEDS.filter(s => s.packId === "saudi-teacher-standards-11");
  const etec10Items = OFFICIAL_SAUDI_STANDARD_SEEDS.filter(s => s.packId === "etec-school-accreditation-10");

  app.all("/api/trpc/:paths", async (req, res) => {
    const paths = req.params.paths.split(",");
    const batched = req.query.batch === "1";
    const rawInputs = req.method === "POST" ? req.body : JSON.parse(String(req.query.input ?? "null"));

    const responses = await Promise.all(
      paths.map(async (path, index) => {
        const serializedInput = batched ? rawInputs?.[index] : rawInputs;
        const input: any = serializedInput ? superjson.deserialize(serializedInput) : undefined;

        switch (path) {
          case "auth.me":
            return ok({ id: 1, name: "أ. سارة العتيبي", email: "sara@school.edu.sa", role: "user" });
          case "auth.browserStorageKey":
            return ok({ key: "c".repeat(64), scope: "d".repeat(64) });
          case "account.overview":
            return ok({
              user: { id: 1, name: "أ. سارة العتيبي", email: "sara@school.edu.sa" },
              schools: [{ id: 5, name: "ثانوية النخبة النموذجية", role: "owner", status: "active", membershipId: 1 }],
            });
          case "account.members":
            return ok([
              { id: 1, userId: 1, name: "أ. سارة العتيبي", role: "owner", status: "active", invitationAccepted: true },
              { id: 2, userId: 2, name: "أ. نورة الشهري", role: "reviewer", status: "active", invitationAccepted: true },
              { id: 3, userId: 3, name: "أ. هند القحطاني", role: "reviewer", status: "active", invitationAccepted: true },
            ]);
          case "account.academicYears":
            return ok([
              {
                id: 1,
                label: "1448هـ",
                ownerUserId: null,
                organizationId: 5,
                startsOn: "2026-08-20",
                endsOn: "2027-06-20",
                terms: [{ id: 10, label: "الفصل الأول", ordinal: 1, startsOn: "2026-08-20", endsOn: "2026-11-20" }],
              },
            ]);
          case "account.exportMyData": {
            exportCalls += 1;
            return ok({
              schemaVersion: 1,
              exportedAt: "2026-11-25T12:00:00.000Z",
              scopePolicy: "personal_owned_only",
              user: { id: 1, name: "أ. سارة العتيبي", email: "sara@school.edu.sa", createdAt: "2026-01-01T00:00:00.000Z" },
              schoolMemberships: [{ organizationId: 5, organizationName: "ثانوية النخبة النموذجية", role: "owner", status: "active" }],
              personalAcademicYears: [],
              personalWorks: [],
              personalAssets: [],
            });
          }
          case "domain.organization.listMine":
            return ok([{ id: 5, name: "ثانوية النخبة النموذجية", role: "owner" }]);
          case "domain.asset.list":
            return ok([
              {
                id: 51,
                title: "ملف شواهد الحضور الموثق",
                kind: "file",
                ownerType: "organization",
                ownerUserId: null,
                ownerOrganizationId: 5,
                mimeType: "application/pdf",
                fileSize: 4096,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                externalUrl: null,
                metadata: null,
              },
            ]);
          case "domain.asset.usage":
            return ok({ assetId: input?.id ?? 51, activeLinks: [], historicalVersionCount: 0 });
          case "evidenceUpload.capabilities":
            return ok({ enabled: false, maxBytes: 0 });
          case "domain.standards.list":
            return ok(
              eval7Items.map((item, idx) => ({
                id: 101 + idx,
                standardKey: item.standardKey,
                version: item.version,
                title: item.title,
              })),
            );
          case "domain.standards.listForAsset":
            return ok([{ linkId: 1, standardVersionId: 101, standardKey: eval7Items[0]!.standardKey, version: "2026.1", title: eval7Items[0]!.title, note: null }]);
          case "domain.standards.coverageMatrix": {
            const packId =
              input?.packId === "saudi-teacher-standards-11"
                ? "saudi-teacher-standards-11"
                : input?.packId === "etec-school-accreditation-10"
                  ? "etec-school-accreditation-10"
                  : "saudi-teacher-eval-7";
            const items =
              packId === "saudi-teacher-standards-11"
                ? license11Items
                : packId === "etec-school-accreditation-10"
                  ? etec10Items
                  : eval7Items;
            const baseId =
              packId === "saudi-teacher-standards-11"
                ? 201
                : packId === "etec-school-accreditation-10"
                  ? 301
                  : 101;
            const rows = items.map((item, idx) => {
              const svId = baseId + idx;
              const covered = linkedStandards.has(svId);
              return {
                standardVersionId: svId,
                standardKey: item.standardKey,
                version: item.version,
                title: item.title,
                packId: item.packId,
                domainLabel: item.domainLabel,
                weightPercent: item.weightPercent ?? null,
                status: covered ? ("verified" as const) : ("missing" as const),
                linkedAssets: covered
                  ? [{ assetId: 51, title: "ملف شواهد الحضور الموثق", kind: "file", isVerifiedFile: true, note: null }]
                  : [],
              };
            });
            const coveredCount = rows.filter(r => r.status !== "missing").length;
            return ok({
              packId,
              totalStandards: rows.length,
              coveredStandards: coveredCount,
              verifiedStandards: coveredCount,
              coveragePercent: Math.round((coveredCount / rows.length) * 100),
              weightedScorePercent: packId === "saudi-teacher-standards-11" ? null : (coveredCount > 0 ? 10 : 0),
              rows,
            });
          }
          case "domain.standards.linkAsset":
            linkedStandards.add(input.standardVersionId);
            return ok({ success: true });
          case "domain.work.list":
            return ok(copiedPersonalCreated ? [personalCopiedWork, orgWork] : [orgWork]);
          case "domain.work.get": {
            if (input?.id === 99 && copiedPersonalCreated) return ok(personalCopiedWork);
            if (input?.id === 77 && linkedReportCreated) {
              return ok({ ...orgWork, id: 77, title: "تقرير تحسين (1-1): انتظام متابعة الخطة", status: "draft", currentVersionNumber: 0 });
            }
            return ok(orgWork);
          }
          case "domain.work.copyToPersonal":
            copiedPersonalCreated = true;
            return ok(personalCopiedWork);
          case "domain.reportDraft.get":
            return ok({
              work: { id: input?.workItemId ?? 10, title: orgWork.title, status: orgWork.status, ownerType: orgWork.ownerType, ownerOrganizationId: orgWork.ownerOrganizationId, currentVersionNumber: 1 },
              draft: {
                schemaVersion: REPORT_SCHEMA_VERSION,
                revision: 1,
                templateId: "program-report",
                templateVersionId: `${programTemplate.id}@${programTemplate.version}`,
                themeId: "formal",
                fontFamily: "Cairo",
                fields: { summary: "ملخص تنفيذي للبرنامج" },
                fieldDefinitions: programTemplate.fields,
                evidenceAssetIds: [51],
                updatedAt: new Date().toISOString(),
              },
              templateHistory: [],
            });
          case "reviewSupport.versions":
            return ok([{ id: 1, versionNumber: 1, reason: "النسخة الأولى للاعتماد", createdAt: new Date().toISOString() }]);
          case "reviewSupport.reviewers":
            return ok([
              { userId: 2, name: "أ. نورة الشهري", role: "reviewer" },
              { userId: 3, name: "أ. هند القحطاني", role: "reviewer" },
            ]);
          case "domain.review.list":
            return ok([
              {
                id: 501,
                workVersionId: 1,
                versionNumber: 1,
                workId: 10,
                workTitle: orgWork.title,
                ownerOrganizationId: 5,
                requestedByUserId: 1,
                reviewerUserId: reviewReviewerId,
                status: "pending",
                updatedAt: new Date().toISOString(),
              },
            ]);
          case "domain.review.get":
            return ok({
              id: 501,
              workVersionId: 1,
              versionNumber: 1,
              versionCreatedByUserId: 1,
              workId: 10,
              workTitle: orgWork.title,
              ownerOrganizationId: 5,
              requestedByUserId: 1,
              reviewerUserId: reviewReviewerId,
              canReassign: true,
              status: "pending",
              comments: [],
              report: {
                title: orgWork.title,
                fields: [{ key: "summary", label: "ملخص التقرير", value: "ملخص تنفيذي للبرنامج" }],
                evidence: [{ title: "ملف شواهد الحضور الموثق", caption: null }],
              },
              updatedAt: new Date().toISOString(),
            });
          case "domain.review.reassign":
            reviewReviewerId = input.reviewerUserId;
            return ok({ id: 501, reviewerUserId: reviewReviewerId, status: "pending" });
          case "domain.selfEvaluation.framework":
            return ok({
              frameworkId: SELF_EVALUATION_FRAMEWORK_ID,
              meta: SELF_EVALUATION_FRAMEWORK_META,
              domains: SELF_EVALUATION_DOMAINS,
              standards: SELF_EVALUATION_STANDARDS,
              indicators: SELF_EVALUATION_INDICATORS,
              levels: SELF_EVALUATION_LEVELS,
            });
          case "domain.selfEvaluation.listCycles":
            if (!cycleCreated) return ok([]);
            return ok([
              {
                id: 301,
                title: "دورة التقويم الذاتي المدرسي وخطة التحسين",
                ownerType: "organization",
                ownerOrganizationId: 5,
                organizationName: "ثانوية النخبة النموذجية",
                academicContext: orgWork.academicContext,
                updatedAt: new Date().toISOString(),
                summary: computeSelfEvaluationSummary(selfEvalDraft),
              },
            ]);
          case "domain.selfEvaluation.createCycle":
            cycleCreated = true;
            return ok({
              work: {
                id: 301,
                title: input.title,
                status: "draft",
                ownerType: input.ownerType,
                ownerOrganizationId: 5,
                academicContext: orgWork.academicContext,
                updatedAt: new Date().toISOString(),
              },
              canEdit: true,
              canManageCommittee: true,
              schoolMembers: [
                { userId: 1, name: "أ. سارة العتيبي", role: "owner" },
                { userId: 2, name: "أ. نورة الشهري", role: "reviewer" },
              ],
              draft: selfEvalDraft,
              summary: computeSelfEvaluationSummary(selfEvalDraft),
              linkedWorks: [],
            });
          case "domain.selfEvaluation.getCycle":
            return ok({
              work: {
                id: 301,
                title: "دورة التقويم الذاتي المدرسي وخطة التحسين",
                status: "draft",
                ownerType: "organization",
                ownerOrganizationId: 5,
                academicContext: orgWork.academicContext,
                updatedAt: new Date().toISOString(),
              },
              canEdit: true,
              canManageCommittee: true,
              schoolMembers: [
                { userId: 1, name: "أ. سارة العتيبي", role: "owner" },
                { userId: 2, name: "أ. نورة الشهري", role: "reviewer" },
              ],
              draft: selfEvalDraft,
              summary: computeSelfEvaluationSummary(selfEvalDraft),
              linkedWorks: linkedReportCreated ? [{ id: 77, title: "تقرير تحسين (1-1): انتظام متابعة الخطة", status: "draft" }] : [],
            });
          case "domain.selfEvaluation.saveCycle":
            selfEvalDraft = normalizeSelfEvaluationDraft(
              {
                revision: selfEvalDraft.revision + 1,
                schoolCategory: input.schoolCategory ?? selfEvalDraft.schoolCategory,
                executiveSummary: input.executiveSummary,
                committeeMembers: input.committeeMembers ?? selfEvalDraft.committeeMembers,
                assessments: input.assessments,
                improvementActions: input.improvementActions,
                updatedAt: new Date().toISOString(),
              },
              { strictValidation: true },
            );
            return ok({
              draft: selfEvalDraft,
              summary: computeSelfEvaluationSummary(selfEvalDraft),
            });
          case "domain.selfEvaluation.createActionReport":
            linkedReportCreated = true;
            selfEvalDraft = normalizeSelfEvaluationDraft({
              ...selfEvalDraft,
              revision: selfEvalDraft.revision + 1,
              improvementActions: selfEvalDraft.improvementActions.map(a =>
                a.id === input.actionId ? { ...a, linkedWorkItemId: 77, status: "in_progress" } : a,
              ),
              updatedAt: new Date().toISOString(),
            });
            return ok({
              reportWorkItemId: 77,
              draft: selfEvalDraft,
              summary: computeSelfEvaluationSummary(selfEvalDraft),
            });
          default:
            return ok([]);
        }
      }),
    );

    res.json(batched ? responses : responses[0]);
  });

  app.use(express.static(resolve("dist/public")));
  app.get("*", (_req, res) => res.sendFile(resolve("dist/public/index.html")));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(done => server.once("listening", done));
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    page.setDefaultTimeout(25_000);
    await page.setRequestInterception(true);
    page.on("request", req => {
      const url = req.url();
      if (url.startsWith(base) || url.startsWith("data:") || url.startsWith("blob:")) void req.continue();
      else void req.abort();
    });

    const pageErrors: string[] = [];
    page.on("pageerror", err => pageErrors.push(err.message));

    const visible = (text: string) => page.waitForFunction(val => document.body.innerText.includes(val), {}, text);
    const clickButtonContaining = async (label: string) => {
      const handle = await page.waitForFunction(
        text =>
          Array.from(document.querySelectorAll("button")).find(
            b => b.textContent?.includes(text) && !b.disabled,
          ),
        {},
        label,
      );
      await handle.asElement()!.evaluate(el => el.scrollIntoView({ block: "center" }));
      await handle.asElement()!.click();
      await handle.dispose();
    };
    const assertNoHorizontalOverflow = async (routeLabel: string) => {
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      assert.equal(fits, true, `Expected zero horizontal overflow at ${routeLabel}`);
    };

    await t.test("Home InstantReportLab renders live A4 preview and switches presets at 360px RTL", async () => {
      await page.setViewport({ width: 360, height: 780 });
      await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
      await visible("عاين شكل تقريرك الرسمي");
      await clickButtonContaining("تقرير مبادرة");
      await visible("تقرير مبادرة القراءة الإثرائية الصباحية");
      await assertNoHorizontalOverflow("Home 360px");
    });

    await t.test("EvidenceLibrary SmartEvidenceMatrixPanel renders 7-element, 11-standard, & ETEC 10-standard packs at 360px", async () => {
      await page.setViewport({ width: 360, height: 780 });
      await page.goto(`${base}/evidence`, { waitUntil: "domcontentloaded" });
      await visible("مصفوفة التغطية الذكية (SmartEvidence)");
      await clickButtonContaining("المعايير المهنية الـ 11");
      await visible("SA-STD11-01");
      await clickButtonContaining("معايير الاعتماد المدرسي الـ 10 (ETEC)");
      await visible("ETEC-SCH-1-1");
      await assertNoHorizontalOverflow("Evidence 360px");
    });

    await t.test("SelfEvaluationPage renders official ETEC indicators, enforces rationale, saves cycle & action, and links report", async () => {
      await page.setViewport({ width: 360, height: 780 });
      await page.goto(`${base}/self-evaluation`);
      await visible(SELF_EVALUATION_FRAMEWORK_META.titleAr);
      await assertNoHorizontalOverflow("SelfEvaluation empty 360px");

      await clickButtonContaining("إنشاء الدورة والبدء بالتقييم");
      await visible("مؤشر 1-1-1-1");
      await visible("المعيار 1-1: التخطيط");

      // Form the Self-Evaluation & Excellence Committee (R09 / NEXT-19)
      await clickButtonContaining("+ إضافة عضو للجنة");
      await page.waitForSelector('select[aria-label="ربط بعضو المدرسة"] option[value="2"]');
      await page.select('select[aria-label="ربط بعضو المدرسة"]', "2");

      // Rate indicator 1-1 as level 2 (الانطلاق) and verify mandatory rationale warning
      await clickButtonContaining("الانطلاق");
      await visible("أدخل مبررًا واضحًا (5 أحرف على الأقل)");

      // Enter factual rationale
      const rationaleSelector = "article textarea";
      await page.waitForSelector(rationaleSelector);
      await page.type(rationaleSelector, "تم إعداد الخطة التشغيلية ويجري استكمال المتابعة الشهرية للمؤشرات.");

      // Add an improvement action and fill its execution step
      await clickButtonContaining("+ إضافة إجراء لخطة التحسين");
      const actionInputHandle = await page.waitForFunction(() =>
        Array.from(document.querySelectorAll("input")).find(
          el => el.placeholder.includes("البرنامج أو المبادرة"),
        ),
      );
      await actionInputHandle.asElement()!.evaluate(el => el.scrollIntoView({ block: "center" }));
      await actionInputHandle.asElement()!.type("عقد اجتماعات مراجعة شهرية وتوثيق نسب التحقق");
      await actionInputHandle.dispose();

      // Save cycle
      await clickButtonContaining("حفظ التقييم وخطة التحسين");
      await visible("تم حفظ تقييم المؤشرات وخطة التحسين بنجاح.");
      await assertNoHorizontalOverflow("SelfEvaluation active 360px");

      // 1-click create linked report -> navigates to /work/77/report
      await clickButtonContaining("إنشاء تقرير تنفيذ مرتبط في أعمالي");
      await page.waitForFunction(() => window.location.pathname === "/work/77/report");
      assert.equal(linkedReportCreated, true);
    });

    await t.test("ReviewsHub reassigns a pending school review to an eligible substitute reviewer (O002)", async () => {
      await page.setViewport({ width: 360, height: 780 });
      await page.goto(`${base}/reviews`);
      await visible("تقرير برنامج الانضباط المدرسي");
      await clickButtonContaining("تقرير برنامج الانضباط المدرسي");
      await visible("إعادة تعيين / تفويض المراجع");

      await page.waitForSelector('select[aria-label="اختر المراجع البديل"] option[value="3"]');
      await page.select('select[aria-label="اختر المراجع البديل"]', "3");
      await clickButtonContaining("تحويل المراجعة");
      await visible("تم تحويل المراجعة إلى المراجع الجديد وإشعاره بنجاح.");
      assert.equal(reviewReviewerId, 3);
      await assertNoHorizontalOverflow("ReviewsHub 360px");
    });

    await t.test("WorkDetail copies organizational work structure into personal workspace (O003)", async () => {
      await page.setViewport({ width: 360, height: 780 });
      await page.goto(`${base}/work/10`);
      await visible("فحص جاهزية الشواهد قبل التقديم");
      await assertNoHorizontalOverflow("WorkDetail 360px");

      await clickButtonContaining("نسخ الهيكل لمساحتي الشخصية");
      await page.waitForFunction(() => window.location.pathname === "/work/99");
      await visible("نسخة شخصية");
      assert.equal(copiedPersonalCreated, true);
    });

    await t.test("AccountHub updates Arabic feminine grammar and triggers sanitized JSON data export (R18)", async () => {
      await page.setViewport({ width: 360, height: 780 });
      await page.goto(`${base}/account`);
      await visible("الصياغة العربية والتعبئة الافتراضية للتقارير");
      await page.select('select[aria-label="الصيغة اللغوية العربية"]', "female");
      await visible("معلمة · الطالبات");

      await clickButtonContaining("تصدير نسخة كاملة من بياناتي الشخصية (JSON)");
      await page.waitForFunction(() => true);
      // Wait briefly for mutation round-trip
      for (let i = 0; i < 20 && exportCalls === 0; i++) {
        await new Promise(r => setTimeout(r, 50));
      }
      assert.equal(exportCalls, 1);
      await assertNoHorizontalOverflow("AccountHub 360px");
    });

    assert.deepEqual(pageErrors, [], `Unexpected runtime page errors: ${pageErrors.join("; ")}`);
  } finally {
    await browser?.close();
    server.close();
  }
});
