# المرحلة الأولى — exam-submission

## النطاق والحكم

هذا الإصلاح يعالج hardening لمسار `onlineExam.submit` وفق SEC-002، ولا يعيد بناء الاختبار أو يضيف تصحيحًا آليًا/ذكاءً اصطناعيًا للمقال. عولجت حدود الإدخال، canonicalization، rate limiting، idempotency للمحاولات الجديدة، وقائمة الاستجابات. يبقى WF-004 مفتوحًا كفجوة منتج: لا توجد هنا mutation لاعتماد تصحيح المقال أو ربط الاختبار بـ`Work/WorkVersion/Review`.

## Implemented

- أضيف `server/online-exam-admission.ts` كطبقة قبول مشتركة:
  - حد أقصى 100 سؤال و256 KiB لبيانات الأسئلة، ومعرفات أسئلة فريدة وآمنة.
  - canonical questions لا تحفظ الحقول غير المعروفة، وتحافظ على `correctIndex`/`correctAnswer` اللازمة للتصحيح الخادمي.
  - قبول الإجابات ذات معرفات الأسئلة المعروفة فقط؛ رفض المفاتيح المجهولة، الرقمية غير الآمنة، و`__proto__`/`prototype`/`constructor`.
  - حد 4,000 محرف للقيمة وحد 64 KiB لخريطة الإجابات بعد canonicalization، مع التحقق من الأعداد finite/safe integer.
  - حد bytes مستقل لاسم الطالب (255) ومعرفه (128) ومعرف المحاولة (128).
  - rate limiter process-local محدود الذاكرة (10,000 bucket كحد أقصى)، مركب على `req.ip` الموثوق وexam token، و20 طلبًا لكل نافذة 60 ثانية. لا يقرأ `X-Forwarded-For` مباشرة، وغياب `req.ip` يفشل مغلقًا برسالة 429.
- في `server/routers.ts`:
  - `onlineExam.create` يحفظ canonical questions فقط.
  - `onlineExam.view` يحذف `correctAnswer` و`correctIndex` بعد canonicalization، ويرفض عرض صف legacy مشوه بدل كشفه.
  - `onlineExam.submit` يمرر الإدخال عبر الحدود قبل الحفظ، ويعيد خطأ عربيًا مناسبًا عند تجاوز rate limit أو مخالفة العقد.
  - أضيف `attemptId` اختياري للمحاولات الجديدة؛ الاستدعاء الحالي القديم بلا `attemptId` يبقى مقبولًا صراحةً للتوافق لكنه لا يدعي idempotency.
  - `onlineExam.responses({ id })` يحافظ على مصفوفة الاستجابة القديمة. عند إرسال `limit` أو `cursor` يعيد `{ items, nextCursor }`، وبحد أقصى 100 صف، ويعرض summaries دون `answers`.
- في `server/db.ts`:
  - المحاولة ذات `attemptId` تُثبت ضمن transaction ومفتاح فريد مركب في قاعدة البيانات.
  - سباق nonce نفسه يعيد الصف الفائز مرة واحدة فقط؛ إذا اختلف الطالب أو `studentId` أو الإجابات يعاد `CONFLICT` بدل دمج طالبين.
  - المحاولات القديمة بلا nonce تُحفظ كصفوف مستقلة حسب سياسة التوافق، مع بقاء rate limit/canonicalization مطبقين من الراوتر.
  - pagination cursor مبني على `id`، والاستعلام bounded ولا يعيد الإجابات التفصيلية للملخص.
- في `drizzle/schema.ts` وmigration المولدة `drizzle/0020_closed_namor.sql` وsnapshot/journal المقابلين:
  - إضافة `attemptId` nullable للحفاظ على الصفوف القديمة.
  - إضافة unique `(onlineExamId, attemptId)` وفهرس `(onlineExamId, submittedAt, id)`.
  - الـmigration مراجعة فقط؛ لم تُطبق على قاعدة مستخدم أو إنتاج.

## Tested

- `pnpm exec vitest run server/online-exam-admission.test.ts server/online-exam.test.ts --reporter=verbose`
  - **passed: 13/13**.
  - يغطي canonical questions، الحفاظ على الإجابات الصحيحة، unknown/prototype/numeric answer keys، حدود bytes، bounded composite limiter، إخفاء correct answers، وخصوصية قائمة الاستجابات.
- `pnpm exec vitest run server/online-exam-admission.test.ts server/online-exam.test.ts server/online-exam-mysql.integration.test.ts --reporter=verbose`
  - **passed: 13، skipped: 3**.
  - `server/online-exam-mysql.integration.test.ts` gated ولا يعمل إلا عند `SERS_INTEGRATION=1` و`GITHUB_ACTIONS=true` و`DATABASE_URL=mysql://root:root@127.0.0.1:3306/sers_test`; يغطي concurrency للـnonce، عدم دمج طالب مختلف، توافق legacy، وpagination summaries.
- `pnpm exec tsc --noEmit --pretty false`
  - نجح دون تشخيصات في ملفات exam المملوكة.
- لم تُشغّل suite كاملة أو browser، ولم تُستخدم قاعدة managed أو بيانات مستخدم.

## Open

- WF-004 ما زال مفتوحًا: الاختبار ليس Work/WorkVersion ولا توجد مراجعة/اعتماد نهائي للمقال أو سجل قرار المعلم.
- واجهة الطالب الحالية لا ترسل `attemptId`؛ لذلك تعمل وفق سياسة legacy المتوافقة ولا تملك retry idempotency حتى يحدّثها مسار التكامل المملوك لحزمة أخرى أو يضيف العميل nonce صريحًا.
- rate limiter process-local وليس موزعًا بين نسخ الخادم؛ يلزم قرار تشغيلي/بوابة موزعة قبل تشغيل عام متعدد النسخ.
- لا توجد سياسة retention/cleanup جديدة للصفوف المكررة القديمة؛ pagination يحد القراءة فقط.
- لا أضمن أن migration قابلة للتطبيق على كل نسخة MySQL؛ الاختبار المقصود MySQL 8.4 في CI، ويجب تطبيقها على قاعدة تطوير اختبارية فارغة/معزولة ومراجعتها قبل أي تشغيل.

## القيود والأثر خارج النطاق

لم ألمس `review-output` أو ملفات Work/Version أو الواجهة الحالية. لم أنفذ migration، ولم أنشر، ولم أجر اتصالًا بإنتاج أو `DATABASE_URL` المُدار. نجاح الاختبارات الاصطناعية لا يثبت جاهزية إنتاجية، ولا يغلق OAuth/tenant/session/CAS/immutable WorkVersion أو الاعتماد البشري للمقال.
