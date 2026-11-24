# تسليم GitHub — عائق صلاحية workflows

حُفظت دفعة الإصلاح الكاملة في مساحة التطوير الخاصة. رفض GitHub رفع الفرع الكامل لأن موصل GitHub App لا يملك صلاحية `workflows` لتعديل `.github/workflows/ci.yml`. لم نتجاوز هذه الصلاحية ولم نغير branch protection.

لإتاحة مراجعة الكود، الفرع العام الفعلي هو `fix/foundation-gate-20261118-code-review`، كـPR مسودة دون تغييرات `.github/workflows`. يبقى main الأصلي دون تغيير. تحديثات CI الكاملة محفوظة في `SERS-CI-Workflows-2026-11-19.patch` ضمن حزمة التسليم خارج المستودع.

**لا تدمج PR قبل تطبيق تحديثات CI بطريقة GitHub معتمدة ثم إعادة فحوصه.** workflows الموجودة في main لا تزال تحمل pin pnpm السابق؛ لذلك لا ينطبق نجاح الاختبارات المحلية على CI الفرع العام، ولا يُعلن GitHub CI أخضر. السكربت وDocker أصبحا يستعملان pnpm 10.18.1 وسياسة workspace، ويتطلب CI التحديث المرفق ليتوافق معهما.

خطوة الإكمال: منح وسيلة الربط المعتمدة صلاحية تحديث workflows، أو تطبيق patch على الفرع بواسطة صاحب صلاحية. مثال على نسخة عمل لهذا الفرع، بعد حفظ patch خارج المستودع:

```sh
git apply --check /path/to/SERS-CI-Workflows-2026-11-19.patch
git apply /path/to/SERS-CI-Workflows-2026-11-19.patch
git add .github/workflows
git commit -m "ci: align SERS foundation acceptance toolchain"
git push origin fix/foundation-gate-20261118-code-review
```

هذه أوامر موثقة لصاحب الصلاحية؛ لم ننفذها على GitHub عبر موصل ممنوع. تبقى بوابات OAuth/storage/UAT والقبول الإنتاجي منفصلة حتى بعد نجاح CI. Dockerfile عُدل لمواءمة القفل وlifecycle، وفُحص العقد والسلوك skip، لكن لم يُبنَ image أو يُنشر container في هذه المهمة.
