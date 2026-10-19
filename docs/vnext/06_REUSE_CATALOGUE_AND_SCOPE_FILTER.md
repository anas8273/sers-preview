# SERS vNext — كتالوج إعادة الاستخدام ومرشح النطاق

**الغرض:** منع ضياع العمل السابق ومنع إدخال كل ما وُجد في المشروع إلى النواة بلا تصنيف.

---

## 1. قاعدة القرار

كل أصل أو فكرة أو ملف أو مكون يصنف إلى أحد المصائر التالية:

| الرمز | المصير |
|---|---|
| `KEEP` | يستخدم كما هو مع صيانة بسيطة |
| `HARDEN` | أساس صحيح لكنه يحتاج أمنًا/اختبارات/تشغيلًا |
| `ADAPT` | يعاد ربطه بالنواة الجديدة |
| `PORT` | ينقل انتقائيًا من المستودع التاريخي بعد مراجعة |
| `MODULE` | يبنى لاحقًا كوحدة فوق المحركات المشتركة |
| `CONTENT` | يتحول إلى قالب/Schema/منتج في المكتبة |
| `ARCHIVE` | يحفظ للتاريخ ولا يقود التنفيذ |
| `REJECT` | لا يدخل النطاق الحالي |
| `VERIFY` | لا يعتمد قبل تحقق المصدر أو الحقوق أو السلوك |

---

# 2. الأصول البحثية والتصميمية

| الأصل | القرار | الاستفادة | الشرط/الخطر |
|---|---|---|---|
| `SERS_Audio_First_Requirements_Audit_v3.0.md` | KEEP | ترتيب المصادر وحدود المنتج و56 تسجيلًا | التفريغ دلالي لا حرفي؛ لا ينسب كل صوت للمستخدم |
| `SERS_PreDesign_Deep_Competitive_Analysis_v1.0.md` | KEEP + UPDATE | تموضع، منافسون، أسعار تاريخية، patterns | كل claim متغير يحتاج تاريخ تحقق جديد |
| `SERS_PreDesign_Gate_Closure_v2.0.md` | ARCHIVE + REUSE DECISIONS | الملكية والإصدارات والAI والدفع و32 شاشة | P0 القديم أوسع/أضيق من الأولوية الحالية في مواضع |
| `SERS_Wave1_JTBD_UserFlows_Wireframes_v1.0.md` | ADAPT | JTBD، قاموس المصطلحات، flows، حالات الهاتف | تحديثه لبدء الأداء الوظيفي/Smart Evidence |
| `SERS_Wave1_Completion_Wave2_Spec_v2.0.md` | ADAPT | إعادة الاستخدام، المتجر، التوافق، الدفع، المخرجات | المتجر لا يسبق Evidence MVP |
| `SERS_Wave1_LowFi_Prototype_v1.0.html` | ARCHIVE/REFERENCE | نموذج النواة الفردية | ليس Design System ولا قبول مستخدمين |
| `sers-wave1-wave2-qa-prototype.html` | KEEP AS TEST FIXTURE | 32 شاشة وحالات قابلة للنقر | يحتاج Browser QA وتحديث الرحلة |
| `SERS_LowFi_Expert_QA_Usability_Test_Kit_v2.1.md` | KEEP + ADAPT | مهام واختبارات ومقاييس وخطورة | يجب تنفيذ الاختبار فعليًا؛ يضاف الأداء/التقويم |
| `SERS_Engineering_Blueprint_v1.docx` | ARCHIVE + PORT PRINCIPLES | SDLC، المخرجات، الأمن، بوابات الانتقال | بعض الـstack المقترح لا يطابق التنفيذ الحالي |
| `SERS_Integrated_Audit_2026-10-06.md` | KEEP | حالة الكود، الأمن، UX، gaps | لقطة زمنية؛ يحتاج تحديث بعد الدمج |
| `SERS_Evidence_Reconciliation_and_Competitors_2026-10-07.md` | KEEP | مهام A، المنافسون، الشواهد | كبير ويحتاج index وربط بالـIssues |
| `SERS_First_Journey_Design_2026-10-08.md` | KEEP + EXECUTE | أول Vertical Slice | لا يساوي اكتمال باقي المنصة |
| `SERS_Requirements_Coverage_2026-10-08.md` | KEEP + MERGE | تتبع R/P0/DELTA/F | يُحدّث من PR13 بدل إنشاء سجل متوازٍ |

---

# 3. المستودعات والكود

## 3.1 `anas8273/sers-preview`

**القرار:** `CANONICAL + KEEP/HARDEN`

### نحتفظ به

- React/Vite UI.
- Node/Express/tRPC server.
- Drizzle/MySQL.
- Organization/Membership seed.
- Work/Asset/WorkAssetLink.
- WorkVersion.
- Review/Output foundations.
- Outcome-first IA.
- Existing WorkHub/Evidence views.
- CI foundations.

### نصلحه قبل التوسع

- Authorization لكل القنوات.
- State machines.
- ReportCenter server persistence.
- Secure upload.
- Export/Image Proxy/AI hardening.
- Membership/Assignment lifecycle.
- Academic Year/Official Registry.
- Observability/backup/DR.

## 3.2 `anas8273/SERS`

**القرار:** `ARCHIVE + SELECTIVE PORT`

### قد ينفع

- بعض CRUD والخدمات والقوالب.
- أفكار المحرر والتصدير والتجارة.
- مكتبات المحتوى والحقول.
- بعض التقارير والـi18n strings.

### لا ينقل مباشرة

- Stack كامل.
- جداول أو Controllers متضخمة.
- AI Controller أحادي كبير.
- منطق Marketplace بوصفه مركز المنتج.
- أي اعتماد على Firestore كمصدر حقيقة موازٍ.
- حسابات Demo أو أسرار.

### عملية النقل

1. تحديد حاجة من backlog الحالية.
2. مراجعة الكود والرخصة والأمن.
3. نقل أصغر جزء ممكن خلف Interface.
4. اختبارات مقارنة.
5. توثيق المصدر والقرار في ADR/PR.

---

# 4. النواة الحالية — قرار كل مكون

| المكون | القرار | الملاحظات |
|---|---|---|
| User/Auth | HARDEN | Person/Membership/Assignment منفصلة، session revocation |
| Organization/Membership | ADAPT | يحتاج lifecycle وtenant policies |
| Work | KEEP + EXTEND | content blocks، type contracts، states |
| Asset/Evidence | KEEP + REBUILD AGGREGATE | provenance، privacy، media، quality، links |
| WorkAssetLink | KEEP | يضاف purpose/criterion/version/usage metadata |
| WorkVersion | HARDEN | snapshot كامل وimmutable/hash |
| Review | HARDEN | command transitions وتفويض لحظي |
| Output | HARDEN | bytes/storage/hash/version/revoke/expiry |
| ReportCenter | ADAPT | workId + server source of truth |
| EvidenceLibrary | EXTEND | upload، Used-in، duplicate، quality/privacy |
| Templates/Themes | ADAPT | versioning/compatibility/licensing |
| Marketplace | MODULE | وحدة تجارية بعد ثبات الرحلة الأساسية |
| Payments | VERIFY/BUILD | مزود وسندات/idempotency/webhooks/refunds |
| AI | REBUILD AS GATEWAY | actions contextual، governance، evals |
| Notifications | MODULE | actionable + dedupe + outbox |
| Search | DERIVED | tenant-filtered index قابل لإعادة البناء |
| Audit | HARDEN | append-only للأحداث الحساسة وتغطية reads |

---

# 5. الأصول المعرفية من أعمال المستخدم المدرسية

## 5.1 تحول إلى `CONTENT`

- هياكل التقارير المدرسية.
- قوالب المبادرات والبرامج والورش.
- قوالب الأداء الوظيفي بحسب الدور.
- هياكل الخطط التشغيلية والتحسينية.
- سجلات التوجيه والنشاط والصحة والمختبر.
- نماذج الحضور والمحاضر والاستبانات والشهادات.
- قوالب Word/PDF وحقولها.

### شرط التحويل

- إزالة بيانات العميل.
- التحقق من الحقوق.
- إسناد المصدر.
- تحويله إلى schema/template/version.
- مراجعة اللغة والمتطلبات الرسمية.

## 5.2 يتحول إلى `MODULE`

- الأداء الوظيفي.
- التقويم الذاتي.
- التحسين.
- التشغيل.
- النشاط.
- التوجيه الطلابي.
- الصحة.
- الأمن والسلامة.
- المختبر.
- نواتج التعلم وNAFS.

### قاعدة

الوحدة لا تنشئ Upload/Report/PDF/Task engine جديدًا؛ تستخدم النواة.

## 5.3 يبقى `PROJECT-SPECIFIC`

- أسماء المعلمات والمديرات والمدارس.
- برامج عميلة محددة.
- تواريخ عام/منطقة محددة.
- جداول حصص عميلة.
- أرقام واتساب وقنوات.
- هوية Upgrade/Trend.
- صور وشعارات وملفات لا نملك ترخيصها.

---

# 6. خريطة المسميات إلى Role Packs

| Role Pack | يشمل | محركات مشتركة |
|---|---|---|
| Teacher | معلم عام/مواد | Work/Evidence/Performance/Reports |
| Kindergarten | معلمة رياض أطفال | role criteria + templates، لا تطبيق منفصل |
| School Leader | مدير/وكيل | Reviews/Assignments/Self‑Evaluation/Plans |
| Student Guidance | موجه طلابي | cases/programs/reports/evidence مع privacy أعلى |
| School Health | موجه صحي | programs/emergency/health reports، دون سجل طبي موسع في P0 |
| Student Activity | رائد نشاط | programs/calendar/sessions/evidence/impact |
| Safety | أمن وسلامة | inspections/incidents/plans/evidence |
| Laboratory | محضر مختبر | inventory/safety/programs/reports لاحقًا |
| Learning Resources | مصادر تعلم | programs/resources/reports |
| Administration | مساعد إداري | records/meetings/tasks/reports |
| Special Education | تربية خاصة/صعوبات تعلم | individual plans/worksheets لاحقًا، مع خصوصية عالية |
| Committees | عضو/رئيس لجنة | assignment/task/review/minutes/evidence |

Role Pack يحدد اللغة والمتطلبات والقوالب، ولا يكرر User/Asset/Output.

---

# 7. أنواع الشواهد — Registry أولي

## Media

- Image.
- Video.
- Audio عند الحاجة.
- Scanned document.

## Documents

- PDF.
- Word.
- PowerPoint.
- Spreadsheet.
- Form/export.

## Web

- URL.
- Published page.
- QR target.
- Video link.
- Form link.

## Operational proof

- Attendance.
- Minutes.
- Approval.
- Assignment.
- Certificate.
- Survey response summary.
- Assessment result.
- Impact measure.
- Communication record.

## Supporting material

- Announcement.
- Invitation.
- Plan.
- Checklist.
- Questionnaire template.
- Follow-up card.
- Certificate template.
- Report draft.

كل نوع يحمل `proof_class`:

- `execution_proof`
- `supporting_material`
- `planning_artifact`
- `result_measure`
- `reference`

---

# 8. مرشح إدخال Feature جديدة

قبل قبول أي Feature أو قسم جديد تُطرح الأسئلة:

1. هل هي حاجة حقيقية أم تقليد منافس؟
2. هل تنتمي إلى Core أم Module أم Content؟
3. هل توجد قدرة مشتركة بالفعل؟
4. ما الدور والمشكلة والنتيجة؟
5. ما المصدر الرسمي/التجاري؟
6. ما البيانات الحساسة؟
7. ما حالات الفشل والاسترداد؟
8. ما أثرها على tenant/versions/outputs؟
9. ما الذي سيؤجل مقابلها؟
10. كيف نقيس نجاحها؟

إذا لم توجد إجابات، تدخل Discovery لا Development.

---

# 9. قائمة ما لا يعاد بناؤه

- Upload widget مستقل لكل وحدة.
- PDF generator مستقل لكل دور.
- AI prompt مباشر داخل كل صفحة.
- جدول User جديد لكل مسمى.
- جدول Evidence خاص بكل قسم.
- حالة اعتماد نصية بلا state machine.
- روابط عامة دائمة بلا revoke/expiry.
- نسخة محتوى جديدة عند كل استخدام للشاهد.
- Dashboard منفصلة بالكامل لكل مسمى.
- hard-coded معيار أو سنة أو جهة داخل الواجهة.

---

# 10. قائمة ما يحتاج Proof of Concept

1. Arabic Word/PDF deterministic rendering.
2. secure large media upload/resume/scanning.
3. immutable WorkVersion snapshot.
4. tenant isolation under role changes.
5. evidence reuse with stable outputs.
6. Official Requirements Registry version transition.
7. AI classification + missing evidence detection in Arabic.
8. offline/autosave/conflict recovery.
9. payment → entitlement → apply → rollback.
10. full restore of DB + assets + derived indexes.

---

# 11. أثر الكتالوج على الخطة

## يستخدم الآن

- Work/Asset/Version/Review/Output.
- Journey design and terms.
- Security and failure matrices.
- report/evidence schemas.
- Low‑Fi tasks and QA kit.

## يستخدم بعد Foundation

- performance role packs.
- smart evidence suggestions.
- self‑evaluation registry.
- document templates.

## يستخدم بعد Product‑Market Fit

- marketplace depth.
- department modules.
- advanced school operations.
- native apps.

## لا يستخدم دون قرار جديد

- LMS.
- gradebook.
- parent/student portal.
- advanced timetable engine.
- multivendor marketplace.
- brand/assets of Upgrade.

---

# 12. مقياس نجاح إعادة الاستخدام

لا يقاس النجاح بعدد الملفات القديمة المنقولة، بل بـ:

- نسبة المكونات المفيدة التي أعيد استخدامها دون حمل ديون غير لازمة.
- انخفاض تكرار الكود والبيانات.
- عدد الرحلات التي تستخدم المحركات المشتركة.
- عدم فقد البيانات في migration.
- عدم تغير outputs التاريخية.
- قدرة إضافة Role Pack أو Module بلا fork للنواة.
- traceability من المتطلب إلى الكود والاختبار.
