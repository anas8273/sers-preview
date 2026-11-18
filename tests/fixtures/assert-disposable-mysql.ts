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
