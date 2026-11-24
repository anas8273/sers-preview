# SERS — نقطة الاستئناف (RESUME)

**آخر تحديث:** 2026-11-24 22:00 (UTC)  
**المنسّق:** Antigravity (قائد الهندسة والتكامل) + وكلاء فرعيون حقيقيون بأدوار محددة.

> هذا الملف هو مصدر الحقيقة الوحيد للاستئناف. اقرأه أولًا، ثم افحص `git status` و`git log` في نسخة العمل قبل أي تعديل.

---

## 1. المستودع ونسخة العمل

| البند | القيمة |
|---|---|
| المستودع | `anas8273/sers-preview` (origin) |
| المجلد الرئيسي | `C:\Users\ANAS\Desktop\مشروع التخرج\sers-preview` — **`origin/main` = `6a9954d443c3eb482d0291d0d3de9d4058470adc` (دمج PR #43 الموحد، 6/6 CI)** |
| **فرع العمل الحالي** | `chore/sync-audit-2026-11-24` (متفرع من `origin/main` `6a9954d`؛ اكتملت عليه حزم M1 وM2 وM3 وM4 دون أي `git push` وببقاء `main` المحلي و`SERS_*` و`.env` دون مساس) |
| حالة `.worktrees/` | أُزيلت مجلدات العمل المؤقتة `.worktrees/reconcile` و`.worktrees/pr40-ref` بعد حفظ `RESUME.md` في `85dd741` |
| حالة `TODO.md` / `todo.md` | حُلّ تعارض حالة الأحرف على NTFS بحذف `todo.md` من فهرس Git واستعادة `TODO.md` في `9c04e99` |
| تنظيف الجذر | أُرشف 44 ملف ملاحظات جذرية قديمة إلى `docs/archive/legacy-root-notes/` وأُزيل `package-lock.json` غير المستخدم في `47baf5e` |
| المستودع التاريخي | `مشروع التخرج\SERS` (`anas8273/SERS`) — لم يُلمس |

### سلسلة commits المرفوعة إلى GitHub ([PR #43](https://github.com/anas8273/sers-preview/pull/43))
| SHA | الوصف |
|---|---|
| `70ee7d6` | رأس PR #41 (أساس المصالحة، 6/6 CI على GitHub بتاريخ 22 نوفمبر) |
| `f58555a` | **M1**: مصالحة هوية/خطوط PR #40 فوق schema v2 في PR #41 + إصلاحات الواجهة والوصول + وثائق التتبع |
| `aa915cb` | **M3 الدفعة A**: تبديل القوالب غير التدميري مع سجل التراجع (R12) + تتبع استخدام الشواهد `Used-in` والحذف الآمن (R04) |
| `e8fadd1` | **M3 الدفعة B**: ملف الإنجاز المرجعي (R08) + استعادة نسخة كمسودة قابلة للتعديل (R21) + استيراد المسودات القديمة (J08) |
| `5398e3d` | **M4 + M5**: تجريد `reportIdentity` من AI (R20) + سجل المعايير المؤرخ (R14) + متجر الصلاحيات التجريبي المعزول (R13) + إغلاق ملاحظات المراجعة المستقلة Role 9 |

**ملاحظة تعارض الحالة السابق:** تم حل تعارض `TODO.md` و`todo.md` نهائيًا في `9c04e99` على `chore/sync-audit-2026-11-24`.

---

## 2. الهدف والقيود والتفويض الساري

- الهدف: تكليف 24 نوفمبر 2026 (المراجعة والتطوير الشامل لسيرس) + موجه Teamwork المعتمد.
- **ممنوع دون موافقة صريحة:** `push`، دمج PR، نشر، تعديل `main` أو `SERS`، إنفاق/دفع حقيقي، إرسال بيانات خاصة لمزود جديد.
- **ممنوع توسيع النطاق** إلى LMS/دفاتر درجات/بوابات طالب وولي أمر/تطبيقات أصلية.
- مراجع المتطلبات: `REQUIREMENT_IMPLEMENTATION_MATRIX.md`، `READ_COVERAGE.md`، `SERS_Handoff_2026-11-23/REQUIREMENTS_STATUS.json`، `docs/vnext/03_DECISION_REGISTER.md`.
- قرارات منتج مفتوحة (لا تُحسم آليًا): `O001` مزود الدفع، `O002` تعدد المراجعين، `O003` نقل الموظف، `O008` المشاركة العامة للعمل الشخصي غير المراجَع، `O009` الإطار الرسمي للتقويم.

---

## 3. المراحل والحالة

| المرحلة | الحالة | الدليل |
|---|---|---|
| المسح (المستودع/المتطلبات/المنافسون) | **مكتمل** | `docs/agent-work/COMPETITOR_AND_PRODUCT_RESEARCH.md`، `READ_COVERAGE.md`، `REQUIREMENT_IMPLEMENTATION_MATRIX.md` |
| التصميم + بوابة المراجعة الداخلية (11 تعديلًا) | **مكتمل** | `docs/agent-work/TEST_INFRA.md` + سجل المنسق |
| **M1** مصالحة PR #40 فوق PR #41 + إصلاحات الواجهة | **مكتمل ومثبت بـ commit `f58555a`** | انظر §4 |
| M2 التهيئة الفردية والملكية + المعالجة الأمنية والوظيفية | **مكتمل ضمن حدود M2 على `chore/sync-audit-2026-11-24`**: تعبئة هوية التقرير من بيانات الحساب/المدرسة (`WorkReportEditor`)، ربط السنة/الفصل بعد الإنشاء (`WorkDetail`)، عرض الهوية المؤسسية في `PublicOutput`، ربط المعايير في `EvidenceLibrary` وحالة المتجر في `Store`، تعقيم الروابط والصور (`safe-url.ts`)، إصلاح انهيار `SharedTemplate` (`require`), وتصلب `routers.ts`/`db.ts`/`http-security.ts` | `server/m2-security-remediation.test.ts` + اختبارات الوحدة والمتصفح |
| M3 نواة Work Graph | **مكتمل ومختبر (الدفعتان A + B)**: R12 + R04 + R08 + R21 + J08 | `server/template-switch.test.ts`، `server/asset-usage.test.ts`، `server/m3-batch-b.test.ts`، `server/portfolio-version-guard.test.ts`، `tests/browser/report-editor.mts` (13/13) |
| M4 المعايير/التقويم الذاتي/المتجر التجريبي/AI + جولة المراجعة والتطوير 2026-11-24 | **مكتمل على `chore/sync-audit-2026-11-24`**: إغلاق ملاحظات `M2 Challenger` (`AdminDashboard` `safeImageSrc`، `EvidenceLibrary` `safeExternalHttpUrl`، حماية `sanitizeCriteriaDataForShareView` من `__proto__`، توحيد خطأ `share.view`) + **M3** بحث المنافسين العميق الموحد (`COMPETITOR_BENCHMARK_AND_MATRIX_2026-11-24.md`) + **M4 التحسينات غير المتعارضة**: الصياغة العربية المذكّرة/المؤنثة وتعبئة الهوية (`IMP-1`: `shared/arabic-grammar.ts`, `userStore.ts`, `AccountHub.tsx`, `WorkReportEditor.tsx`)، فحص جاهزية الشواهد قبل التقديم (`IMP-2`: `shared/evidence-readiness.ts`, `WorkDetail.tsx`)، وبطاقة QR A4 للطباعة (`IMP-3`: `PrintQrCardDialog.tsx`, `ReportShareActions.tsx`, `PublicOutput.tsx`). التقويم الذاتي الكامل مؤجل لترحيل `Migration 0024` بعد اعتماد `O009`. | `server/m2-security-remediation.test.ts`، `server/m4-improvements.test.ts`، `server/public-output-ui.test.ts`، `server/m4-contracts.test.ts` (5/5) |
| M5 المراجعة المستقلة النهائية | **PASS (Role 9)** على PR #43 + التحقق المحلي الكامل على `chore/sync-audit-2026-11-24` بعد آخر تعديل | `pnpm check` + `pnpm build` + drizzle drift check + Vitest + `tests/browser/public-output.mts` |

---

## 4. نتائج الفحوص المرتبطة بالنسخة

**النسخة المختبرة:** شجرة `f58555a` (قبل الـ commit مباشرة، نفس المحتوى). **البيئة:** Windows، Node `v24.14.1` (المطلوب `>=22.12 <23` — انحراف معروف)، pnpm `10.34.9`، Chromium من Puppeteer `157.0.8103.78`.

| الأمر | النتيجة |
|---|---|
| `pnpm run check` (tsc) | ✅ 0 أخطاء |
| `pnpm run build` (vite + esbuild) | ✅ نجح؛ الخطوط والشعار مضمّنة |
| `vitest run` (مع استثناءات CI الأربعة) | 955 ناجح / 157 متخطى (اختبارات تكامل MySQL تتطلب `SERS_INTEGRATION=1`) / 44 فاشل **في التشغيل الأول** |
| تصنيف الـ 44 فاشلًا | 2 ملفان انحدار حقيقي بسبب M1 (`report-lifecycle-repairs`، `review-output-safety`) **← أُصلحا وأُعيد تشغيلهما ✅**. الباقي قيود بيئة Windows/sandbox: `private-filesystem-*` و`runtime-health` (تتطلب POSIX `chmod 0700`/symlink)، `pdf-renderer` (تتطلب Poppler `pdfinfo`)، `build-toolchain` (`spawnSync pnpm` على Windows)، و`http-*` (منع loopback داخل sandbox — **نجحت 18/18 خارج sandbox**) |
| `tests/browser/public-output.mts` | ✅ 9/9 (على `f58555a`) |
| `tests/browser/report-editor.mts` (schema v2 + 320/360/390 + فردي + R12 تبديل/تراجع + R04 حذف آمن) | ✅ **13/13** (على M3 الدفعة A) |
| اختبارات الوحدة المستهدفة لـ M3-A (`template-switch`، `asset-usage`، `reconcile-m1-contracts`، `review-output-safety`، `report-integrity`) | ✅ **37/37** (5 ملفات) |
| `scripts/verify-report-identity.ts`، `verify-report-numerals.ts`، `verify-work-version-outputs.ts` | ⛔ **لم تُشغَّل محليًا** — تتطلب Poppler (`pdftotext/pdffonts/pdftoppm`). تُشغَّل في CI (Ubuntu) |

**ما لم يُختبر ولماذا:** MySQL integration، ClamAV/qpdf، LibreOffice، النسخ والاستعادة، OAuth/HTTPS حقيقي، Microsoft Word الفعلي، الطباعة، مسح QR بكاميرا، قارئ شاشة — غير متاحة في هذه البيئة.

---

## 5. الجاهزية (مقيدة بالدليل)

| النطاق | الحكم |
|---|---|
| جاهزية التطوير | ✅ للنسخة `f58555a` محليًا: تبني وتجتاز فحص الأنواع والاختبارات المنطقية واختبارات المتصفح |
| القبول الوظيفي | ✅ **6/6 CI ناجح على GitHub ([PR #43](https://github.com/anas8273/sers-preview/pull/43) عند `5398e3d`)** شاملة تكامل MySQL 8.4 + ClamAV + qpdf + Poppler + Docker `compose-backup-restore` + `candidate-portability` |
| جاهزية الإنتاج | ⚠️ تم دمج PR #43 بالفعل في `main` (`6a9954d`) واجتاز 6/6 CI؛ تتبقى معالجة النشر الخارجي (HTTPS/OAuth حقيقي)، حسم القرارات المفتوحة (`O001, O002, O003, O008, O009`)، وUAT البشري (Word/طباعة/QR فعلي) |

---

## 6. الخطوة التالية المحددة

1. ~~إكمال M3 الدفعة A (R12 + R04)~~ ✅ مكتمل ومثبّت محليًا (`aa915cb`).
2. ~~إكمال M3 الدفعة B (R08 + R21 + J08)~~ ✅ مكتمل ومثبّت محليًا (`e8fadd1`).
3. ~~إكمال M4 + المراجعة المستقلة M5 (Role 9)~~ ✅ مكتمل ومثبّت محليًا.
4. ~~موافقة المستخدم على الرفع وفتح PR~~ ✅ تم الرفع وفتح **[PR #43](https://github.com/anas8273/sers-preview/pull/43)** واجتاز **6/6 CI** عند `5398e3d`.
5. ~~دمج PR #43 وإغلاق الطلبات المتجاوزة~~ ✅ دُمج رسميًا في `origin/main` بالالتزام **`6a9954d443c3eb482d0291d0d3de9d4058470adc`** (تلقائيًا شمل التزامات `#41`، وأُغلق `#40` و`#42` مع الإبقاء على فروعها كمرجع تاريخي — **0 طلبات سحب متعارضة مفتوحة الآن**).
6. **جولة المراجعة والتطوير الشاملة (M1–M4 على `chore/sync-audit-2026-11-24`)** ✅ مكتملة ومحفوظة محليًا: مزامنة الفرع، إصلاح `TODO.md`/`.worktrees`، التحقق الأمني والوظيفي ومعالجة ثغرات M2 + استدراكات `M2 Challenger`، بحث المنافسين العميق والمصفوفة الفعلية في `docs/agent-work/COMPETITOR_BENCHMARK_AND_MATRIX_2026-11-24.md`، وتطبيق تحسينات Tier 1 غير المتعارضة (`IMP-1`, `IMP-2`, `IMP-3`) مع اختباراتها.
7. **الخطوة التالية الدقيقة (بانتظار قرار المستخدم)**: مراجعة واعتماد الدفع إلى `origin` عند الرغبة، وحسم قرارات المنتج المفتوحة (`O001`: مزود الدفع والضرائب، `O002`: تعدد المراجعين والتفويض، `O003`: ملكية أعمال الموظف عند الانتقال، `O008`: حدود التوقيع النظامي والمشاركة العامة الفردية، `O009`: نطاق أول دورة تقويم ذاتي رسمية)، وتجهيز بيئة الاستضافة الفعلية بـ HTTPS/OAuth واختبار القبول البشري (Word/طباعة/QR فعلي).

### أوامر الاستئناف
```powershell
git status --short --branch
git log --oneline -n 5
pnpm run check
pnpm exec vitest run --exclude server/performance-evidence.test.ts --exclude server/templates-themes.test.ts --exclude server/copy-templates-barcode.test.ts --exclude server/image-proxy.test.ts
pnpm run build
pnpm exec tsx --test tests/browser/public-output.mts
```

### ملاحظات بيئة
- على Windows الأصلي لا تتوفر أدوات POSIX (`prlimit`, `flock`, `qpdf`, `clamd`, `Poppler`)؛ لذا تعمل فحوص PDF المعتمدة على Poppler والتخزين الخاص في بيئة Linux / Docker / GitHub Actions CI، بينما تعمل فحوص TypeScript والبناء واختبارات الوحدة المعزولة والمتصفح (`public-output.mts`) وتوليد DOCX+QR الذهبي وPDF عبر Chromium محليًا على Windows.
