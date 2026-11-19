# PR41 — إصلاح ER_DUP_ENTRY المغلف وتشخيص صورة MySQL

تاريخ التنفيذ: 19 نوفمبر 2026. الأساس هو `44cb15b6c3b40fa234c1866153273bae95790998` على فرع `fix/foundation-gate-20261118-code-review`. ملفات Workflows الأربعة رفعها أنس وأصبحت مطابقة؛ هذه الدفعة لا تعدلها ولا تدمج شيئًا في main.

## 1. سبب فشل إعادة تسليم محاولة الاختبار

Drizzle `0.45.4` يغلف خطأ mysql2 في خطأ استعلام، ويضع الخطأ الأصلي داخل `cause`. الكود السابق في `server/db.ts` كان يبحث عن `errno` أو `code` في المستوى الخارجي فقط. عند طلبات متزامنة ينجح أحدها بإدخال الصف، ويرفض القيد الفريد الطلب الآخر بـ`ER_DUP_ENTRY`، لكن البرنامج لم يتعرف على هذا الخطأ المغلف، فأعاد فشلًا بدل نتيجة الصف الفائز.

القيد الفريد `(onlineExamId, attemptId)` صحيح ولم يُحذف أو يُضعف. المشكلة في معالجة سباق الإدخال، وليس في ضرورة السماح بسجل مكرر.

## 2. المعالج الجديد وكيف يستخدمه مسار التسليم

أُضيف `server/mysql-errors.ts` بمعالج `isMySqlDuplicateEntryError(error: unknown)`. يبدأ من الخطأ الخارجي ثم يتبع `cause` بحد ثمانية روابط، ويستخدم `Set` لمنع الدوران. يقرأ الخصائص عبر helper يحمي من getter أو Proxy يرمي خطأ. لا يحول قيمة عشوائية إلى رقم، ولا يبحث عن كلمة Duplicate في رسالة نصية.

الشروط المقبولة هي فقط `code === "ER_DUP_ENTRY"` أو `errno` رقمي يساوي `1062`. قيمة نصية `"1062"` أو SQLSTATE عام أو رسالة مشابهة لا يكفي أي منها لاعتبار الخطأ تكرارًا. الأخطاء الأخرى تبقى فشلًا حقيقيًا ولا تُخفى كنجاح.

الجزء الأساسي:

```ts
const seen = new Set<object>();
let current: unknown = error;

for (let depth = 0; depth <= 8; depth += 1) {
  if (!isObjectLike(current) || seen.has(current)) return false;
  seen.add(current);
  if (readProperty(current, "code") === "ER_DUP_ENTRY") return true;
  const errno = readProperty(current, "errno");
  if (typeof errno === "number" && errno === 1062) return true;
  if (depth === 8) return false;
  const cause = readProperty(current, "cause");
  if (!isObjectLike(cause)) return false;
  current = cause;
}
```

في `createOnlineExamResponse` أصبح catch يستخدم المعالج بدل الفحص السطحي:

```ts
} catch (error) {
  if (!isMySqlDuplicateEntryError(error)) throw error;
  const existing = await findExisting(db);
  if (!existing) throw new Error("تعذر تثبيت محاولة الاختبار بأمان");
  return assertSameSubmission(existing);
}
```

قراءة الفائز تتم بعد خروج transaction الفاشل، وتظل محددة بالاختبار ومعرف المحاولة. بعد ذلك تُقارن هوية الطالب واسمه والإجابات؛ اختلافها يُرفض بـ`CONFLICT`. إعادة نفس الطلب ترجع نفس id والدرجة المخزنة ولا تنشئ صفًا ثانيًا. إذا أعاد الطلب نفسه قيم درجات مختلفة فلا تُستبدل الدرجة المحفوظة؛ الخدمة تعيد القيم من الصف السابق. هذا لا يغير سياسة العملاء القدامى بلا nonce ولا يصبح إثبات هوية طالب أو قاعدة محاولة واحدة لكل طالب.

## 3. لماذا نطور التشخيص بدل افتراض سبب صورة MySQL؟

السجل السابق أظهر فقط `Tested runtime candidate export refused: mysql-image`. داخل تلك المرحلة قد يفشل أمر Docker أو JSON أو تطابق الهوية أو المنصة أو RepoDigests أو العثور على مرجع ثابت وحيد. لا يثبت الاسم العام أن المشكلة من labels أو من prefix أو من digest تحديدًا.

في `scripts/release/export-candidate.mjs` بقي `producerFailureStage` متوافقًا، وأُضيف `producerFailureReason` و`producerFailureDiagnostic`. يحفظ `atStage` سببًا موجودًا في allowlist فقط، ويطبع CLI المرحلة والسبب معًا:

```text
Tested runtime candidate export refused: mysql-image:image-command
Tested runtime candidate export refused: mysql-image:image-identity
Tested runtime candidate export refused: mysql-image:immutable-reference-missing
```

هذه أمثلة للصيغ الممكنة، لا نتائج runner جديدة. السبب النهائي يظهر من التشغيل بعد رفع الإصلاح.

## 4. أسباب الرفض المحددة وحدودها

فحص الحاوية يميز `container-command` و`container-json` و`container-identity` و`container-ambiguous-count`. فحص الصورة يميز `image-command` و`image-json` و`image-identity` و`image-platform` و`image-labels` و`image-digests`. اختيار المرجع يميز `immutable-reference-missing` من `immutable-reference-ambiguous`. أي سبب غير معروف يعود إلى `verification-failed`؛ لا تنتقل رسالة الخطأ الأصلية أو stderr أو SQL أو environment إلى التشخيص.

`runProducerCommand` يستقبل runner قابلًا للاستبدال في الاختبار، حتى نختبر فشل الأمر دون Docker. و`parseInspectionJson` و`parseContainerList` يسمحان باختبار JSON المكسور أو عدد حاويات غير مقبول. فصلنا image identity عن platform وعن metadata ليصبح سبب الرفض قابلًا للإصلاح.

لم تتغير شروط هوية container/image أو `linux/amd64`، ولم يُستبدل digest باسم tag متحرك. `labels: null` يبقى مقبولًا لصور الاعتماديات. تطبيع `docker.io/library/` مستمر، والتكرار المتطابق بعد التطبيع يُزال بـSet كما في العقد السابق؛ مرجعان مختلفان يظلان مرفوضين. المرجع المفقود أو غير صالح أو من مستودع غير مطابق لا يُعتبر إثبات صورة.

بقي candidate format وسياسة المصدر وprovenance وشرط نجاح producer قبل portability دون تعديل. لا تُستخدم حزمة قديمة من SHA مختلف، ولا نُخفي check فاشل أو نُعطّل حماية الفرع.

## 5. الملفات المعدلة

ملفات الوظيفة: `server/db.ts` و`server/mysql-errors.ts` و`scripts/release/export-candidate.mjs`. ملفات الاختبارات: `server/mysql-errors.test.ts` و`server/online-exam-mysql.integration.test.ts` و`scripts/release/candidate.test.mjs`. لا schema أو migration أو package/lock أو Workflows جديدة لهذه الدفعة.

## 6. نتائج القبول المحلي

شُغلت الاختبارات بالاعتماديات الحالية Drizzle `0.45.4` وmysql2 `3.24.6` وNode `22.23.4` وpnpm `10.18.1`. تكامل قاعدة البيانات اقتصر على MySQL `8.4.13` على `127.0.0.1:3307` و`sers_test` مع تصريح محلي صريح؛ لا اتصال بقاعدة المشروع المدارة ولا بيانات إنتاج.

نجح `pnpm check`. نجح `node --test scripts/release/candidate.test.mjs scripts/release/promotion.test.mjs` بعدد 27 اختبارًا دون skipped أو failed. نجحت أربعة ملفات خادمية بعدد 22 اختبارًا، بينها helper المغلف وحدود القبول ومعرف المحاولة. نجح تكامل MySQL بستة اختبارات؛ عشرون طلبًا متزامنًا تنتج صفًا واحدًا وتسع عشرة نتيجة deduplicated، ويرفض طالبًا أو إجابات مختلفة ويعيد درجة محفوظة ثابتة وتبقى الصفحات والتوافق القديم.

نجح البناء وفحص whitespace. بقي تحذير حجم bundle المعتاد، وليس فشلًا من هذه الدفعة. مراجعة مستقلة للشفرة لم تجد مانعًا ضمن النطاق. القبول المحلي لا يثبت مزود OAuth الخارجي أو تشغيل خدمة إنتاج أو صحة هوية صورة Docker على runner GitHub؛ ذلك يحتاج نتيجة CI الجديدة.

## 7. الرفع ومتابعة CI

هذه الدفعة موجهة إلى PR41 فقط، وليست دمجًا أو إطلاقًا. الفحوص الخادمية واختبار candidate.test مدمجان في jobs القائمة، فلا تحتاج رفع Workflows مرة أخرى. يمكن مراجعة أحدث commit والفحوص في [PR41](https://github.com/anas8273/sers-preview/pull/41). نتيجة الفحوص الفعلية تُعرض للمستخدم منفصلة عن القبول المحلي؛ لا يُعلن إصلاح هوية الصورة من اختبارات pure وحدها.
