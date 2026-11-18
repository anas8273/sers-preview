import { describe, expect, it } from "vitest";
import { assertDisposableMySQL } from "../tests/fixtures/assert-disposable-mysql";

describe("disposable MySQL test permissions", () => {
  it("accepts only the known CI or explicitly permitted local fixture DSN", () => {
    expect(() => assertDisposableMySQL({ SERS_INTEGRATION: "1", GITHUB_ACTIONS: "true", DATABASE_URL: "mysql://root:root@127.0.0.1:3306/sers_test" })).not.toThrow();
    expect(() => assertDisposableMySQL({ SERS_INTEGRATION: "1", SERS_DISPOSABLE_LOCAL_MYSQL: "1", DATABASE_URL: "mysql://root:sers-loopback-test-only@127.0.0.1:3307/sers_test" })).not.toThrow();
  });
  it("rejects a managed or production DSN despite CI, test, or integration labels", () => {
    for (const DATABASE_URL of ["mysql://root:root@production:3306/sers_test", "mysql://root:root@127.0.0.1:3306/sers", "mysql://root:root@127.0.0.1:3307/sers_test"]) {
      expect(() => assertDisposableMySQL({ DATABASE_URL, SERS_INTEGRATION: "1", GITHUB_ACTIONS: "true", SERS_DISPOSABLE_LOCAL_MYSQL: "1", NODE_ENV: "test" })).toThrow("non-disposable");
    }
  });
  it("requires explicit permission instead of automatically trusting a local host", () => {
    expect(() => assertDisposableMySQL({ SERS_INTEGRATION: "1", DATABASE_URL: "mysql://root:sers-loopback-test-only@127.0.0.1:3307/sers_test" })).toThrow();
    expect(() => assertDisposableMySQL({ GITHUB_ACTIONS: "true", DATABASE_URL: "mysql://root:root@127.0.0.1:3306/sers_test" })).toThrow();
  });
});
