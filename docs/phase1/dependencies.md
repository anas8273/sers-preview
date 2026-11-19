# اعتماديات المرحلة الأولى — نتيجة مراجعة Puppeteer وchromium-bidi

**تاريخ الفحص:** 2026-11-19
**النطاق:** ملفات الاعتماديات المملوكة لهذه الدفعة فقط (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, workflows) وملف هذه الوثيقة. لم يتغير كود التطبيق أو قاعدة البيانات أو HTTP/report/exam، ولم يحدث `db:push` أو production/push/commit.

## القرار المنفذ

تم تحديث `puppeteer` في `package.json` من `^24.38.0` إلى `^25.18.1`، ثم أُعيد توليد `pnpm-lock.yaml` بواسطة pnpm 10.18.1، وبعدها نُفّذ تثبيت frozen عادي. هذا ليس override لـZod ولا patch محليًا غير معلن؛ إنه مسار upstream يغيّر سلسلة Puppeteer نفسها.

النسخ المثبتة بعد التثبيت هي:

- Node: `v22.23.4` محليًا، وسياسة الحزمة `>=22 <23`.
- pnpm: `10.18.1`، مطابق لـ`packageManager` و`engines.pnpm` ونسخة CI.
- `puppeteer`: `25.18.1`.
- `puppeteer-core`: `25.18.1`.
- `@puppeteer/browsers`: `3.2.7`.
- `chromium-bidi`: `157.0.8090-0`.
- Zod المباشر والانتقالي المثبت: `4.6.7`.
- `extract-zip`: غير موجود في القفل أو الشجرة النهائية.
- KaTeX: `0.16.25` عبر `streamdown`، و`0.16.47` عبر `streamdown > mermaid`.

يتطلب Puppeteer 25.18.1 و`@puppeteer/browsers` 3.2.7 Node `>=22.12.0`؛ البيئة الحالية `22.23.4` تستوفي ذلك [1] [2]. حافظ التثبيت على `pnpm-workspace.yaml` وسياسة pnpm 10 الحالية، بما فيها `ignoredBuiltDependencies: puppeteer` وpatch `wouter@3.7.1`. لم يُستخدم `--ignore-scripts`، ولم يُحذف patch أو lockfile. شغّل `postinstall` الموجود (`npx puppeteer browsers install chrome`) ونزّل Chrome for Testing `157.0.8103.78` بنجاح.

## لماذا أزيلت high الحالية

قبل التغيير كانت السلسلة:

```text
puppeteer@24.38.0
├─ @puppeteer/browsers@2.13.0
│  └─ extract-zip@2.0.1
└─ chromium-bidi@14.0.0
   └─ zod@3.25.76
```

وكانت `extract-zip@2.0.1` تصل مرتين، عبر `puppeteer` و`puppeteer-core`. الاستشارتان الرسميتان لـ`extract-zip` تصفان ثغرات symlink/path traversal وarbitrary file write، وتحددان كل الإصدارات حتى `2.0.1` على أنها متأثرة، مع **عدم وجود patched release** [3] [4]. لذلك لم أضع allowlist أو audit ignore، ولم أضع patch تخميني لحزمة لم تنشر إصلاحًا.

بعد التحديث أصبحت السلسلة:

```text
puppeteer@25.18.1
├─ @puppeteer/browsers@3.2.7
│  └─ modern-tar@0.8.x (لا extract-zip)
└─ chromium-bidi@157.0.8090-0
   └─ zod@4.6.7
```

Manifest الرسمي لـ`@puppeteer/browsers@3.2.7` يعلن `modern-tar` و`yargs` فقط، ولا يعلن `extract-zip` [2]. وManifest الرسمي لـ`chromium-bidi@157.0.8090-0` يعلن `zod: ^4.6.5` [5]. لذلك لم تُستخدم قاعدة `zod: 3 -> 4` في `overrides`، ولم تُضف حزمة Zod انتقالية مباشرة، ولم يتغير import في التطبيق. تعالج هذه الترقية Zod الانتقالي عبر release متوافق معلن من Chromium BiDi، لا عبر إجبار مدير الحزم على توافق غير مثبت.

## reachability وحدودها

- مسار browser-download reachable أثناء التثبيت لأن `postinstall` ينفذ `puppeteer browsers install chrome`. هذا المسار أصبح يستخدم `@puppeteer/browsers@3.2.7` و`modern-tar`، وليس `extract-zip`. توثيق Puppeteer الرسمي يوضح أن حزمة `puppeteer` تنزّل Chrome for Testing وتستخدم `puppeteer-core` للقيادة [6].
- مسار التشغيل الذي اختُبر فعليًا هو Chromium عبر Puppeteer/CDP: `launch`, `newPage`, `goto`, `pdf`, `page.close`, `browser.close`. لا يوجد import مباشر لـ`chromium-bidi` أو `@puppeteer/browsers` من كود التطبيق.
- `chromium-bidi` تبعية إنتاجية داخل Puppeteer/Puppeteer Core، وهي متاحة لمسارات WebDriver BiDi، لكن probe الحالي لا يدّعي اختبار BiDi نفسه. لم أجد استخدامًا مباشرًا لـBiDi في التطبيق؛ لذلك تُسجل reachability على أنها **transitive/available، لا direct application call**.
- دليل Puppeteer يوصي بـ`puppeteer-core` عند إدارة browser خارجيًا، بينما هذا المشروع يستخدم `puppeteer` وتنزيل Chrome المضمون من upstream [6].

## التحقق والأوامر

الأوامر التي شُغلت محليًا:

```sh
node --version                         # v22.23.4
pnpm --version                         # 10.18.1
pnpm install --lockfile-only
pnpm install --frozen-lockfile        # scripts مفعلة، لا --ignore-scripts
pnpm ignored-builds                   # None
pnpm why puppeteer --recursive
pnpm why chromium-bidi --recursive
pnpm why extract-zip --recursive      # لا نتيجة في الشجرة النهائية
pnpm why zod --recursive
pnpm audit --prod --json > /tmp/sers-dependency-audit-final.json
```

Probe فعلي اصطناعي ناجح:

```sh
node --input-type=module   # puppeteer.launch -> newPage -> goto -> pdf -> close
```

النتيجة: `puppeteer 25.18.1`, page text اصطناعي، PDF بطول 9003 bytes يبدأ بـ`%PDF-`، وlifecycle كامل ناجح.

الاختبارات المستهدفة التي شُغلت، دون full suite أو بيانات حقيقية:

```sh
pnpm exec vitest run \
  server/pdf-renderer.test.ts \
  server/pdf-renderer-security.test.ts \
  server/safe-remote-image.test.ts \
  server/safe-remote-image-transport.test.ts \
  server/work-version-report-renderer.test.ts \
  server/work-version-docx-renderer.test.ts \
  server/work-version-cross-output.test.ts \
  server/upload-scanner.test.ts --reporter=verbose
```

النتيجة: **84/85 passed** في هذه المجموعة؛ فشل اختبار واحد فقط لأن `server/pdf-renderer-security.test.ts` ما زال يبحث نص route قديمًا (`app.post(...requireAuthenticatedUser, exportRateLimit`) بينما route الحالي يمر عبر `httpBodyAdmission` قبل auth. هذا فشل عقد/اختبار موجود في working tree، وليس تغييرًا أدخله تحديث Puppeteer، ولم أعدّل الملف خارج الملكية.

وشُغلت مجموعة admission/security الأوسع:

```sh
pnpm exec vitest run \
  server/_core/http-body-admission.test.ts \
  server/http-security.test.ts \
  server/render-limits.test.ts \
  server/safe-remote-image.test.ts \
  server/safe-remote-image-transport.test.ts \
  server/pdf-renderer.test.ts \
  server/pdf-renderer-security.test.ts --reporter=dot
```

النتيجة: **66/69 passed**؛ إخفاقات admission الحالية هي توقع `413` مقابل `400` وتوقع إغلاق chunked مختلف، إضافة إلى نفس source-string assertion القديم. لا يوجد claim بأن هذه المجموعة أغلقت HTTP gate.

## audit وCI status

تقرير `pnpm audit --prod --json` بعد التحديث أعاد exit code `1` بسبب advisory منخفض واحد بمسارين، مع counts: `critical=0`, `high=0`, `moderate=0`, `low=2`. لم تعد advisories high الخاصة بـ`extract-zip` أو high الخاصة بـZod 3 ظاهرة.

المتبقي هو KaTeX `0.16.25` و`0.16.47` عبر `streamdown`/`mermaid`. advisory KaTeX الرسمي يحدد `<0.18.2` متأثرًا ويذكر `0.18.2` كإصدار مصحح، مع exploitability مشروطة بتلوث prototype وبإدخال HTML غير مُعقم [7]. لم أضع override إلى `0.18.2` لأن قيود المستهلكين الحالية `^0.16.x` لا تعلن ذلك التوافق، ولم أُرقِّ حزمة كبرى/غير لازمة لمجرد جعل audit صامتًا. البديل الآمن staged هو تحديث streamdown/mermaid إلى إصدارات تعلن KaTeX `0.18.2` صراحة ثم تشغيل اختبارات Markdown/math وsanitization؛ هذا خارج هذه الدفعة.

بوابة CI ليست خضراء ولا يُعلن production gate ناجحًا:

1. predicate الـhigh/critical المخصص في `.github/workflows/ci.yml` لن يرى high/critical بعد هذه الترقية، لكن raw `pnpm audit --prod` ما زال non-zero بسبب KaTeX low.
2. `pnpm check` فشل بسبب تغيير أنواع Puppeteer 25: `networkidle0`/`networkidle2` في `server/docx-renderer.ts:811` و`server/pdf-renderer.ts:185` لم تعد مقبولة في `page.setContent` حسب types الحالية. إصلاح ذلك يتطلب تعديل TypeScript في ملفات التطبيق، وهو خارج ملكية هذه الدفعة؛ هذه هي **integration note** للمالك.
3. لا يوجد claim production readiness أو CI pass. لا أعدّل imports أو TypeScript للتغطية على هذا التوافق.

## البدائل staged الآمنة

- **Puppeteer 25 المسجل هنا:** يحتفظ بالإصلاح upstream ويجتاز runtime PDF/browser probe، لكنه ينتظر تكامل مالك التطبيق لتحديث نوع `waitUntil` ثم إعادة `pnpm check`.
- **البقاء على Puppeteer 24:** يحافظ على TypeScript الحالي لكنه يعيد `extract-zip@2.0.1` و`chromium-bidi@14 -> zod@3.25.76`، لذلك ليس إغلاقًا أمنيًا.
- **patch محلي لـextract-zip أو override Zod 3 إلى 4:** غير معتمد هنا؛ advisory extract-zip لا يقدم patched release، وZod 4 يحتاج توافقًا معلنًا من المستهلك. لا تُستخدم هذه البدائل كـsilent allowlist.
- **KaTeX:** ترقية staged للمستهلكين إلى إصدارات تعلن `0.18.2`، ثم اختبار rendering/sanitization؛ لا override غير معلن في هذه الدفعة.

## مصادر

[1]: https://github.com/puppeteer/puppeteer/releases "Puppeteer official releases"
[2]: https://registry.npmjs.org/%40puppeteer%2Fbrowsers/3.2.7 "@puppeteer/browsers 3.2.7 npm manifest"
[3]: https://github.com/advisories/GHSA-jmr9-qjv8-65gv "extract-zip unvalidated symlink path traversal advisory"
[4]: https://github.com/advisories/GHSA-7pqw-9j4j-h8q3 "extract-zip arbitrary file write advisory"
[5]: https://registry.npmjs.org/chromium-bidi/157.0.8090-0 "chromium-bidi 157.0.8090-0 npm manifest"
[6]: https://pptr.dev/guides/installation "Puppeteer installation and browser download guide"
[7]: https://github.com/advisories/GHSA-238p-pmpm-9mq7 "KaTeX prototype pollution advisory"
[8]: https://github.com/GoogleChromeLabs/chromium-bidi/issues/3571 "Chromium BiDi Zod v4 compatibility discussion"

## تحديث التكامل النهائي — 19 نوفمبر 2026

أُصلح توافق Puppeteer 25 في renderers العامة باستخدام انتظار load، مع بقاء انتظار الخطوط والشبكة المحدود. الحد الأدنى النهائي لـNode هو `22.12.0` ضمن السلسلة 22. نجح TypeScript والبناء ورحلة التقرير عبر PDF وWord وQR. الاختبارات المصدرية القديمة أعيد ربطها بالعقد الجديد ولم تُلغَ شروطها الأمنية. فحص production بقي `critical/high/moderate=0, low=2`; الأمر الخام audit ليس exit=0، وبوابة CI المعلنة تحجب critical/high فقط. سجل الإخفاقات أعلاه يصف الفحص الجزئي السابق؛ النتيجة المتكاملة في [RESULTS.md](RESULTS.md).
