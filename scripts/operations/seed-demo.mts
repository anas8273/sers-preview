import { fileURLToPath } from 'node:url';
import { and, eq } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import { users, type User } from '../../drizzle/schema';
import { academicYears, academicTerms, memberships, organizations, workItems, workVersions } from '../../drizzle/domain-core';
import { uploadQuotaBudgets } from '../../drizzle/upload-intents';
import { getDb } from '../../server/db';
import { createAcademicYearForUser } from '../../server/account-db';
import { createWorkItemForUser } from '../../server/domain-db';
import { getReportDraftForUser, saveReportDraftForUser, createReportDraftVersionForUser } from '../../server/work-report-draft-db';
import { createReviewForUser, decideReviewForUser } from '../../server/review-output-db';

export function assertDemoConfiguration(env = process.env) {
  if (env.NODE_ENV === 'production' || env.SERS_DEMO_MODE !== 'synthetic-only') throw new Error('Demo requires explicit synthetic-only mode outside production');
  const url = new URL(env.DATABASE_URL || '');
  if (url.protocol !== 'mysql:' || url.pathname !== '/sers_demo') throw new Error('Demo refuses any database except sers_demo');
  return url;
}
export async function seedDemoFixtures(): Promise<{ owner: User; reviewer: User; schoolId: number; workId: number; versionId: number }> {
  assertDemoConfiguration();
  const lock = await mysql.createConnection(process.env.DATABASE_URL!);
  let locked = false;
  try {
    const [actual] = await lock.query('SELECT DATABASE() AS name, VERSION() AS version');
    const identity = (actual as { name: string; version: string }[])[0];
    if (identity.name !== 'sers_demo' || !/^8\.4\./.test(identity.version)) throw new Error('Demo requires isolated MySQL 8.4 sers_demo');
    const [locks] = await lock.query("SELECT GET_LOCK('sers-demo-fixtures-v1',10) AS acquired");
    if (Number((locks as { acquired: number }[])[0].acquired) !== 1) throw new Error('Demo seed is already running');
    locked = true;
    const [foreign] = await lock.query("SELECT COUNT(*) AS count FROM users WHERE openId NOT IN ('sers-demo-owner','sers-demo-reviewer')");
    const [foreignSchools] = await lock.query("SELECT COUNT(*) AS count FROM organizations WHERE name <> 'SERS Demo — synthetic only'");
    if (Number((foreign as { count: number }[])[0].count) || Number((foreignSchools as { count: number }[])[0].count)) throw new Error('Demo database contains non-fixture identities or schools');
    const db = (await getDb())!;
    for (const [role, name] of [['owner', 'مالك العرض التجريبي'], ['reviewer', 'مراجع العرض التجريبي']] as const) {
      await db.insert(users).values({ openId: `sers-demo-${role}`, name, email: `${role}@sers-demo.invalid`, loginMethod: 'synthetic-demo' }).onDuplicateKeyUpdate({ set: { openId: `sers-demo-${role}` } });
    }
    const [owner] = await db.select().from(users).where(eq(users.openId, 'sers-demo-owner'));
    const [reviewer] = await db.select().from(users).where(eq(users.openId, 'sers-demo-reviewer'));
    let [school] = await db.select().from(organizations).where(eq(organizations.name, 'SERS Demo — synthetic only'));
    if (!school) {
      const [inserted] = await db.insert(organizations).values({ name: 'SERS Demo — synthetic only', settings: { synthetic: true } });
      [school] = await db.select().from(organizations).where(eq(organizations.id, Number(inserted.insertId)));
    }
    for (const [userId, role] of [[owner.id, 'owner'], [reviewer.id, 'reviewer']] as const) {
      await db.insert(memberships).values({ organizationId: school.id, userId, role, status: 'active' }).onDuplicateKeyUpdate({ set: { organizationId: school.id } });
    }
    for (const scopeKey of [`personal:${owner.id}`, `personal:${reviewer.id}`, `organization:${school.id}`]) {
      await db.insert(uploadQuotaBudgets).values({ scopeKey, limitBytes: 256 * 1024 * 1024, maxActiveIntents: 20 }).onDuplicateKeyUpdate({ set: { scopeKey } });
    }
    const scopeKey = `organization:${school.id}`, label = 'سنة العرض 2026–2027';
    let [year] = await db.select().from(academicYears).where(and(eq(academicYears.scopeKey, scopeKey), eq(academicYears.label, label)));
    if (!year) {
      const created = await createAcademicYearForUser(owner.id, { ownerType: 'organization', organizationId: school.id, label, startsOn: '2026-08-01', endsOn: '2027-07-31', terms: [{ label: 'الفصل التجريبي الأول', startsOn: '2026-08-01', endsOn: '2026-12-31' }, { label: 'الفصل التجريبي الثاني', startsOn: '2027-01-01', endsOn: '2027-07-31' }] });
      [year] = await db.select().from(academicYears).where(eq(academicYears.id, created.id));
    }
    const [term] = await db.select().from(academicTerms).where(eq(academicTerms.academicYearId, year.id)).orderBy(academicTerms.ordinal).limit(1);
    const title = 'تقرير العرض التجريبي — مبادرة القراءة';
    let [work] = await db.select().from(workItems).where(and(eq(workItems.ownerOrganizationId, school.id), eq(workItems.title, title)));
    if (!work) {
      const created = await createWorkItemForUser(owner.id, { title, type: 'report', ownerType: 'organization', organizationId: school.id, academicYearId: year.id, academicTermId: term.id });
      if (!created) throw new Error('Could not create demo report');
      [work] = await db.select().from(workItems).where(eq(workItems.id, created.id));
    }
    let [version] = await db.select().from(workVersions).where(eq(workVersions.workItemId, work.id)).orderBy(workVersions.versionNumber).limit(1);
    if (!version) {
      const current = await getReportDraftForUser(owner.id, work.id);
      const draft = await saveReportDraftForUser(owner.id, { workItemId: work.id, expectedRevision: current?.draft.revision ?? 0, templateId: 'initiative-report', themeId: 'formal', fontFamily: 'Cairo', fields: {
        summary: 'بيانات اصطناعية لشرح رحلة التقرير والشواهد والمراجعة. لا تتضمن هذه النسخة أسماء طلاب أو بيانات مدرسة حقيقية.',
        objectives: 'تجربة رفع شاهد خاص، وربطه بالتقرير، وإنشاء نسخة ثابتة، ثم مراجعتها وتصديرها.',
        audience: 'مستخدمان تجريبيان: مالك ومراجع.',
        implementation: 'ابدأ برفع ملف اصطناعي من مكتبة الشواهد، ثم أضفه إلى هذا التقرير وأنشئ نسخة جديدة للمراجعة.',
        results: 'هذه النسخة الأولية معتمدة مسبقًا لتجربة PDF وWord والمشاركة، والنسخ الجديدة تحتاج قرار المراجع.',
        recommendations: 'لا تستخدم هذا الخادم لإدخال بيانات حقيقية. أعد تشغيله لإنهاء جلسات العرض المؤقتة.',
      }, evidenceAssetIds: [] });
      const createdVersion = await createReportDraftVersionForUser(owner.id, { workItemId: work.id, expectedRevision: draft.revision, reason: 'Synthetic demonstration fixture' });
      [version] = await db.select().from(workVersions).where(eq(workVersions.id, createdVersion.id));
      const review = await createReviewForUser(owner.id, version.id, reviewer.id);
      if (!review) throw new Error('Could not create demo review');
      await decideReviewForUser(reviewer.id, review.id, 'approved', 'Synthetic fixture approval');
    }
    return { owner, reviewer, schoolId: school.id, workId: work.id, versionId: version.id };
  } finally {
    if (locked) await lock.query("SELECT RELEASE_LOCK('sers-demo-fixtures-v1')");
    await lock.end();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDemoFixtures().then(fixture => console.log(JSON.stringify({ synthetic: true, schoolId: fixture.schoolId, workId: fixture.workId, versionId: fixture.versionId })))
    .catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(async () => { const db = await getDb(); await (db as unknown as { $client: { promise(): { end(): Promise<void> } } })?.$client.promise().end(); });
}
