# مراجعة مستقلة read-only لترابط إصلاحات SERS

## نطاق المراجعة والحكم

راجعت working tree في `/home/ubuntu/sersfix` مقابل `plan.md` و`TODO.md` وخط الاستيراد المحلي `dadb901ce1ebd0134abeffa1b1e32d3277d9a94b`، مع تتبع العقود المتقاطعة HTTP/tRPC، online exam/DB/idempotency، report schema/projection/renderers/frozen evidence، public sharing/audit/privacy، وrouting/Arabic UX/canonical paths.

الـ`HEAD` يساوي خط الاستيراد `dadb901ce1ebd0134abeffa1b1e32d3277d9a94b`، بينما الإصلاحات كلها تغييرات working tree غير ملتزمة. الـSHA الأصلي الكامل الموثق في `plan.md` و`PROVENANCE.md` (`e666157a988f10efd6dcae5e808526ae32985945`) غير موجود ككائن Git أو ref في هذه المساحة، لذلك لا يمكن إثبات diff مباشر معه؛ المقارنة الأصلية هنا مبنية على provenance وخط الاستيراد المحلي فقط.

**الحكم:** الإصلاحات تحسن الحدود والقبول والتدقيق، لكنها ليست مترابطة بالكامل ولا تحقق إغلاق TODO/plan. توجد blockers مؤكدة في parity العام للتقرير، enforce للتجميد، route manifest، وتصنيف مسارات HTTP ذات trailing slash. كما أن stale UX والعقد القديم لقائمة تسليمات الاختبار غير مكتملين. لا يعني هذا التقرير صلاحية إنتاج.

## الأدلة التي شُغّلت

- `pnpm check` — **passed** في الحالة الحالية.
- الاختبارات المستهدفة المتقاطعة: `pnpm exec vitest run server/_core/http-body-admission.test.ts server/online-exam-admission.test.ts server/online-exam.test.ts server/report-integrity.test.ts server/work-version-report-renderer.test.ts server/work-version-docx-renderer.test.ts server/work-version-cross-output.test.ts server/output-sharing-contract.test.ts server/output-creation-password.test.ts server/public-output-router-safety.test.ts server/arabic-ux.test.ts server/report-center-validation.test.ts --reporter=verbose` — **12 files / 71 tests passed**.
- `pnpm exec drizzle-kit check --config drizzle.config.ts` — **passed**.
- `pnpm exec drizzle-kit generate --config drizzle.config.ts` — **passed**، وقال `No schema changes`; لم تُطبق migration.
- لم تُشغّل suite كاملة أو browser أو dev server أو MySQL/managed DB، ولم يحدث commit/push/reset/clean.
- نجاح الاختبارات المصدرية لا يثبت parity فعليًا في public output أو تشغيل proxy/TLS/HTTP2 أو UAT/Word/طباعة حقيقية.

## المشكلات المؤكدة

### 1. إسقاط public share لا يستخدم projection/schema المشترك

**الملفات/الأسطر:** `server/public-output-service.ts:27-112`، خصوصًا `FIELD_DEFINITIONS` في 48-56 وقراءة القيم النصية فقط في 74-81؛ مقابل `shared/report-projection.ts:243-250` وrendererين اللذين يستخدمان `projectReportDocument`.

**الأثر:** الـPDF وDOCX والمعاينة الجديدة يمكن أن تعرض حقولًا typed وقالبًا مثل `workshopDate`, `participantsCount`, `materials`، لكن public resolver يعرض فقط سبعة حقول نصية قديمة. في snapshot تقرير ورشة صحيح، ستنجح النسخة الثابتة والـWord/PDF بينما يسقط public share حقولًا معتمدة دون خطأ. هذا يكسر عقد «تقرير واحد» وparity، وقد يخفي محتوى وافق عليه المراجع.

**الإصلاح المقترح:** اجعل public projection يمر عبر عقد versioned مشترك ومسموح الحقول، ثم أسقط فقط metadata الحساسة/الأصول الخاصة في طبقة public serialization. أضف اختبارًا فعليًا يمرر template typed إلى `resolvePublicOutput` ويقارن المفاتيح/القيم الآمنة مع projection المستخدم في HTML/DOCX، لا اختبار source-string فقط.

### 2. renderers يقبلان preview غير مجمد عند غياب frozen preview

**الملفات/الأسطر:** `server/work-version-report-renderer.ts:66-70` و`server/work-version-docx-renderer.ts:103-108` يستخدمان `asset.frozen?.preview ?? asset.preview`. كما أن `server/work-version-docx-renderer.test.ts:7-9,61-72` و`tests/fixtures/work-version-golden.ts:44-48` تثبت أن اختبارات القبول الحالية تمرر previews بلا هوية frozen.

**الأثر:** snapshot مختار يمكن أن يُخرج صورة من `asset.preview` من دون `referenceVersion`/digest/bytes/contentType المرتبطة بمصدر ready مفحوص. هذا لا يثبت تغيير المصدر في كل حالة، لكنه يسمح للعقد نفسه بقبول شاهد غير مجمد، خلاف TODO/plan الذي يشترط أن تكون المعاينة/render من تمثيل frozen وأن يمنع الفشل omission صامتًا. الاختبارات الحالية تثبت sanitation فقط، لا provenance للتجميد.

**الإصلاح المقترح:** في مسار WorkVersion الجديد لا تستخدم fallback إلى `asset.preview` للصور المختارة؛ ارفض الصورة المختارة إذا غاب `frozen.preview` الصحيح، أو نفّذ migration/compatibility منفصلة تتحقق من provenance قبل تحويل legacy preview إلى frozen. أضف اختبارًا يثبت أن selected image بلا frozen تفشل، وأن image غير المختارة لا تُقرأ.

### 3. route manifest المطلوب مفقود، والمسارات المصدرية غير قابلة للتحقق منه

**الملف/الأسطر:** `public/manus-routes.json` غير موجود. المسارات الحالية في `client/src/App.tsx:56-87` تشمل `/output/:token`, `/`, `/work/:id/report`, `/work/:id`, `/work`, `/evidence`, `/reviews`, `/notifications`, `/account`, الأدوات القديمة، `/share/:token`, `/portfolio`, `/reports`, `/reports/legacy`, `/exams`, `/exam/:token`, `/audit-log` وغيرها.

**الأثر:** قبول webdev لمسار manifest يفشل أو لا يستطيع التحقق من أن المسارات الديناميكية متزامنة مع المصدر. هذا يترك `/reports/legacy` و`/exam/:token` و`/audit-log` وغيرها خارج canonical route declaration، ويخالف بند TODO الخاص بـ`/manus-routes.json`.

**الإصلاح المقترح:** إنشاء `public/manus-routes.json` كاملًا، باستثناء APIs/assets و404-only routes، مع path/title فقط، ثم طلبه على origin والتأكد من HTTP 200 وJSON وليس SPA fallback ومقارنته آليًا بمصدر `App.tsx`. لا يكفي اختبار source-string.

### 4. تصنيف HTTP route-specific لا يغطي trailing slash

**الملف/الأسطر:** `server/_core/index.ts:141-145` يختبر `req.path === "/api/export-pdf"` أو `=== "/api/export-docx"`، بينما التسجيل في 153 وما بعدها يستخدم Express routing الافتراضي غير الصارم. في Express، `/api/export-pdf/` و`/api/export-docx/` قد يطابقان route نفسه، لكن middleware العام سيطبق JSON سقفه 256KB قبل admission/parser الخاص 3MB/16MB.

**الأثر:** طلب تصدير صحيح أكبر من 256KB مع trailing slash سيُعامل بعقد global مختلف قبل المصادقة، وقد يُرفض أو يُستهلك مبكرًا بدل عقد PDF/DOCX المعلن. هذا تناقض HTTP contract لا يظهر في اختبار المسار بلا slash. كما أن chunked admission لا يثبت الحجم قبل استدعاء auth؛ هو يحد القراءة قبل handler، لكنه لا يثبت رفضًا مبكرًا قبل كل كلفة المصادقة.

**الإصلاح المقترح:** وحّد canonical pathname قبل الاستثناء، أو اربط middleware route-specific بمسار route نفسه/بحدود آمنة تشمل slash، وأضف اختبارات فعلية لـ`/api/export-pdf/` و`/api/export-docx/` وchunked غير المصادق مع counters للـauth/parser/handler.

### 5. stale guard قبل export/share غير موجود في الواجهة

**الملفات/الأسطر:** `client/src/pages/WorkReportEditor.tsx:280-315` يضمن expected revision عند إنشاء النسخة، لكن `client/src/components/ReportPdfActions.tsx:52-81` و`client/src/components/ReportShareActions.tsx:54-110` يستعلامان قائمة النسخ فقط ولا يقارنان revision المسودة الحالي بآخر WorkVersion قبل السماح بالإخراج/المشاركة.

**الأثر:** إذا تغيّرت المسودة بعد إنشاء آخر نسخة، يمكن للمستخدم إنشاء/مشاركة/تنزيل النسخة القديمة دون تحذير stale صريح. الناتج يظل immutable وآمنًا من ناحية عدم الكتابة فوق النسخة، لكن شرط TODO/plan «تحذير/منع stale عند مشاركة/تصدير نسخة أقدم من المسودة» غير منفذ، وقد يشارك المعلم محتوى يعرف أنه عدّله لاحقًا دون تنبيه.

**الإصلاح المقترح:** أرجع من endpoint موحد current draft revision مع قائمة النسخ، واحسب stale على الخادم/الواجهة، واعرض تحذيرًا محايدًا قبل export/share مع اختيار صريح: إنشاء نسخة جديدة أو متابعة النسخة القديمة. يجب أن يغطي الاختبار حالة draft revision أكبر من version revision.

### 6. استدعاء responses القديم يقطع النتائج بصمت عند 50 صفًا

**الملف/الأسطر:** `server/db.ts:284-306` يضع `limit` الافتراضي 50، ثم عند غياب `limit/cursor` يعيد `rows.slice(0, limit)` في 303. الراوتر يوثق أن `responses({id})` يحافظ على شكل المصفوفة القديمة، لكن لا يوضح أنه أصبح ناقصًا بعد الصف 50.

**الأثر:** العملاء/المعلمون القدامى الذين يرسلون `{id}` فقط سيحصلون على array صحيحة الشكل لكنها ناقصة دون `nextCursor` أو إشارة. هذا يحافظ على shape لا على semantics، ويخالف مبدأ bounded read إذا لم يكن التغيير معلنًا، وقد يؤدي إلى مراجعة ناقصة لتسليمات الاختبار.

**الإصلاح المقترح:** لا تُسقط الصفوف بصمت: إما أن تجعل الاستدعاء القديم يرفض عند تجاوز حد معلن، أو تقدم cursor/envelope كعقد جديد مع compatibility صريحة، أو توفر paging legacy قابلًا للاكتشاف. أضف integration test بأكثر من 50 صفًا يثبت السلوك المقصود.

### 7. schema descriptors المجمدة يمكن أن تسقط إلى template الحالي بصمت

**الملف/الأسطر:** `shared/report-projection.ts:152-174` يعيد `undefined` عند descriptor مفقود/فارغ/غير صالح، و`199-201` يستخدم `frozenFieldDefinitions(...) ?? template.fields` حتى في schema v2.

**الأثر:** snapshot v2 الذي يحتوي `fieldDefinitions: []` أو descriptors غير صالحة يعاد تفسيره بقالب runtime الحالي بدل رفضه. إذا تغيرت definitions مستقبلًا أو تغير label/type/حدود حقل، يمكن أن يتغير render التاريخي أو يختلف عن schema الذي أنشأ النسخة، خلاف versioned compatibility وعدم الإسقاط الصامت.

**الإصلاح المقترح:** في schema v2 اجعل `fieldDefinitions` mandatory وصالحًا؛ ارفض empty/invalid descriptors. اجعل fallback إلى template الحالي مسموحًا فقط لمسار migration محدد لـschema v1، مع test يثبت رفض v2 المكسور.

### 8. metadata/tests ما زالت تصف `/reports` كـReportCenter بينما runtime يجعله WorkHub

**الملفات/الأسطر:** `client/src/App.tsx:79-80` يجعل `/reports` هو `WorkHub reportsOnly` و`/reports/legacy` هو `ReportCenter`، لكن `server/platform-restructure.test.ts:13,167` ما زال يسمي `/reports` `reports-center`/`ReportCenter`، و`client/src/lib/data.ts:97-104` يحتفظ بوصف مركز التقارير القديم للمسار نفسه.

**الأثر:** canonical route/UX ownership غير موحد: metadata والاختبارات القديمة قد توحي بأن `/reports` يفتح ReportCenter بينما المستخدم يرى مدخل WorkHub الخادمي، وقد تعيد أدوات navigation أو provenance بناء توقع قديم. اختبارات `platform-restructure` الحالية تتحقق من وجود النص `/reports` فقط ولا تثبت component identity.

**الإصلاح المقترح:** حسم canonical contract: إما تحديث data/tests/manifest إلى WorkHub مع تسمية legacy صريحة، أو إبقاء alias/route موثقًا للـReportCenter القديم. أضف اختبار route identity فعليًا بدل `EXPECTED_ROUTES` ثابتة غير مرتبطة بالمصدر.

## blockers وrecommended targeted checks

1. استرجاع/إتاحة commit الأصلي الكامل `e666157a988f10efd6dcae5e808526ae32985945` ثم إعادة `git diff` مباشرًا؛ لا تعتبر provenance النصي بديلًا عن مقارنة commit.
2. إصلاح public projection parity، ثم تشغيل اختبار resolver/integration على snapshot typed (ورشة/زيارة) مع مقارنة output العام وHTML/DOCX، مع التأكد من عدم تسريب `storageKey`, `externalUrl`, token أو password.
3. إضافة اختبار selected legacy/unfrozen image، وفشل frozen metadata mismatch، واختبار حذف/تغيير الأصل بعد إنشاء النسخة مع بقاء preview frozen. اختبار `downloadReadyAssetForUser` الحالي يثبت checksum أثناء القراءة، لكن لم تُثبت طبقة WorkVersion نفسها رفض fallback.
4. إنشاء route manifest والتحقق من origin الفعلي، ثم تشغيل canonical route matrix يشمل 390/1440 عند توفر browser؛ لا يُستنتج responsive أو screen-reader من source tests.
5. تشغيل HTTP harness مع trailing slash، malformed/chunked غير مصادق، `Content-Encoding`, duplicate/invalid Content-Length، وtRPC AI/general paths؛ والتحقق من ترتيب auth/parser/handler في التطبيق الفعلي.
6. تشغيل MySQL 8.4 disposable مع migration 0020 واختبارات nonce concurrency، duplicate null legacy، pagination بأكثر من 50، وrollback عند audit failure. `drizzle-kit check/generate` لا يثبت تطبيق migration على قاعدة.
7. مراجعة `pnpm audit --prod`/CI gate: تقرير الحزمة المقدم يذكر 3 high (extract-zip مرتان وzod غير مباشر) وlow في katex، لذلك production audit gate ما زال حاجبًا. لا تُسمى الاعتماديات مغلقة قبل قرار توافق/استبدال/قبول مخاطر موثق.
8. إنشاء وثيقتي الحزم المفقودتين `docs/phase1/dependencies.md` و`docs/phase1/report-integrity.md` إن كانتا جزءًا من deliverable؛ وجود تقارير HTTP/exam/sharing/UX وحده لا يثبت اكتمال التوثيق.

## بوابات مقصودة ما زالت مفتوحة

OAuth/HTTPS الفعلي، proxy/gateway distributed rate/concurrency وtimeouts، storage/scanner providers الحقيقيون، Word والطباعة وQR على أجهزة فعلية، UAT بأدوار المدرسة، retention/cleanup، RTO/restore، provenance/artifact المنشور، وقرار WF-004/اعتماد تصحيح المقال تبقى خارج إثبات هذه المراجعة. لا يوجد claim production readiness.

## أثر المراجعة

هذه المراجعة read-only. لم تُعدّل الشيفرة أو قاعدة مُدارة أو migration، ولم تُنشئ commit أو push أو reset أو clean أو browser session. الملف الوحيد الذي أُنشئ لهذه المراجعة هو هذا التقرير.
