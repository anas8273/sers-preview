import { sql } from "drizzle-orm";
import { academicTerms, academicYears, workItems } from "../../drizzle/domain-core";

const CI_DATABASE = "mysql://root:root@127.0.0.1:3306/sers_test";
const LOCAL_DATABASE = "mysql://root:sers-loopback-test-only@127.0.0.1:3307/sers_test";

/** Never infer test permission from NODE_ENV or from a managed project DSN. */
export function assertDisposableMySQL(env: NodeJS.ProcessEnv = process.env): void {
  const ci = env.GITHUB_ACTIONS === "true" && env.DATABASE_URL === CI_DATABASE;
  const local = env.SERS_DISPOSABLE_LOCAL_MYSQL === "1" && env.DATABASE_URL === LOCAL_DATABASE;
  if (env.SERS_INTEGRATION !== "1" || (!ci && !local)) {
    throw new Error("Refusing a non-disposable MySQL database: explicit CI or isolated local test permission required");
  }
}

/** Reuse the already-authorized disposable server without switching ports. */
export function disposableMySQLConnectionOptions(env: NodeJS.ProcessEnv = process.env) {
  assertDisposableMySQL(env);
  const dsn = new URL(env.DATABASE_URL!);
  return {
    host: dsn.hostname,
    port: Number(dsn.port),
    user: decodeURIComponent(dsn.username),
    password: decodeURIComponent(dsn.password),
    database: dsn.pathname.slice(1),
  };
}

/** Clear academic fixtures only after proving this is the isolated test database. */
export async function clearDisposableAcademicFixtures(db: any): Promise<void> {
  assertDisposableMySQL();
  await db.update(workItems)
    .set({ academicYearId: null, academicTermId: null, academicContext: null })
    .where(sql`academicYearId IS NOT NULL OR academicTermId IS NOT NULL`);
  await db.delete(academicTerms);
  await db.delete(academicYears);
}
