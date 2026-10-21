# SERS vNext — بوابة Phase 0 وخطة التنفيذ والـBacklog

**الهدف:** تحويل التدقيق إلى خطوات تنفيذ قابلة للقياس دون خلط البحث بالبرمجة أو دمج فروع حساسة بلا مراجعة.

---

## 1. النتيجة المطلوبة من Phase 0

تُغلق Phase 0 عندما يصبح لدينا:

1. مستودع حاكم واحد.
2. خط أساس متطلبات موحد.
3. حالة مثبتة لكل عمل سابق مهم.
4. قرار واضح لـPR11 وPR12.
5. مصفوفة صلاحيات وحالات انتقال.
6. خطة ترحيل للبيانات والمحررات القديمة.
7. قائمة Blockers قبل أول Pilot.
8. CI موثوق يمنع الانحدار.
9. أول Vertical Slice محدد بعقوده واختباراته.
10. لا ادعاء غير قابل للتتبع عن الجاهزية.

---

# 2. ترتيب التنفيذ الإلزامي

## الخطوة 1 — اعتماد وثائق vNext

- مراجعة `00_MASTER_RECONCILIATION.md`.
- مراجعة `01_REQUIREMENTS_TRACEABILITY.md`.
- اعتماد أو تعديل القرارات المفتوحة.
- منع إنشاء متطلبات جديدة بلا مصدر/مالك/تاريخ.

## الخطوة 2 — مصالحة PR11 وPR12

**الحالة المحدثة 2026-10-21:** اكتملت هذه الخطوة عبر #23/#24 ثم #25، وأُغلق #14. ما يلي يحتفظ بخطة التكامل ومعاييرها التاريخية، وليس أمرًا بإعادة تنفيذها. لا يعني ذلك إغلاق B01–B10. انظر [التسليم المرحلي](07_PHASE_HANDOFF_2026-10-21.md).

### لماذا لا يدمجان مباشرة؟

- كلاهما مبني على `main` نفسه.
- PR11 يضيف بوابة MySQL للنواة.
- PR12 يضيف إصلاحات legacy/upload/MySQL مختلفة.
- PR12 لا يحتوي Commit PR11.
- قد توجد workflows أو افتراضات متداخلة.

### خطة التكامل

1. إنشاء فرع `integration/security-domain-gate` من أحدث `main`.
2. إعادة تأسيس PR12 فوقه أو إدخال commits بعد مراجعة التسلسل.
3. تشغيل CI الكامل.
4. إدخال PR11 أو نقل اختبارات domain integration إليه.
5. إزالة التكرار بين `integration.yml` و`mysql-legacy.yml` دون إسقاط التغطية.
6. تشغيل:
   - typecheck.
   - schema generation.
   - unit/hermetic tests.
   - production build.
   - domain MySQL tests.
   - legacy MySQL tests.
   - repository safety checks.
7. مراجعة مستقلة للـdiff.
8. تحديث PR body بالأعداد وSHA وروابط التشغيل وحدود التغطية.
9. دمج بعد نجاح Gate، لا قبل ذلك.

### معايير القبول

- migration تعمل على DB نظيفة.
- كل test suite ذات صلة تعمل على MySQL 8.4.
- رفض foreign ownership بلا آثار جانبية.
- rollback مثبت بفشل SQL المقصود.
- اختبارات التزامن لا تعتمد على ترتيب منح lock غير مضمون.
- لا تغيير إنتاجي أو migration على بيانات حقيقية.

---

# 3. الـBlocker Backlog

## B01 — توحيد Authorization للمسارات القديمة والجديدة

**الأولوية:** Critical  
**يغطي:** R03/R18، P0-005/019/020/025، F01–F06.

### المطلوب

- Policy/Guard موحد للـlist/get/search/create/update/delete/export/share/link.
- عدم قبول organization/user ownership من client دون تحقق.
- إعادة تفويض لحظة commit.
- تغطية background jobs وpublic routes.
- سحب الصلاحية ينعكس فورًا وفق policy.

### معايير القبول

- حسابان ومدرستان في integration tests.
- كل cross-tenant access يرفض.
- لا صف/ملف/audit success عند الرفض.
- تغيير الدور أثناء العملية يختبر.
- list لا تخفي ثغرة موجودة في get، والعكس.

---

## B02 — State Machines للـWork/Version/Review/Output

**الأولوية:** Critical  
**يغطي:** R10/R21، P0-008/009/011، F04–F08/F17.

### المطلوب

- حالات Work واضحة.
- createVersion بمعاملة وoptimistic locking/idempotency.
- Review decision command منفصل.
- لا update عام إلى approved.
- Output يثبت bytes/hash/template/assets/version.
- revoke/expiry enforced server-side.

### معايير القبول

- v1 approved وv2 draft يعملان معًا.
- خفض دور المراجع يمنع القرار.
- فشل بين خطوات review لا يترك نصف حالة.
- تعديل الأصل لا يغير output سابقًا.

---

## B03 — ربط ReportCenter بالنواة

**الأولوية:** Critical Product  
**يغطي:** R07/R11/R12/R21، P0-003/007/008/009/034.

### المطلوب

- فتح المحرر داخل `workId`.
- حفظ content blocks في الخادم.
- حفظ evidence use metadata.
- حفظ template/version/theme/font.
- autosave وحالة حفظ موحدة.
- snapshot كامل.
- preview وPDF/Word من WorkVersion نفسها.

### معايير القبول

- refresh/device آخر يعيد نفس المحتوى من الخادم.
- فشل الحفظ يحتفظ بالمدخلات ويعرض حالة صادقة.
- تغيير القالب لا يفقد البيانات.
- PDF يطابق النسخة المعروضة.
- تعديل بعد الإصدار لا يغير output القديم.

---

## B04 — Secure Evidence Upload Lifecycle

**الأولوية:** Critical Security/Product  
**يغطي:** R04/R05/R18، P0-004/027/032، F09–F12/F18.

### المطلوب

- upload intent مؤقت.
- server-side limits وcontent checks.
- private/quarantine storage.
- malware/scanning policy.
- metadata/EXIF policy.
- asset metadata + checksum + provenance.
- retry/idempotency.
- durable orphan reconciliation.
- signed/protected delivery.
- quota/rate limits.

### معايير القبول

- الملفات المرفوضة لا تصبح قابلة للتحميل.
- نجاح التخزين وفشل DB يُسجل ويُصالح.
- duplicate detection يعمل بالhash والسياسة.
- video bytes لا تقص صامتًا.
- QR لا يشير لبيانات محلية أو filename.
- unlink لا يحذف الأصل.

---

## B05 — حماية Export / Image Proxy / AI Public Surface

**الأولوية:** Critical Security  
**يغطي:** P0-026/029/032، F12/F13/F19.

### Export

- authenticated job creation.
- resource limits.
- no arbitrary JS/network.
- allowlisted assets أو fetch service آمن.
- queue، timeout، retry، status.
- private storage + signed result.

### Image Proxy

- http/https only.
- DNS/IP checks لكل redirect.
- منع private/link-local/loopback.
- size/time/content limits.
- image decode/re-encode.
- cache policy.

### AI

- authentication.
- quota/rate/cost.
- timeout/circuit breaker.
- structured output validation.
- redaction.
- model/prompt/version telemetry.
- manual fallback.

---

## B06 — Membership / Assignment / Academic Year

**الأولوية:** High Foundation  
**يغطي:** R02/R03/R14/R15/R16، P0-006/019.

### الكيانات

- Person.
- Organization.
- Membership.
- Job Position.
- Assignment.
- Committee/Team Membership.
- Academic Year/Term/Week.
- Authority/Requirement Version.

### حالات الانتقال

- invite/activate/suspend/end.
- temporary assignment start/end.
- role change.
- employee moves school.
- school year close/rollover.
- archival and retention.

### معايير القبول

- حساب فردي يعمل بلا مدرسة.
- التكليفات المتعددة لا تستبدل الوظيفة الأساسية.
- سحب العضوية يمنع الوصول في كل القنوات.
- ملفات السنوات السابقة تبقى على إصدارها.

---

## B07 — Smart Evidence Governance

**الأولوية:** High Product/Trust  
**يغطي:** R06/R20، P0-016/017، DELTA-05، F13.

### المطلوب

- Evidence suggestion taxonomy.
- distinction: supporting material vs real proof.
- provenance and source type.
- confidence.
- proposed/confirmed/reviewed/approved.
- human review.
- no fabricated attendance/results/execution.
- golden evaluation set.
- prompt injection and malformed output tests.

### معايير القبول

- المستخدم يستطيع قبول/تعديل/رفض.
- لا ربط تلقائي منخفض الثقة.
- provider outage لا يمنع العمل اليدوي.
- كل AI output قابل للتتبع إلى model/prompt/version.

---

## B08 — Official Requirements Registry + Self‑Evaluation

**الأولوية:** High بعد Foundation  
**يغطي:** R09/R14/R15، DELTA-03/04.

### المرحلة A — Registry

- authority document.
- source URL/reference.
- version/effective dates.
- role/school applicability.
- criterion/indicator/evidence guidance.
- supersede/archive.

### المرحلة B — Self‑Evaluation

- cycle.
- committee/assignments.
- indicator assessment.
- evidence links.
- rationale.
- review.
- strength/gap.
- improvement initiative.
- follow-up.

### معايير القبول

- لا تتغير نتيجة قديمة عند نشر إصدار جديد.
- لا تحسب الجودة بعدد المرفقات فقط.
- كل تقدير له rationale وشواهد ونسخة إطار.

---

## B09 — Output Quality: RTL / Word / PDF / QR

**الأولوية:** High  
**يغطي:** R11/R19، P0-022/023/034، DELTA-09.

### Golden Documents

- نص عربي طويل.
- جداول RTL.
- صور متعددة.
- أرقام عربية/لاتينية حسب الإعداد.
- هجري/ميلادي.
- فواصل صفحات.
- Header/footer/watermark/signature placeholders.
- Word قابل للتعديل.
- QR قابل للمسح.

### معايير القبول

- deterministic render لنفس النسخة.
- fonts embedded/fallback واضح.
- visual regression.
- فتح Word في بيئات مدعومة.
- لا قص أو صفحة فارغة أو جدول خارج الهامش.

---

## B10 — Operations / DR / Release Governance

**الأولوية:** Critical قبل Pilot  
**يغطي:** R22، P0-028–030/033، F20.

### المطلوب

- branch protection.
- required checks.
- staging منفصلة.
- feature flags.
- structured logs/correlation.
- metrics/alerts.
- queue/provider/storage health.
- backup policy.
- restore drill.
- migration rollback/replay.
- incident runbooks.
- secrets rotation.

### معايير القبول

- استعادة DB والأصول إلى بيئة معزولة.
- قياس RTO/RPO فعلي.
- فشل متعمد يطلق تنبيهًا بلا PII.
- rollback إصدار موثق ومجرب.

---

# 4. ترتيب الـEpics بعد الـBlockers

1. Performance Evidence MVP.
2. Smart Reports.
3. Self‑Evaluation.
4. Improvement Planning.
5. Operational Planning.
6. Portfolio/Achievement view.
7. Marketplace/Entitlements/Payments.
8. Department modules.

لا يعني الترتيب حذف المتجر؛ يعني أن نجاح SERS يقاس أولًا بإغلاق دورة العمل والشاهد والمخرج.

---

# 5. قائمة شاشات أول Vertical Slice

1. Login/Account context.
2. Workspace Home.
3. My Work.
4. Create Work.
5. Work Detail.
6. Report Editor.
7. Evidence Library.
8. Add/Reuse Evidence.
9. Evidence Detail/Quality/Privacy.
10. Template Selector.
11. Preview.
12. Versions.
13. Submit Review.
14. Review Inbox/Decision.
15. Output Center.
16. PDF/Word generation status.
17. Share settings/QR/revoke.
18. Audit/activity.
19. Organization/role context.
20. Error/recovery states.

---

# 6. خطة الاختبار

## Unit

- validators.
- policy functions.
- state machines.
- render mapping.
- AI output schemas.

## Integration — MySQL

- ownership/tenant isolation.
- migrations.
- transactions/rollback.
- concurrency.
- versions/reviews/outputs.
- idempotency.

## Security

- IDOR.
- role escalation.
- SSRF.
- upload spoofing.
- rate limits.
- token/session revocation.
- prompt injection.

## E2E Browser

- first journey happy path.
- offline/save failure.
- role change.
- review decision.
- render/share/revoke.
- mobile/RTL.

## Visual/Document

- golden PDFs.
- Word opening/editing.
- QR scan.
- long Arabic content.

## Operations

- provider outage.
- queue backlog.
- storage failure.
- DB failure.
- restore drill.

---

# 7. Pilot Gate

لا تبدأ بيانات مدرسية حقيقية قبل:

- B01–B05 مغلقة.
- tenant/membership foundation تعمل.
- privacy notice وسياسة الاحتفاظ.
- signed downloads.
- incident owner/runbook.
- backup/restore.
- UAT ببيانات اصطناعية.

Pilot محدود بعد ذلك:

- عدد صغير من المستخدمين.
- Feature Flag.
- بيانات مخففة.
- مراقبة لصيقة.
- قناة بلاغ واضحة.
- rollback فوري.

---

# 8. مقاييس النجاح

## المنتج

- الزمن لأول عمل مفيد.
- الزمن لأول شاهد مؤكد.
- نسبة إكمال ملف الأداء.
- Evidence reuse rate الصحيح.
- عدد الإدخالات المتكررة التي تم توفيرها.
- قبول/تعديل/رفض اقتراحات AI.
- نجاح المهام في اختبار المستخدمين.

## الهندسة

- tenant isolation test pass rate.
- error rate.
- p95 حسب budget.
- queue latency.
- failed render recovery.
- restore RTO/RPO.
- security findings by severity.

## الثقة

- fabricated evidence incidents = 0.
- unauthorized access incidents = 0.
- silent data loss = 0.
- outputs changed after approval = 0.

---

# 9. Definition of Ready لأول Sprint تنفيذي

- PR المصالحة معتمد.
- قرار PR11/12 موثق.
- B01/B02 acceptance criteria مثبتة.
- test data factory جاهزة.
- staging DB معزولة.
- no production secrets/data.
- migration review مكتملة.
- owner لكل task.
- rollback plan.

---

# 10. Definition of Done لكل Sprint

- code reviewed.
- CI green على SHA.
- integration tests على MySQL حيث يلزم.
- security negative tests.
- docs/traceability updated.
- telemetry/audit updated.
- no untracked migration side effects.
- feature flag/rollback.
- residual risks documented.

---

# 11. ممنوعات التنفيذ

- دمج PR11 وPR12 دون فرع تكامل.
- حذف legacy tables/routes قبل reconciliation.
- إطلاق public sharing قبل authorization وprotected delivery.
- إرسال بيانات حساسة إلى AI بلا سياسة.
- اعتبار schema أو route دليل اكتمال رحلة.
- اعتبار اختبار source-string بديلًا لاختبار سلوكي.
- بدء خمسة Modules قبل نجاح Vertical Slice.
- تحويل اقتراح AI إلى شاهد تنفيذ مؤكد.
- تغيير stack أو DB اعتمادًا على ذاكرة أو وثيقة تخرج قديمة.
