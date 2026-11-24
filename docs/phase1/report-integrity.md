# سلامة التقرير — Phase 1

## Implemented

- أصبح `shared/report-projection.ts` العقد الوحيد لتطبيع التقرير وإسقاطه. حقول التقرير typed مثل `workshopDate` و`participantsCount` و`materials` تمر الآن عبر `projectReportDocument` في HTML وDOCX وpublic output. الإسقاط العام يعيد `schemaVersion` و`templateLabel` و`key/label/type/value` فقط، ولا يعيد `storageKey` أو URL أو token أو owner metadata.
- توافق schema v1 صريح: يسمح فقط بمسار migration يستخدم تعريفات القالب runtime. أما schema v2 فيتطلب `fieldDefinitions` غير فارغة وصالحة؛ descriptor المفقود أو الفارغ أو غير الصالح يفشل برسالة validation واضحة بدل fallback صامت.
- الصور المختارة في WorkVersion لا تستخدم `asset.preview` الخام. الصور الجديدة تُجمّد مع `referenceVersion`, `digest`, `bytes`, `contentType`, `sourceAssetId`, `sourceUploadIntentId` وPNG preview محدود metadata. projection يتحقق من الهوية والـdigest/bytes/type والـpreview؛ صورة غير موثقة تفشل مغلقًا، بينما الشاهد المختار بلا صورة يبقى label-only عمدًا. تغيير أو حذف الأصل لا يبدل bytes الموجودة في snapshot، ولا يتجاوز ذلك سياسات retention/revoke.
- أضيف stale guard مشترك في `shared/report-stale.ts`. إجراءات PDF/Word والمشاركة تستعلم `domain.reportDraft.get` وتقارن revision رقمية فقط مع `reportRevision` أو `snapshot.reportDraft.revision` إن وفرها عقد النسخ. stale أو غياب دليل revision يحجب الإجراء افتراضيًا، ويطلب اختيارًا صريحًا لمتابعة النسخة القديمة؛ لا يعيد كتابة AcceptedVersion ولا يستخدم timestamp كبديل.
- تم الحفاظ على DOCX native editable وعلى parity بين HTML وDOCX وpublic field projection. لم تُضف قراءة URL أو storage أثناء rendering.

## Tested

- `pnpm exec vitest run server/report-stale.test.ts server/report-integrity.test.ts server/work-version-report-renderer.test.ts server/work-version-docx-renderer.test.ts server/work-version-cross-output.test.ts server/report-pdf-ui.test.ts server/public-output-ui.test.ts --reporter=verbose`
  - **7 files / 39 tests passed**.
  - يشمل typed public parity، رفض schema v2 المكسور، رفض selected raw preview، frozen provenance، label-only، فساد PNG، parity HTML/DOCX، وstale UI assertions.
- `pnpm check`
  - **blocked خارج ملكية هذه الدفعة** بسبب خطأين موجودين في `server/docx-renderer.ts:811` و`server/pdf-renderer.ts:185`: نوع Puppeteer الحالي لا يقبل `networkidle0`/`networkidle2` ضمن `waitUntil`. لم تُعدّل هذه الملفات احترامًا لحدود الملكية.
- لا suite كاملة، لا browser، لا MySQL writes، لا managed DB، لا migration، ولا push/production/main.

## Open / external gates

- عقد `reviewSupport.versions` الحالي لا يعيد `reportRevision` في هذه الدفعة، لذلك guard الواجهة محافظ: يعرض `unknown` ويحجب افتراضيًا حتى متابعة صريحة. يلزم provider/server owner أن يضمّن revision immutable من snapshot في نتيجة النسخ لإغلاق مسار المقارنة الآلي بالكامل؛ لا يجوز استبداله بتاريخ الإنشاء.
- ما زالت بوابات OAuth/HTTPS الفعلي، storage/scanner providers الحقيقيون، retention/cleanup وrevoke تحت التشغيل، Word/printing/QR على أجهزة حقيقية، UAT، proxy/network timeout، RTO/restore، وprovenance المنشور خارج هذا الإثبات.
- أخطاء Puppeteer النوعية أعلاه تحتاج تصحيحًا في مالك renderer العام أو مواءمة types؛ لا ينبغي اعتبار `pnpm check` ناجحًا حتى تُغلق هناك.
- هذه الوثيقة لا تدعي production readiness.

## تحديث التكامل النهائي — 19 نوفمبر 2026

مالك التكامل أضاف `reportRevision` إلى `reviewSupport.versions` باستخراج scalar من JSON المجمد على الخادم دون إرسال snapshot. نجح اختبار MySQL يثبت fresh قبل تعديل المسودة وstale بعده وبقاء revision النسخة القديمة كما هي. أُصلح توافق Puppeteer 25 وأصبح TypeScript والبناء ناجحين. نجحت رحلة المتصفح التي تحفظ آخر تعديل، تثبت النسخة، يراجعها المعلم، تعدّل المسودة بعدها، وتثبت أن أزرار PDF/Word/QR محجوبة حتى اختيار متابعة النسخة القديمة صراحة ثم تنتج المحتوى المعتمد القديم لا المسودة الجديدة. السجل السابق يشير إلى حدود ملكية الحزمة الجزئية لا إلى blocker باقٍ. النتيجة المتكاملة في [RESULTS.md](RESULTS.md).
