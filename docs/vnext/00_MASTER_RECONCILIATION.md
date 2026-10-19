# SERS vNext — المصالحة الشاملة وخط الأساس الحاكم

**الحالة:** مسودة حاكمة للمراجعة قبل التنفيذ الواسع  
**تاريخ التحديث:** 2026-10-19  
**المستودع التنفيذي المعتمد:** `anas8273/sers-preview`  
**الفرع الأساس وقت الفحص:** `main`  
**SHA الأساس:** `2343f757bd1fcd943044ef6c8e085beaf6612460`  
**المستودع التاريخي المرجعي فقط:** `anas8273/SERS`

---

## 1. لماذا أُنشئت هذه الوثيقة؟

شهد مشروع SERS عدة مراحل متداخلة:

1. نموذج قديم واسع للخدمات والقوالب والمتجر والذكاء الاصطناعي.
2. تحليل Gate 0، وتدقيق التسجيلات، ودراسة منافسين، وUser Flows وLow‑Fi.
3. تنفيذ وكلاء على مستودع `sers-preview` أضاف Work Graph وEvidence وVersions وReviews وOutputs.
4. تدقيق هندسي وأمني في أكتوبر كشف فجوات ملكية وصلاحيات وترحيل وربط بين المحررات القديمة والنواة الجديدة.
5. رؤية منتج أحدث تجعل SERS نظام تشغيل ذكيًا للأعمال والتوثيق والتحسين المدرسي، وليس شبكة أدوات أو متجر ملفات فقط.

الغرض من هذه الوثيقة هو منع ثلاثة أخطاء:

- إعادة العمل المنجز من الصفر.
- اعتبار وجود كود أو نجاح CI دليلًا على اكتمال المنتج.
- إضافة خدمات جديدة فوق بنية غير موحّدة قبل إغلاق الصلاحيات والنسخ والترحيل.

---

# 2. قرار المصدر الحاكم

## 2.1 المستودع التنفيذي

المصدر التنفيذي الحالي هو:

> `anas8273/sers-preview`

لأنه يحتوي على:

- React/Vite للواجهة.
- Node/Express/tRPC للخادم.
- Drizzle/MySQL للبيانات.
- النواة المنفذة حديثًا للأعمال والأصول والنسخ والمراجعات والمخرجات.
- فروع الوكلاء وطلبات الدمج من سبتمبر وأكتوبر 2026.
- PR11 وPR12 المفتوحين والمتعلقين بالتكامل والأمان.

## 2.2 المستودع التاريخي

`anas8273/SERS` يبقى مرجعًا للاستفادة من الأفكار أو الأجزاء القابلة للنقل، لكنه ليس المصدر التنفيذي الحاكم لـvNext. لا يُدمج منه كود مباشرة إلا عبر:

1. جرد واعتماد احتياج فعلي.
2. مراجعة أمنية وترخيصية.
3. Adapter أو نقل محدد.
4. اختبارات انحدار.
5. ADR يوضح سبب النقل.

## 2.3 قاعدة فض التعارض

ترتيب مصادر الحقيقة:

1. متطلب مباشر حديث من صاحب المشروع مع تاريخ وسياق.
2. هذه الوثيقة وDecision Register بعد الاعتماد.
3. الكود والاختبارات على الفرع المعتمد.
4. مصدر رسمي ذو إصدار وتاريخ نفاذ.
5. وثائق التدقيق والتصميم المؤرخة.
6. وثيقة مشروع التخرج أو الملخصات التقنية التاريخية.
7. اقتراحات المساعد أو الوكلاء غير المعتمدة.
8. تفريغ صوت آلي غير موثوق أو غير منسوب للمتحدث.

أي تعارض لا يُحسم بصمت؛ يدخل سجل القرارات.

---

# 3. الأدلة والمواد التي تمت مراجعتها

## 3.1 مواد المشروع في المكتبة

تم العثور على حزمة موثقة تشمل على الأقل:

- `SERS_Audio_First_Requirements_Audit_v3.0.md`
- `SERS_PreDesign_Deep_Competitive_Analysis_v1.0.md`
- `SERS_PreDesign_Gate_Closure_v2.0.md`
- `SERS_Wave1_JTBD_UserFlows_Wireframes_v1.0.md`
- `SERS_Wave1_LowFi_Prototype_v1.0.html`
- `SERS_Wave1_Completion_Wave2_Spec_v2.0.md`
- `SERS_LowFi_Expert_QA_Usability_Test_Kit_v2.1.md`
- `sers-wave1-wave2-qa-prototype.html`
- `SERS_Engineering_Blueprint_v1.docx`
- `SERS_Integrated_Audit_2026-10-06.md`
- `SERS_Evidence_Reconciliation_and_Competitors_2026-10-07.md`
- `SERS_First_Journey_Design_2026-10-08.md`
- `SERS_Requirements_Coverage_2026-10-08.md`

تثبت هذه المواد أن التحليل وLow‑Fi والتدقيق لم يبدأا الآن من الصفر.

## 3.2 مواد صوتية

يوجد سجل لمعالجة ملف مجمّع لـ56 تسجيلًا، لكن:

- التفريغ آلي وليس تفريغًا قضائيًا حرفيًا.
- لم تثبت هوية المتحدث في كل مقطع.
- توجد مقاطع ضعيفة الثقة وفجوة زمنية.
- تُستخدم الدلالات الصوتية لتعزيز مصادر أقوى، لا لخلق قرارات جديدة منفردة.

## 3.3 حدود الادعاء

هذه المصالحة لا تدّعي:

- قراءة حرفية لكل محادثات ChatGPT في تاريخ المشروع.
- تجربة مدفوعة داخل كل منافس.
- تحققًا نهائيًا من جميع المعايير الرسمية.
- اختبار استخدام بشري مكتمل.
- جاهزية Production.

كل فجوة مذكورة تبقى ظاهرة ولا تُغطى بعبارة «تمت المراجعة».

---

# 4. حالة GitHub المثبتة

## 4.1 ما تم دمجه في `sers-preview/main`

أعمال الوكلاء المدمجة تضمنت على الأقل:

- IA تبدأ بالنتيجة والعمل بدل شبكة الأدوات.
- Home outcome‑first.
- Domain Core يضم Organization/Membership وWork/Asset/Version/Review/Output وغيرها.
- بوابات CI أساسية.
- Work وEvidence APIs محمية مبدئيًا.
- واجهات أعمالي ومكتبة الشواهد.
- ربط شاهد موجود بعمل دون نسخه.
- WorkVersion ثابتة مبدئيًا.
- Review/Output workflow مرتبط بـWorkVersion.
- واجهات المراجعة والقرار.
- migration للنواة الجديدة.

## 4.2 PR11 المفتوح

**العنوان:** `ci: add real MySQL integration and tenant-isolation gate`  
**الحالة:** Draft، مفتوح، غير مدمج.  
**الرأس:** `9ad9a30ca1323053c0154134ead425b433a2aa14`

الغرض:

- MySQL 8.4 معزولة في Actions.
- تطبيق migrations.
- اختبارات Work/Asset/Version/Review/Output.
- اختبارات IDOR وownership.
- إعادة تشغيل اختبارات DB القديمة.

هو Commit واحد أمام `main`، ولا يتضمن تغييرات PR12.

## 4.3 PR12 المفتوح

**العنوان:** `fix: enforce ownership for legacy portfolio files and shares`  
**الحالة:** Draft، مفتوح، غير مدمج.  
**الرأس وقت هذا الفحص:** `20453cc50829c0be33e4ccabbe11a2d8a86c8ed9`

يشمل:

- فحص ملكية ملفات ومسارات المشاركة القديمة.
- معاملات وأقفال للأب قبل إنشاء/حذف العلاقات.
- MySQL tests للتزامن والـrollback.
- تحقق Base64/MIME/signature/size.
- الاحتفاظ ببايتات الفيديو الأصلية بدل قصها صامتًا.
- حالة فشل رفع قابلة لإعادة المحاولة.
- منع QR من الاعتماد على filename أو local data.
- 56 ملف اختبار / 567 اختبارًا بحسب تشغيل Actions الموثق في وصف PR.
- 12 اختبار MySQL بحسب التشغيل الموثق.

لا يغلق وحده:

- Malware scanning وquarantine وCDR.
- حذف blobs اليتيمة بطريقة موثوقة.
- rate limits والحصص.
- protected download delivery.
- membership transitions.
- fixed-version outputs.
- export/image-proxy hardening.
- Browser E2E وvisual QA.

## 4.4 قرار PR11 وPR12

لا يُدمجان بصورة عمياء؛ الفرعان متباعدان عن نفس `main`.

المطلوب:

1. فرع تكامل جديد.
2. إدخال PR12 أولًا أو إعادة تأسيسه فوق فرع تكامل.
3. إدخال بوابة PR11 بعد إزالة أي workflow مكرر.
4. تشغيل CI الكامل وMySQL suites.
5. مراجعة مستقلة للـdiff.
6. توثيق ما غُطي وما بقي.
7. دمج Squash أو Merge حسب قرار الفريق، مع حفظ الروابط إلى التشغيلات.

---

# 5. تعريف SERS المعتمد

> **SERS هو نظام تشغيل ذكي للأعمال والتوثيق والتحسين المدرسي، يحول العمل اليومي إلى بيانات وشواهد وتقارير وخطط مترابطة وقابلة للقياس وإعادة الاستخدام.**

## ليس SERS

- ليس LMS.
- ليس نظام درجات ومناهج وواجبات.
- ليس متجر تنزيل ملفات فقط.
- ليس Chatbot منفصلًا عن العمل.
- ليس مجموعة خدمات مكررة لكل مسمى وظيفي.
- لا يختلق تنفيذًا أو حضورًا أو نتائج أو توقيعات.

## الوعد الأساسي

> أدخل البيانات أو ارفع الدليل مرة واحدة، ثم استخدمه بصورة صحيحة ومصرح بها في التقرير وملف الأداء والتقويم الذاتي وخطة التحسين والخطة التشغيلية وقياس الأثر.

---

# 6. النطاق والأدوار

## 6.1 السياقات المدعومة

- حساب فردي لا يشترط مدرسة.
- مدرسة/جهة كمستأجر مستقل.
- شخص واحد قد ينتمي إلى أكثر من مدرسة ضمن قواعد واضحة.
- وظيفة أساسية وتكليفات مؤقتة ولجان وفرق عمل.

## 6.2 الأدوار المستهدفة تدريجيًا

- مدير/ة المدرسة.
- وكيل/ة المدرسة.
- معلم/ة.
- الموجه الطلابي.
- الموجه الصحي.
- رائد/ة النشاط.
- مسؤول الأمن والسلامة.
- محضر/ة المختبر.
- أمين/ة مصادر التعلم.
- إداري/ة.
- لجان وفرق عمل ومنسقو البرامج.

لا تُبنى شاشة مستقلة مكررة لكل دور؛ يستخدم كل دور المحركات المشتركة، مع قواعد ومتطلبات وسياق خاص.

---

# 7. النواة المستهدفة

```text
Identity & Access
├─ Person
├─ Organization / School
├─ Membership
├─ Job Position
├─ Assignment / Committee Membership
├─ Role / Permission / Policy
└─ Session / Audit

Academic Context
├─ Country / Authority
├─ Academic Year / Term / Week
├─ School Type / Stage
└─ Calendar / Localization

Official Requirements Registry
├─ Authority Document
├─ Version / Effective Dates
├─ Criterion / Indicator / Requirement
├─ Applicability Rules
└─ Source & Change Log

Work Engine
├─ Work Item
├─ Content Blocks
├─ Participants / Tasks
├─ Results / Impact Measures
└─ Lifecycle

Smart Evidence Engine
├─ Asset / Original File
├─ Provenance / Ownership / Checksum
├─ Classification / Tags / Confidence
├─ Work & Requirement Links
├─ Quality / Privacy Checks
└─ Human Confirmation

Version / Review / Output
├─ Immutable Work Version
├─ Review Request / Decision
├─ Document Render
├─ PDF / Word / Link / QR
└─ Revoke / Expiry / Audit

Modules
├─ Performance Evidence
├─ Smart Reports
├─ Self‑Evaluation
├─ Improvement Planning
├─ Operational Planning
└─ Future Departments
```

---

# 8. الشاهد الذكي — القرار الوظيفي والأخلاقي

## 8.1 مسارات الشاهد

1. **اقترح شاهدًا:** يوصي النظام بأنواع أدلة مناسبة للموضوع أو المعيار أو البرنامج.
2. **أنشئ مادة مساندة:** إعلان، استبانة، QR، شهادة، نموذج حضور، محضر، بطاقة متابعة، خطاب، خطة تنفيذ.
3. **ارفع دليلًا حقيقيًا:** صورة، فيديو، ملف، رابط، نتيجة، سجل، توقيع مصرح.
4. **استخرج من عمل موجود:** يحول بيانات نشاط أو تقرير سابق إلى روابط شواهد قابلة للمراجعة.
5. **تحقق من الجودة:** التاريخ، المصدر، الفئة، الهدف، النتيجة، قياس الأثر، الحساسية، التكرار.
6. **اربطه بسياق:** تقرير، عنصر أداء، مؤشر تقويم، مبادرة تحسين، برنامج تشغيلي.

## 8.2 ممنوعات

لا يجوز للنظام أن:

- يولد صورة توحي بتنفيذ فعلي لم يحدث.
- يخترع أسماء حضور.
- يخترع قياسًا أو أثرًا.
- ينسب توقيعًا أو ختمًا لشخص دون اعتماد.
- يحول اقتراح نشاط مستقبلي إلى إنجاز مؤكد.

حالات المحتوى الذكي تكون مثل:

`draft → proposed → user_confirmed → reviewed → approved`

مع حفظ مصدر الاقتراح والنموذج والـprompt ودرجة الثقة.

---

# 9. الأولويات

## V1 — P0

### 9.1 شواهد الأداء الوظيفي

- Onboarding حسب الوظيفة والتكليف والإصدار.
- عرض العناصر والمحكات.
- اقتراح وإنشاء مواد الشاهد.
- رفع الوسائط الحقيقية.
- تصنيف ونواقص وخصوصية.
- ربط متعدد مضبوط.
- مراجعة واعتماد.
- لوحة اكتمال.
- Word/PDF/Link/QR.

### 9.2 التقارير الذكية

- برنامج، مبادرة، ورشة، اجتماع، زيارة، فعالية، استراتيجية.
- تعبئة من Work/Evidence بدل النسخ.
- صور ونتائج وقياس أثر.
- نسخة ثابتة ومخرج ثابت.

### 9.3 التقويم الذاتي

- إطار رسمي بإصدار.
- دورة ولجنة وأدوار.
- مؤشر وتقدير مبرر وأدلة.
- مراجعة ونقاط قوة وفجوات.

## بعد نجاح النواة

### 9.4 خطة التحسين

فجوة → هدف → مبادرة → مسؤول → خط أساس → مستهدف → قياس → شاهد.

### 9.5 الخطة التشغيلية

تحويل أهداف ومبادرات إلى برامج وجداول ومسؤوليات وتكاليف ومؤشرات ومتابعة.

### 9.6 التوسع القطاعي

النشاط، الصحة، التوجيه، الأمن والسلامة، المختبر، المصادر، اللجان، التطوع، الشراكة، NAFS ونواتج التعلم.

---

# 10. الموجود القابل لإعادة الاستخدام

| المكون | القرار |
|---|---|
| React/Vite/tRPC/Drizzle/MySQL | KEEP مبدئيًا؛ أي تبديل يحتاج ADR |
| Work Graph | KEEP + HARDEN |
| Work/Asset many-to-many | KEEP |
| WorkVersion/Review/Output | KEEP + إصلاح العقود والحالات |
| Outcome-first IA | KEEP |
| الشاشات والمحررات القديمة | ADAPT تدريجيًا إلى Work ID |
| localStorage drafts | MIGRATE؛ ليس مصدر حقيقة مؤسسيًا |
| EvidenceLibrary النص/الرابط | EXTEND للوسائط والـUsed-in |
| PDF الحالي | REBUILD حول WorkVersion وخدمة آمنة |
| المتجر | KEEP كوحدة؛ ليس قلب أول Vertical Slice |
| Purchase/Entitlement schema | KEEP، لكن لا يُعد نظام دفع مكتملًا |
| CI الأساسي | KEEP + توسيع |
| PR11 | INTEGRATE بعد مراجعة |
| PR12 | INTEGRATE بعد مراجعة |

---

# 11. الفجوات المثبتة

## 11.1 الملكية والصلاحيات

- عضوية واحدة ودور بسيط لا يمثل التكليفات المتعددة ومدتها.
- بعض المسارات القديمة كانت تسمح بعمليات عبر معرفات موارد الغير قبل PR12.
- قوائم وتفاصيل وsearch/export يجب أن تستخدم policy موحدة.
- ربط أصل بين مدرستين يحتاج Share Grant صريحًا.
- مغادرة المدرسة يجب أن تسحب الوصول من كل القنوات، بما فيها صفحة مفتوحة وحفظ متأخر.

## 11.2 النسخ والاعتماد

- لا يقبل العميل `approved` كتحديث عادي.
- الاعتماد مرتبط بـWorkVersion لا بحالة عامة قابلة للتغير.
- تعديل بعد الاعتماد ينشئ مسودة/نسخة جديدة.
- صلاحية المراجع تعاد عند اتخاذ القرار، لا عند الإسناد فقط.
- التزامن يحتاج optimistic locking/CAS ومعاملات ورسائل تعارض.

## 11.3 رحلة التقرير

- ReportCenter يحفظ محليًا ولا يكتب محتوى التقرير في Work.
- WorkVersion الحالي لا يثبت كامل المحتوى والقالب والأصول.
- PDF الحالي يصدر DOM لا نسخة سلطوية.
- Output record لا يكفي دون render/storage/public access policy.

## 11.4 الرفع والوسائط

- PR12 يحسن admission لكنه لا يثبت parsing كاملًا أو malware scanning.
- يلزم quarantine، scanning، EXIF/metadata policy، decompression limits، quotas.
- نجاح التخزين وفشل DB يحتاج durable reconciliation وblob cleanup آمنًا.

## 11.5 الموارد العامة

- image proxy يحتاج SSRF hardening وallowlist وحدود وتحويل آمن.
- export worker يحتاج مصادقة/queue/limits ومنع JS والموارد غير المصرح بها.
- AI العام يحتاج هوية وحصة وtimeout وcost telemetry.

## 11.6 التشغيل والجودة

- لا توجد تجربة مستخدم حقيقية مكتملة للنموذج ذي 32 شاشة.
- لا اعتماد بصري شامل لـRTL/PDF/Word/QR.
- branch protection غير مثبتة على main.
- Backup/Restore/DR drill غير مثبت.
- RTO/RPO وسعة الأداء لم تعتمد.

---

# 12. استراتيجية الانتقال

القرار هو:

> **Modular Strangler Migration**

## القواعد

1. لا Big‑Bang Rewrite.
2. لا حذف للجداول أو المسارات القديمة قبل mapping وbackfill وrollback.
3. source of truth واحد لكل كيان.
4. الكتابة المزدوجة إن اضطررنا مؤقتة ومقاسة ولها reconciliation.
5. migration قابلة لإعادة التشغيل بلا تكرار.
6. كل سجل قديم يحتفظ بـlegacy type/id/source hash/migration status.
7. Feature Flag لمجموعة تجريبية.
8. توقف الكتابة القديمة بعد إثبات الأعداد والعلاقات والصلاحيات والمخرجات.

---

# 13. دورة حياة هندسة البرمجيات

لكل وحدة:

1. Discovery.
2. Requirements & Source Traceability.
3. Domain Analysis.
4. Threat Modeling.
5. Architecture/ADR.
6. UX Flows & Low‑Fi.
7. Prototype/User Test.
8. Implementation behind flag.
9. Unit/Integration/E2E/Security/Failure tests.
10. Staging/UAT.
11. Gradual release.
12. Monitoring/Incident/Recovery.
13. Maintenance/Versioning/Retirement.

كل ميزة تحتوي:

- Actor.
- Preconditions.
- Main Flow.
- Alternate Flow.
- Failure & Recovery.
- Validation.
- Permissions.
- Privacy.
- Audit.
- Performance budget.
- Acceptance criteria.
- Rollback.

---

# 14. قاعدة حالات الفشل

المعيار الحاكم:

> **الميزة تعمل، وتفشل بأمان، وتتوضح حالتها، وتتعافى، ولا تفقد البيانات، ولا تكشف بيانات مستخدم أو مدرسة أخرى.**

تشمل الاختبارات على الأقل:

- IDOR وcross‑tenant.
- مغادرة/تعليق/تغيير دور.
- أصل بين مدرستين.
- اعتماد نسخة قديمة مع نسخة أحدث.
- طلبان متزامنان.
- فشل وسط transaction.
- انقطاع الحفظ وQuotaExceeded.
- تخزين ناجح وDB فاشلة.
- MIME مزيف وحجم كبير.
- SSRF/HTML/redirect.
- AI timeout/quota/provider outage.
- مشاركة منتهية/ملغاة/فشل شبكة.
- webhook مكرر وخارج الترتيب.
- دفع ناجح وتطبيق فاشل.
- تحديث معيار أو قالب دون تغيير المخرج القديم.
- حذف أصل مستخدم في عدة أعمال.
- export timeout/oversize.
- migration/restore failure.

---

# 15. قرارات لا تزال مفتوحة

- مزود الدفع وأهلية الحساب التجاري والعملات والضرائب.
- عدد المراجعين وتسلسلهم.
- حقوق الموظف بعد الانتقال وسياسة ملكية المحتوى.
- مدة الاحتفاظ والإتلاف والنسخ الاحتياطية.
- نطاق أول دورة تقويم ذاتي بالتحديد.
- RTO/RPO وSLOs النهائية.
- مزود التخزين ومنطقة الإقامة.
- مزودو AI وسياسة إرسال البيانات الحساسة.
- توقيع إلكتروني نظامي مقابل اعتماد داخلي.

لا تمنع هذه القرارات إصلاحات الأمان والنواة القابلة للعكس، لكنها تمنع إطلاق Production أو ادعاء امتثال كامل.

---

# 16. بوابات العمل

| البوابة | شرط الخروج |
|---|---|
| G0 — Reconciliation | مصدر وحالة لكل متطلب حرج، وتعارضات مسجلة |
| G1 — Safety/Data Design | مصفوفة صلاحيات، state machines، migration contracts |
| G2 — Journey Design | شاشات وحالات وفشل وربط متطلبات، واختبار مستخدمين |
| G3 — Core Repair | PR11/12 متكاملان، legacy/domain authorization، CI سلوكي |
| G4 — Vertical Slice | Work→Evidence→Version→Review→Output من البداية للنهاية |
| G5 — Pilot | UAT، أمان، RTL، طباعة، أداء، مراقبة واستعادة |

---

# 17. أول Vertical Slice معتمد

```text
Person / School / Role Assignment
→ Create Work Item
→ Enter Report Content
→ Attach or Reuse Evidence
→ Select Versioned Template
→ Save Immutable Work Version
→ Submit Review
→ Review Decision
→ Render PDF/Word
→ Create Revocable Link/QR
→ Audit & Metrics
```

لا يبدأ بناء أقسام كثيرة قبل نجاح هذا المسار على بيانات اصطناعية ثم Pilot مأذون.

---

# 18. Definition of Done

لا توسم الميزة مكتملة إلا إذا:

- رُبطت بمتطلب ومصدر.
- لها acceptance criteria.
- policies والعزل مختبرة سلوكيًا.
- failure/recovery مختبران.
- migrations قابلة لإعادة التشغيل.
- RTL والجوال والطباعة صحيحة.
- audit/telemetry موجودان.
- لا أسرار أو بيانات حساسة في السجلات.
- الوثائق/API schema محدثة.
- CI ناجح على SHA محدد.
- UAT للدور المستهدف.
- rollback/feature flag متاحان عند الحاجة.
- لا مشكلة حرجة مفتوحة دون استثناء مؤرخ ومالك ومهلة.

---

# 19. القرار التنفيذي النهائي لهذه المصالحة

1. `sers-preview` هو المستودع الحاكم.
2. لا نعيد التحليل أو Work Graph من الصفر.
3. لا نعتبر PR11/12 أو 567 اختبارًا إغلاقًا للمنتج كله.
4. ندمج PR11 وPR12 عبر فرع تكامل ومراجعة، لا بصورة مستقلة عمياء.
5. نغلق legacy authorization وexport/proxy/AI قبل بيانات حقيقية أو مشاركة عامة.
6. نربط ReportCenter بالنواة قبل تحسينات شكلية واسعة.
7. نحافظ على المتجر لكن نؤجل تعقيده التجاري حتى تثبت رحلة القيمة الأساسية.
8. التقويم الذاتي أولوية محفوظة، لكنه يبنى فوق النواة لا كنظام منفصل.
9. Smart Evidence لا يختلق تنفيذًا.
10. كل قسم مستقبلي يستخدم Work/Evidence/Document/Workflow engines المشتركة.
11. المستودع القديم `SERS` مرجع تاريخي فقط حتى قرار جديد.
12. لا Production launch قبل G5.
