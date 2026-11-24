# SERS — نقطة الاستئناف (RESUME)

**آخر تحديث:** 2026-11-24 17:58 (+03:00)  
**المنسّق:** Antigravity (قائد الهندسة والتكامل) + وكلاء فرعيون حقيقيون بأدوار محددة.

> هذا الملف هو مصدر الحقيقة الوحيد للاستئناف. اقرأه أولًا، ثم افحص `git status` و`git log` في نسخة العمل قبل أي تعديل.

---

## 1. المستودع ونسخة العمل

| البند | القيمة |
|---|---|
| المستودع | `anas8273/sers-preview` (origin) |
| المجلد الرئيسي (للقراءة فقط) | `C:\Users\ANAS\Desktop\مشروع التخرج\sers-preview` — فرع `main` عند `1777f28` (قديم، لم يُلمس). `origin/main` = `e666157` (PR #39) |
| **نسخة العمل المعزولة** | `sers-preview\.worktrees\reconcile` — فرع `reconcile/pr41-pr40-2026-11-24` |
| مرجع PR #40 (قراءة فقط) | `sers-preview\.worktrees\pr40-ref` — detached `1e8a4e4` |
| المستودع التاريخي | `مشروع التخرج\SERS` (`anas8273/SERS`) — لم يُلمس |
| استثناء محلي | `.worktrees/` مضاف إلى `.git/info/exclude` (لا يظهر في `git status` للمجلد الرئيسي) |

### سلسلة commits المحلية (غير مرفوعة)
| SHA | الوصف |
|---|---|
| `70ee7d6` | رأس PR #41 (أساس المصالحة، 6/6 CI على GitHub بتاريخ 22 نوفمبر) |
| `f58555a` | **M1**: مصالحة هوية/خطوط PR #40 فوق schema v2 في PR #41 + إصلاحات الواجهة والوصول + وثائق التتبع |
| `aa915cb` | **M3 الدفعة A**: تبديل القوالب غير التدميري مع سجل التراجع (R12) + تتبع استخدام الشواهد `Used-in` والحذف الآمن (R04) |
| `e8fadd1` | **M3 الدفعة B**: ملف الإنجاز المرجعي (R08) + استعادة نسخة كمسودة قابلة للتعديل (R21) + استيراد المسودات القديمة (J08) |
| **M4+M5 (هذا الالتزام)** | **M4 + M5**: تجريد `reportIdentity` من AI (R20) + سجل المعايير المؤرخ (R14) + متجر الصلاحيات التجريبي المعزول (R13) + إغلاق ملاحظات المراجعة المستقلة Role 9 |

**تعديلات غير ملتزمة معروفة:** `TODO.md` و`todo.md` — تعارض حالة أحرف موروث في PR #41 (الملفان متتبعان في Git وعلى NTFS يصبحان ملفًا واحدًا). مستثنيان عمدًا من كل commit. **قرار مطلوب لاحقًا:** حذف أحدهما في PR منفصل.

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
| M2 التهيئة الفردية والملكية | **جزئي**: إصلاح `WorkHub` (السنة/الفصل اختياريان) + `updateWorkItemForUser` مدمجان في M1. المتبقي: تعبئة هوية المدرسة من ملف موحد | — |
| M3 نواة Work Graph | **مكتمل ومختبر (الدفعتان A + B)**: R12 + R04 + R08 + R21 + J08 | `server/template-switch.test.ts`، `server/asset-usage.test.ts`، `server/m3-batch-b.test.ts`، `server/portfolio-version-guard.test.ts`، `tests/browser/report-editor.mts` (13/13) |
| M4 المعايير/التقويم الذاتي/المتجر التجريبي/AI | **مكتمل ضمن حدود بدون ترحيل DB**: تجريد `reportIdentity` من AI (`R20`)، سجل المعايير المؤرخ (`R14`)، المتجر التجريبي المعزول (`R13` معطّل في الإنتاج). التقويم الذاتي الكامل مؤجل لترحيل `Migration 0024` بعد اعتماد `O009`. | `server/m4-contracts.test.ts` (5/5) |
| M5 المراجعة المستقلة النهائية | **PASS (Role 9)** — 0 Blockers · 0 Majors · أُغلقت جميع الملاحظات الـ 3 (TOCTOU في `standards-db`، فحص `productId` في idempotency، وتصفية الشواهد في `rollbackTemplate`). | تقرير المراجع المستقل + 48/48 عقود + 22/22 متصفح |

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
| القبول الوظيفي | ⚠️ جزئي — رحلات التقرير/الهوية/المشاركة متحقق منها على fixtures؛ لم تُختبر على MySQL حقيقي في هذه الجولة |
| جاهزية الإنتاج | ❌ غير مثبتة — يلزم CI الست على GitHub (بعد موافقة push)، OAuth/HTTPS، UAT، Word/طباعة/QR فعلي |

---

## 6. الخطوة التالية المحددة

1. ~~إكمال M3 الدفعة A (R12 + R04)~~ ✅ مكتمل ومثبّت محليًا (`aa915cb`).
2. ~~إكمال M3 الدفعة B (R08 + R21 + J08)~~ ✅ مكتمل ومثبّت محليًا (`e8fadd1`).
3. ~~إكمال M4 + المراجعة المستقلة M5 (Role 9)~~ ✅ مكتمل ومثبّت محليًا.
4. **الخطوة التالية الدقيقة (تتطلب موافقتك الصريحة):**
   - الموافقة على `git push` لفرع `reconcile/pr41-pr40-2026-11-24` وفتح PR واحد نحو `main` لتشغيل وظائف CI الست على GitHub (Ubuntu + MySQL + Poppler + Docker overlay2).

### أوامر الاستئناف
```powershell
git -C .worktrees/reconcile status --short --branch
git -C .worktrees/reconcile log --oneline -n 5
pnpm --dir .worktrees/reconcile run check
pnpm --dir .worktrees/reconcile exec vitest run server/reconcile-m1-contracts.test.ts
# اختبارات المتصفح وloopback تحتاج التشغيل خارج sandbox على Windows:
pnpm --dir .worktrees/reconcile run build
pnpm --dir .worktrees/reconcile exec tsx --test tests/browser/report-editor.mts
```

### ملاحظات بيئة
- `git commit` داخل الـ worktree يتطلب تشغيلًا خارج sandbox (قفل `index.lock` تحت `.git/worktrees`).
- اسم الـ worktree الداخلي في Git ما زال `sers-preview-reconcile` رغم نقل المسار — طبيعي.
