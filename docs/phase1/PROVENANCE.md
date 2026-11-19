# أصل دفعة إصلاح SERS

المستودع المصدر هو `anas8273/sers-preview` عند `e666157a988f10efd6dcae5e808526ae32985945`، آخر دمج #39. رُوجع رأس origin/main في 18 نوفمبر 2026 ولم يتغير عن نسخة التدقيق. PR40 المفتوح لم يُدمج ولم يُستخدم كأساس لهذه الدفعة.

مساحة `sersfix` نسخة تطوير خاصة منفصلة مُستوردة من شجرة الأصل، وGit baseline المحلي هو `dadb901ce1ebd0134abeffa1b1e32d3277d9a94b`. المستودع المُدار لهذه المساحة ليس بديلًا عن مستودع المستخدم ولا يغير repository decision الأصلي. `publishing.auto_publish=false` وقت التهيئة.

الإصلاحات النهائية ستنتقل إلى فرع `fix/foundation-gate-20261118` في مستودع المستخدم، دون merge إلى main ودون force push. حفظ checkpoint مساحة التطوير لا يعني تحديث الرابط المنشور القديم.

الاختبارات hermetic تتلقى `DATABASE_URL` فارغًا صراحة، والتكامل يحصل على DSN loopback وقاعدة `sers_test` مستقلة. لا تُطبق migrations على قاعدة مُدارة أو بيانات مدرسة. OAuth/storage/scanner/الطباعة/Word الفعلي/UAT/residency/retention/RTO تبقى بوابات قبول منفصلة حتى تُختبر فعلًا.
