import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");

describe("schema privacy and audit invariants", () => {
  it("stores share-link passwords as hashes rather than plaintext", () => {
    expect(schema).toContain('passwordHash: varchar("passwordHash"');
    expect(schema).not.toMatch(/password:\s*(?:varchar|text)\(/);
  });

  it("keeps an audit log with actor, action, resource and timestamp", () => {
    expect(schema).toContain('mysqlTable("audit_logs"');
    expect(schema).toContain('actorUserId: int("actorUserId")');
    expect(schema).toContain('action: varchar("action"');
    expect(schema).toContain('resourceType: varchar("resourceType"');
    expect(schema).toContain('createdAt: timestamp("createdAt")');
  });

  it("does not persist full audit payloads in a generic content field", () => {
    const auditSection = schema.split('// ─── Audit Log')[1]?.split('export type AuditLog')[0] ?? "";
    expect(auditSection).not.toMatch(/content:\s*(?:text|json)\(/);
    expect(auditSection).not.toMatch(/body:\s*(?:text|json)\(/);
  });
});
