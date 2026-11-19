# حزمة `sharing-audit` — المرحلة الأولى

## implemented

- أضيف `validateOutputContract` في `server/review-output-db.ts` كحارس نقي يُنفَّذ قبل `getDb` وقبل فتح transaction. يرفض قيم `type` و`visibility` غير المعروفة، ويفرض أن تكون المشاركة العامة/المحمية `link` أو `qr` فقط؛ لذلك لا يمكن إنشاء PDF عام/محمي أو DOCX عام/محمي لا يملك resolver.
- حُفظت semantics المخرجات الخاصة القديمة: يبقى PDF وDOCX الخاصان صالحين، وتبقى روابط/QR الخاصة ممكنة مع token كما كان العقد السابق. المخرج المحمي يحتاج `passwordHash`، ولا يقبل العقد hash لمخرج غير محمي أو `storageKey` لمخرج مشترك.
- أضيف `output.share_created` و`output.share_revoked` إلى جدول `audit_logs` داخل نفس transaction التي تنشئ/تلغي output. السجل يحمل actor عبر `actorUserId` ووقت الجدول و`resourceType=output` و`resourceId=output.id`، وmetadata محدودة إلى `workVersionId`/`versionNumber`/`outputType`/`grant`/`expiresAt`/`context`. لا يُكتب token أو password أو raw storage URL، ولا يوجد اعتماد على حدث async قد يفشل بصمت.
- عملية revoke تعيد التحقق من ownership/tenant والعضوية عبر `lockWorkAccess` قبل قفل output، وتكتب audit مرة واحدة عند الانتقال الفعلي إلى revoked؛ الإلغاء المتكرر لا ينشئ أحداثًا مكررة. outsider لا يستطيع الإلغاء.
- أصبح `share-output-router.ts` يستخدم `z.strictObject` حتى لا تُسقط حقول غير معروفة بصمت. `maxViews` غير موجود في عقد outputs الجديد ولا يُقبل كخيار متجاهل؛ طلبه عبر هذا المسار يُرفض بدل الادعاء بوجود policy غير مطبقة.
- بقي resolver العام محصورًا في allowlist التقرير/الشواهد المختارة، ويواصل حجب private/revoked/expired/unapproved/deleted outputs وإخفاء ownership وstorage URLs. لم يُفتح direct asset delivery، ولم تُعدَّل سياسة عضوية المدارس أو ShareGrant.

## tested

- `pnpm exec vitest run server/output-sharing-contract.test.ts server/output-creation-password.test.ts server/public-output-router-safety.test.ts server/domain-integration.test.ts`
  - **23 passed**: حارس كل توليفات PDF/DOCX غير القابلة للحل، runtime enum rejection، private compatibility، expiry قبل transaction، password hashing، public/protected router safety، ورفض `maxViews` غير المدعوم.
  - **12 skipped**: `server/domain-integration.test.ts` gated خلف `SERS_INTEGRATION=1` ولم تُستخدم قاعدة مُدارة.
- أضيفت بوابة MySQL اصطناعية في `server/domain-integration.test.ts`، عند تشغيلها في قاعدة CI معزولة، تثبت: create audit واحد، metadata مرتبطة بالـWorkVersion، غياب token/password من السجل، outsider revoke مرفوض، owner revoke ذري، وعدم تكرار audit عند revoke المتكرر.
- `git diff --check` مرّ على ملفات الحزمة.
- `pnpm check` شُغّل، لكنه بقي محجوبًا بثلاثة أخطاء TypeScript خارج الملكية في `client/src/pages/WorkReportEditor.tsx:172` و`server/online-exam-admission.ts:167` و`server/routers.ts:309`. لم أعدّل هذه الملفات أو سياسات الحزم.

## open

- لا يملك جدول `outputs` الحالي أعمدة `maxViews`/`viewCount`، لذلك لم أضف حارسًا ذريًا غير موجود ولم أدّعِ دعم maxViews. إذا تقرر اعتماد هذه السياسة لاحقًا، يلزم عقد ومخطط/ترحيل مراجَع وincrement ذري واختبارات concurrent مستقلة؛ حتى ذلك الحين يُرفض الخيار ولا يُخزَّن.
- لا يثبت الاختبار المحلي gated تشغيل MySQL أو قفل InnoDB الفعلي؛ يجب تشغيل بوابة integration على MySQL 8.4 disposable للتحقق من transaction rollback عند فشل إدراج audit ومن السباق بين revoke/resolve.
- لا يضيف هذا الإصلاح audit لروابط legacy في `server/db.ts` ولا يغيرها؛ ذلك خارج الملكية، وتبقى ملاحظته للتكامل اللاحق إذا كان توحيد سجل القنوات مطلوبًا.
- لا توجد إضافة migration؛ جدول `audit_logs` الموجود كافٍ للعقد الحالي، لكن لا توجد مفاتيح foreign-key خاصة بالمخرج في هذا الجدول.

## القيود

- لم أحرر `server/db.ts` أو `drizzle/domain-core.ts` أو `domain-router.ts` أو renderers/assets/Works، ولم أغير auth/session/CAS/immutable WorkVersion أو school membership policy.
- لم أشغّل `db:push` أو migration أو suite كاملة أو browser أو dev server، ولم أتصل بـ`DATABASE_URL` المُدار، ولم أنشر أو أنشئ Git commit/push/reset/clean.
- audit يعتمد على transaction نفسها: إذا فشل إدراج السجل يفشل create/revoke وتُعاد العملية، بدل إخفاء العجز أو إطلاق event غير موثوق.
- صلاحية public/protected لا تعني أن كل PDF يجب أن يكون public؛ السلسلة المدعومة للمشاركة هي WorkVersion الموافق عليها ثم link/QR resolver، بينما PDF/DOCX الخاصان يمران بمسار التنزيل الخاص القائم.
