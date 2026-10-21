# SERS vNext — سجل تتبع المتطلبات والفجوات

**المرجع:** `00_MASTER_RECONCILIATION.md`  
**الحالة:** Baseline للتتبع؛ لا يعني أن المتطلبات التالية منفذة أو معتمدة للإطلاق.
**مصالحة التنفيذ:** 2026-10-21 — #25–#30 مدمجة؛ #31 غير مدمج، ودليله المثبت على `15ba7d5667de3ffc8e47a26d7d8d64d940e4a860` في [سجل التسليم](07_PHASE_HANDOFF_2026-10-21.md).

---

## 1. معاني الحالات

| الحالة | المعنى |
|---|---|
| `DONE` | منفذ ومختبر بالدليل المحدد، وليس بمجرد وجود كود |
| `PARTIAL` | أساس أو جزء منفذ، مع شروط قبول متبقية |
| `DESIGNED` | موثق تصميميًا فقط |
| `MISSING` | غير موجود كقدرة متكاملة |
| `BLOCKED` | يتوقف على قرار أو إصلاح حرج |
| `DEFERRED` | محفوظ في النطاق لكن ليس في الدفعة الحالية |
| `UNVERIFIED` | ذُكر تاريخيًا ولم يُثبت من المصدر التنفيذي الحالي |

---

# 2. سجل R01–R22

| ID | المتطلب | الحالة الحالية | دليل/أساس موجود | المتبقي لإغلاقه |
|---|---|---|---|---|
| R01 | منصة أعمال مدرسية + متجر + AI، وليست LMS | PARTIAL | Outcome-first IA، متجر ومحررات قديمة | وثيقة نطاق نهائية وربط الوحدات بالنواة وعدم توسع LMS بلا قرار |
| R02 | حساب فردي لا يشترط مدرسة | PARTIAL | personal ownership موجود في Work Graph | رحلة كاملة من إنشاء إلى تصدير لمستخدم بلا مدرسة |
| R03 | عضويات وأدوار وتكليفات متعددة ومؤقتة | MISSING/PARTIAL | Organization/Membership ودور مفرد | Assignment، مدة، نطاق، لجان، انتقال موظف، اختبارات role change |
| R04 | رفع الأصل مرة وإعادة استخدامه | PARTIAL | WorkAssetLink وlink/unlink | Used-in، أثر الحذف، مشاركة عابرة للسياقات، إصدارات الأصل |
| R05 | صورة/فيديو/مستند/رابط/نص | PARTIAL | رابط/نص في النواة، upload قديم، تحسينات PR12 | secure media pipeline، quarantine، scanning، quotas، protected delivery |
| R06 | اقتراح/إنشاء شاهد ذكي حسب السياق | DESIGNED | متطلبات وAI قديم منفصل | Contextual AI، provenance، confidence، قبول/رفض، منع اختلاق التنفيذ |
| R07 | تقرير من البيانات والشواهد | PARTIAL | #27: مسودة خادمية وشواهد مختارة ونسخة ثابتة؛ #29/#30: PDF من النسخة | versioned template/licensing، Word، Golden QA، وترحيل المحررات القديمة |
| R08 | ملف إنجاز ديناميكي مرجعي | DESIGNED/PARTIAL | محرر قديم ونوع portfolio | تجميع أعمال وأصول مرجعية، نواقص، ترتيب، نسخة ومخرج |
| R09 | التقويم الذاتي أولوية حديثة | MISSING | لا route/domain متكامل | دورة/لجنة/معيار/تقدير/مراجعة/فجوة/تحسين |
| R10 | المراجعة والاعتماد على نسخة ثابتة | PARTIAL | #26: منع status bypass، إعادة تفويض المراجع، اختبارات القرار المتزامن واعتماد نسخة قديمة | مصفوفة الصلاحيات لجميع القنوات، سحب العضوية، وحسم multi-review policy O002 |
| R11 | PDF/Word/رابط/QR | PARTIAL | #29/#30: PDF خاص من WorkVersion؛ #31 غير مدمج: رابط/QR محمي وانتهاء وإلغاء، واختبار متصفح→MySQL | Word قابل للتعديل، Golden PDF/Word، فك/مسح QR، الهوية والتخزين الإنتاجيان ومراجعة مسارات التنزيل |
| R12 | القالب منفصل عن المحتوى | PARTIAL | themes/templates قديمة | Template Version، compatibility، rollback بلا فقد، licensing |
| R13 | شراء واستحقاق وتطبيق واسترداد | DESIGNED/PARTIAL | Product/Purchase/Entitlement schema، متجر قديم | مزود فعلي، webhook، idempotency، refund، apply/retry |
| R14 | معايير رسمية بإصدارات ومصادر | DESIGNED/PARTIAL | StandardVersion schema | Registry كامل، مصادر رسمية، effective dates، applicability، change log |
| R15 | سنة دراسية وأرشفة وانتقال موظف | MISSING | لا Academic Year Engine متكامل | rollover، term/week، archive، ownership transfer، retention |
| R16 | توسع وحدات ودول بلا تكرار المحركات | DESIGNED | Modular core مبدئي | Contract لوحدة ثانية، country/authority/calendar/currency config |
| R17 | Happy/Alternate/Failure/Recovery لكل مسار | PARTIAL | F01–F20 موثقة واختبارات متفرقة | تنفيذ واختبار جميع الحالات الحرجة لكل module |
| R18 | خصوصية وتصنيف واحتفاظ وإتلاف | MISSING/PARTIAL | ownership/audit جزئي | classification، minors/PII، redaction، retention، deletion، backup handling |
| R19 | RTL، جوال، وصول، طباعة | PARTIAL | واجهة عربية ونموذج 32 شاشة | browser/device matrix، screen reader، keyboard، visual PDF/Word QA |
| R20 | AI متعدد المزودين وحصص وتتبع | MISSING/PARTIAL | استدعاءات AI قديمة | AI Gateway، provider abstraction، quotas، timeout، model/prompt version، evals |
| R21 | حفظ وتزامن وتعارض ونسخ | PARTIAL | #27: مصدر خادمي، autosave وexpectedRevision، حفظ متزامن ونسخة سلطوية؛ local backup للاستعادة | إثبات التعافي عبر المتصفح/الأجهزة لجميع المحررات، recovery/import وrestore-as-new-head |
| R22 | مراقبة ونسخ احتياطية وتعافٍ | MISSING/PARTIAL | CI وlogs متفرقة | observability، alerts، backup، restore drill، RTO/RPO، runbooks |

---

# 3. خريطة P0-001–P0-035

| ID | المطلب | الحالة | الإجراء التالي |
|---|---|---|---|
| P0-001 | البداية بالنتيجة لا شبكة الأدوات | DONE جزئيًا | تثبيت عدم الرجوع في UX الجديدة |
| P0-002 | Home/Work/Evidence/Reviews/Store/Notifications/Account | PARTIAL | role-aware visibility وحالات حقيقية |
| P0-003 | Work موحد للتقرير والإنجاز | PARTIAL | Content Blocks وعقود الأنواع |
| P0-004 | Asset واحد يعاد استخدامه | PARTIAL | Used-in وأثر delete/version |
| P0-005 | Personal/School/Shared | PARTIAL | ShareGrant وmembership revocation |
| P0-006 | Standard + Version + effective dates | PARTIAL | Registry ومصادر رسمية |
| P0-007 | Content منفصل عن Template | PARTIAL | versioned template bindings |
| P0-008 | Version ومقارنة واستعادة | PARTIAL | authoritative snapshot + restore-as-new-head |
| P0-009 | Output مثبت على WorkVersion | PARTIAL | actual render bytes/hash/storage |
| P0-010 | PDF/Link/QR وخصوصية وانتهاء وإلغاء | PARTIAL | enforcement على كل view/download |
| P0-011 | Review على نسخة ثابتة | PARTIAL | state machine وتفويض لحظة القرار |
| P0-012 | ملف الإنجاز View مرجعي | MISSING | Portfolio aggregate/view |
| P0-013 | تفاصيل القالب والتوافق والترخيص والمعاينة | PARTIAL | compatibility/licensing service |
| P0-014 | Purchase → Entitlement | DESIGNED | خدمة دفع واختبارات idempotency |
| P0-015 | Success/Pending/Failed ودفع آمن | MISSING | webhook reconciliation |
| P0-016 | AI سياقي داخل المهمة | MISSING/PARTIAL | AI actions داخل Work/Evidence |
| P0-017 | مصدر/ثقة/قبول/تعديل/رفض | MISSING | AI provenance model |
| P0-018 | إشعارات قابلة للتصرف | MISSING/PARTIAL | event-driven notifications + dedupe |
| P0-019 | Organization/Membership/Role/Policy | PARTIAL | Assignment/ABAC/unified policies |
| P0-020 | فهم من يرى الأصل والعمل والمخرج | PARTIAL | policy preview + server enforcement |
| P0-021 | Trash/export/restore/retention | MISSING/PARTIAL | lifecycle policy وaccount export |
| P0-022 | RTL وهاتف/سطح مكتب | PARTIAL | device QA وvisual regression |
| P0-023 | Keyboard/focus/labels/reduced motion | MISSING/PARTIAL | accessibility tests |
| P0-024 | 5 مستخدمين ثم 3 جدد | MISSING | supervised usability study |
| P0-025 | IDOR/tenant isolation/role escalation | PARTIAL | تكامل PR11/12 اكتمل في #25؛ يبقى all-channel وmembership transition coverage |
| P0-026 | CSRF/CSP/HSTS/rate/session controls | MISSING/PARTIAL | security headers, limits, session registry |
| P0-027 | Quarantine/MIME/magic/malware/EXIF | PARTIAL | scanning/CDR/metadata policy |
| P0-028 | Audit append-only للأحداث الحساسة | PARTIAL | coverage لكل command وread حساس |
| P0-029 | health/readiness/logs/correlation/metrics | MISSING/PARTIAL | production observability |
| P0-030 | CI/tests/scans/preview/staging/rollback | PARTIAL | merge gates وbranch protection وrollback proof |
| P0-031 | مصدر علائقي رئيسي واحد | PARTIAL/DECIDED | ADR ومنع ازدواجية المصدر |
| P0-032 | Object storage خاص وsigned URLs | MISSING/PARTIAL | protected delivery وlifecycle |
| P0-033 | Unit/Integration/E2E للمسارات | PARTIAL | browser E2E وfailure injection |
| P0-034 | محرك إخراج ثابت واختبارات بصرية | MISSING/PARTIAL | render service + golden docs |
| P0-035 | لا LMS في P0 | DECIDED | guard in scope/architecture review |

---

# 4. إضافات DELTA-01–DELTA-10

| ID | القرار | الحالة |
|---|---|---|
| DELTA-01 | حفظ المنجز وتحديث المهام بدل إعادة العمل | ACTIVE |
| DELTA-02 | مصدر وتاريخ وثقة ومالك لكل متطلب | PARTIAL؛ هذا الملف بداية التنفيذ |
| DELTA-03 | الإطار حسب الدور والتكليف | MISSING |
| DELTA-04 | التقويم والتحسين رحلة مستقلة فوق النواة | DESIGNED |
| DELTA-05 | فصل اقتراح النشاط عن إثبات التنفيذ | DECIDED؛ يحتاج تنفيذ |
| DELTA-06 | التقرير والمخرج ثابتان على نسخة | PARTIAL |
| DELTA-07 | الاستحقاقات مستقلة عن ملكية المحتوى | DESIGNED |
| DELTA-08 | الاستيراد بمعاينة وفروق وrollback | MISSING |
| DELTA-09 | Golden Arabic outputs | MISSING |
| DELTA-10 | سجل مصادر رسمي وتجاري | MISSING/PARTIAL |

---

# 5. حالات الفشل F01–F20

| ID | الحالة | الوضع | شرط الإغلاق |
|---|---|---|---|
| F01 | حساب A يشارك/يرفع لملف B | PARTIAL عبر #25 | API+DB+no-side-effect للعمليات المحددة مثبتة؛ تغطية جميع القنوات باقية |
| F02 | مستخدم يغادر المدرسة | MISSING | list/get/search/export/share/save-late كلها ترفض |
| F03 | أصل بين مدرستين | MISSING | ShareGrant صريح وإلغاء فعّال |
| F04 | الكاتب يرسل approved | OPEN | command-only transition واختبار سلبي |
| F05 | اعتماد v1 مع وجود v2 | OPEN | v1 فقط معتمدة وv2 تبقى draft |
| F06 | خفض دور المراجع | OPEN | إعادة تقييم الدور وإعادة إسناد |
| F07 | نسختان متزامنتان | OPEN | CAS/transaction/idempotency ورسالة تعارض |
| F08 | فشل نصف عملية review | OPEN | rollback أو durable reconciliation |
| F09 | offline/local quota | OPEN | بقاء المدخلات وحالة حفظ صادقة |
| F10 | storage نجح وDB فشلت | OPEN | durable cleanup/reconciliation |
| F11 | MIME مزيف/حجم كبير | PARTIAL PR12 | scanning/parser/decompression/quota |
| F12 | SSRF/HTML/redirect | OPEN | allowlist/private IP block/re-encode/limits |
| F13 | AI outage/quota | OPEN | manual fallback/retry/no auto-approval |
| F14 | فشل/انتهاء/إلغاء share | OPEN/PARTIAL | UI states + server enforcement |
| F15 | webhook مكرر | MISSING | entitlement واحد واختبار تزامن |
| F16 | دفع ناجح وتطبيق فشل | MISSING | retry بلا دفع جديد |
| F17 | تحديث معيار/قالب | OPEN | output hash ثابت وإصدارات قديمة قابلة للقراءة |
| F18 | حذف أصل مشترك | PARTIAL | impact preview، unlink لا delete، versions ثابتة |
| F19 | export timeout/oversize | OPEN | queue/limits/retry/no duplicate |
| F20 | migration/restore failure | OPEN | synthetic restore drill وrollback/replay |

---

# 6. حزم العمل المحفوظة خارج الرحلة الأولى

| الحزمة | المحتوى | لا تُعد مكتملة حتى |
|---|---|---|
| أداء الموظف | الأدوار، المحكات، الأوزان، الشواهد | مصدر رسمي وإصدار وتجربة لكل دور |
| التقويم والتحسين | دورة، لجنة، مؤشر، تقدير، فجوة، متابعة | نموذج مجال واختبارات ومخرجات |
| الوسائط | صور/فيديو/Office/PDF وروابط | secure upload lifecycle كامل |
| ملف الإنجاز | تجميع أعمال وشواهد بلا نسخ | Work/Asset references وversion/output |
| AI | تصنيف واستخراج ونواقص وتوليد مواد | governance/evaluation/fallback/privacy |
| التجارة | منتجات وقوالب وترخيص ودفع | sandbox/webhooks/refund/reconciliation |
| السنة والعضويات | year/term/assignments/move/archive | transition tests وسياسات ملكية |
| الإشعارات | events وإجراءات وdedupe | reliable outbox وdelivery states |
| المخرجات | Word/PDF/QR/links | golden files وprint QA |
| التشغيل | monitoring/backups/DR/security | staging-like verification وrunbooks |

---

# 7. متطلبات غير وظيفية

## الأمان

- Default deny.
- Policy واحدة لكل list/get/search/export/link/background job.
- Tenant isolation واختبارات IDOR.
- Rate limiting وabuse controls.
- Session revocation ومدة وصول قصيرة.
- Upload isolation وmalware scanning.
- SSRF/export sandbox.
- Secrets rotation.

## الخصوصية

- Data classification.
- PII/minors detection.
- Redaction/blur.
- Purpose and retention.
- User/school export.
- Safe delete across derivatives/backups according to policy.
- AI redaction and provider policy.

## الأداء

لا يعتمد هدف «أقل من 3 ثوانٍ» دون تحديد:

- endpoint.
- percentile.
- dataset.
- concurrency.
- environment.

يُعتمد Performance Budget مستقل للعمليات التفاعلية، بينما AI/render/video تكون jobs غير متزامنة مع SLA واضح.

## الوصول والجودة العربية

- RTL حقيقي.
- هجري/ميلادي حسب السياق.
- Arabic fonts embedded.
- جداول وفواصل صفحات.
- Keyboard + focus + labels.
- Screen reader.
- Zoom/contrast/reduced motion.
- Android/iOS/Chrome/Edge/Safari matrix حسب الدعم المعتمد.

## التشغيل

- Structured logs بلا PII.
- correlation IDs.
- metrics/alerts.
- queue lag وprovider health.
- backup and restore drill.
- incident runbooks.
- feature flags وrollback.

---

# 8. شروط الانتقال بين المراحل

## قبل دمج إصلاحات النواة

- اكتملت مراجعة/مصالحة PR11 وPR12 عبر #25؛ يجب الحفاظ على تغطيتهما عند التغييرات اللاحقة.
- لا workflow متكرر أو اختبارات متضاربة.
- CI على SHA محدد.
- MySQL migrations واختبارات ownership/rollback/concurrency.

## قبل بيانات حقيقية أو مشاركة عامة

- إغلاق SEC-01/02/03 وما يعادلها.
- حماية upload/export/proxy/AI.
- عزل المدرسة في كل قنوات القراءة والكتابة.
- signed/protected downloads.
- privacy classification.

## قبل قبول أول رحلة

- Work content محفوظ في الخادم.
- WorkVersion سلطوية.
- Review على نسخة.
- PDF/Word من نفس النسخة.
- share/revoke/expiry صحيحة.
- Browser E2E + DB + visual output.
- failure cases ذات الصلة مغلقة.

## قبل إطلاق المنتج

- R01–R22 لكل منها مصدر وحالة واختبار أو قرار استبعاد.
- جميع الوحدات المدرجة في الإصدار مكتملة بمعيار DoD.
- UAT بحسب الأدوار.
- أداء/أمان/خصوصية/استعادة/مراقبة.
- لا blocker حرج دون استثناء مؤرخ.

---

# 9. قاعدة تحديث السجل

كل صف يتوسع لاحقًا بهذه الحقول:

- `source_type`
- `source_reference`
- `source_date`
- `owner`
- `decision_status`
- `implementation_issue`
- `commit_or_pr`
- `test_evidence`
- `residual_risk`
- `last_verified_at`

لا تتحول الحالة إلى `DONE` بواسطة تقرير يدوي فقط؛ يجب إرفاق دليل الكود والاختبار والبيئة المقصودة.
