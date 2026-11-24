# إصلاح المرحلة الأولى — HTTP security / SEC-001

## الحالة

- **المعرّف:** `http-security`
- **النطاق:** إصلاح SEC-001 فقط في مسار Express؛ لا يتضمن SEC-002 أو تحديث الاعتماديات أو نشرًا.
- **المرجع:** `audit-security.md`، SEC-001: parser عام بسقف 50MB كان يقرأ ويفكك الجسم قبل المصادقة.

## Implemented

1. أزيل parser العام `express.json({ limit: "50mb" })` و`express.urlencoded({ limit: "50mb", extended: true })` من `server/_core/index.ts`.
2. أضيفت حدود عامة صغيرة ومحددة:
   - JSON العام: `256,000` بايت.
   - URL-encoded العام: `64,000` بايت، `extended: false` و`parameterLimit: 32`؛ لا يوجد محلل nested واسع أو عمق غير محدود.
   - الترميز المضغوط مرفوض (`inflate: false`) في parsers الجديدة.
3. أضيف `server/_core/http-body-admission.ts` كـadmission قبل parser وقبل `requireAuthenticatedUser` لمساري التصدير. يفحص:
   - `Content-Length` غير الصالح أو الأكبر من السقف ويرفضه مبكرًا بـ`400`/`413`.
   - `Content-Type` ويقبل `application/json` مع `charset=utf-8` فقط لمساري التصدير.
   - `Content-Encoding` ويرفض غير `identity` بـ`415`.
   - أجسام `chunked` بعد تركيب middleware المراقبة: يعد البايتات دون استهلاك stream قبل parser، يوقف القراءة عند السقف، ويرسل `413` ثم يغلق الاتصال.
4. بقي ترتيب route registration وOAuth/session وorigin ورفع `application/octet-stream` المخصص كما كان: مسارات evidence تُسجّل قبل parsers العامة ولا تمر عبر JSON parser.
5. PDF يستخدم parser JSON خاصًا بسقف `3,000,000` بايت، وDOCX بسقف `16,000,000` بايت، وكلاهما يأتي بعد admission ثم المصادقة وrate limit وقبل renderer. بقيت فحوص payload الداخلية الموجودة (`3MB` و`16MB`) دون توسيع.
6. tRPC العادي يستخدم JSON محدودًا بـ`256,000` بايت. استثناء `genAI.extractGradesFromImage` مضبوط بـ`9,000,000` بايت فقط للحفاظ على عقد صورة AI الحالي (حد البيانات نفسه 8.5MB تقريبًا)، وليس حدًا عامًا للمسارات العامة.
7. أخطاء parsing تُعاد كرسالة JSON عامة `Malformed request body` أو `Request body exceeds the size limit` دون raw stack أو أسرار.

## Tested

- `pnpm exec vitest run server/_core/http-body-admission.test.ts --reporter=verbose`
  - **7/7 passed**.
  - HTTP فعلي على localhost عبر `fetch` و`ReadableStream`، مع harness مصادقة اصطناعي.
  - يثبت رفض `Content-Length` الكبير غير المصادق قبل auth وhandler.
  - يثبت bounded chunked rejection دون وصول إلى handler.
  - يثبت malformed JSON المصادق لا يصل إلى handler.
  - يثبت malformed JSON غير المصادق لا يصل إلى parser أو handler، و`Content-Type` غير المدعوم يُرفض قبل auth.
  - يثبت body صحيحًا مصادقًا يصل إلى handler.
  - يثبت ثوابـت PDF/DOCX `3MB` و`16MB`.
- `pnpm exec tsc --noEmit --pretty false` لم يسجل أخطاء في `server/_core/index.ts` أو `server/_core/http-body-admission.ts` أو اختبارهما.
- لم تُشغّل suite كاملة أو browser أو اتصال قاعدة بيانات/إنتاج.

## Open

- لا يزال حد rate/concurrency الموزع وconnection limit مسؤولية reverse proxy أو gateway؛ هذا الإصلاح لا يدّعي أنه distributed DoS protection.
- يجب ضبط proxy أمام التطبيق على حدود متوافقة (بما فيها `Content-Length` وchunked/request timeout) وعدم رفعها إلى ما يتجاوز عقد PDF/DOCX دون مراجعة.
- لم يُثبت هذا التغيير جودة إعدادات proxy الفعلية أو سلوك TLS/HTTP2 في بيئة النشر.
- SEC-002 الخاص بتسليمات الاختبار العام خارج ملكية هذه الحزمة ولم يُصلح.
- لم تُطبق migrations أو تغييرات dependency أو package lock.

## القيود

- الحد العام `256KB` مقصود لطلبات tRPC/auth العادية. صورة AI التي تتطلب payload أكبر لها parser route-specific صريح بدل إعادة رفع الحد العام.
- `chunked` لا يُخزّن كامل الجسم قبل المصادقة ولا يفككه parser قبل المصادقة؛ مراقبة البايتات مرتبطة بنفس stream ويُغلق الاتصال بعد تجاوز السقف. حماية proxy الموزعة مطلوبة للطلبات غير المصادق عليها على مستوى التشغيل.
- لا توجد ضمانة جاهزية إنتاجية أو claim بأن هذه الاختبارات تغطي renderer الفعلي أو كل reverse proxies.
