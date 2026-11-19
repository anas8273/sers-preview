import { describe, expect, it } from "vitest";
import {
  isMySqlDuplicateEntryError,
  MYSQL_DUPLICATE_ERROR_MAX_CAUSE_DEPTH,
} from "./mysql-errors";

describe("MySQL duplicate-entry error detection", () => {
  it("recognizes the raw driver code and numeric errno", () => {
    expect(isMySqlDuplicateEntryError({ code: "ER_DUP_ENTRY" })).toBe(true);
    expect(isMySqlDuplicateEntryError({ errno: 1062 })).toBe(true);
  });

  it("follows Error.cause and two wrapper layers", () => {
    const driverError = { code: "ER_DUP_ENTRY" };
    const drizzleError = new Error("query failed", { cause: driverError });
    const outerError = new Error("transaction failed", { cause: drizzleError });

    expect(isMySqlDuplicateEntryError(outerError)).toBe(true);
  });

  it("does not classify unrelated, message-only, or null values", () => {
    expect(
      isMySqlDuplicateEntryError({ code: "ER_LOCK_DEADLOCK", errno: 1213 })
    ).toBe(false);
    expect(isMySqlDuplicateEntryError({ code: "ETIMEDOUT", errno: 1205 })).toBe(
      false
    );
    expect(
      isMySqlDuplicateEntryError({ message: "ER_DUP_ENTRY: duplicate key" })
    ).toBe(false);
    expect(isMySqlDuplicateEntryError(null)).toBe(false);
    expect(isMySqlDuplicateEntryError(undefined)).toBe(false);
    expect(isMySqlDuplicateEntryError("ER_DUP_ENTRY")).toBe(false);
    expect(isMySqlDuplicateEntryError({ errno: "1062" })).toBe(false);
  });

  it("stops safely on cause cycles", () => {
    const first: { cause?: unknown } = {};
    const second = { cause: first };
    first.cause = second;

    expect(isMySqlDuplicateEntryError(first)).toBe(false);
  });

  it("uses a clear maximum cause depth", () => {
    let withinLimit: unknown = { code: "ER_DUP_ENTRY" };
    for (
      let depth = 0;
      depth < MYSQL_DUPLICATE_ERROR_MAX_CAUSE_DEPTH;
      depth += 1
    ) {
      withinLimit = { cause: withinLimit };
    }
    expect(isMySqlDuplicateEntryError(withinLimit)).toBe(true);

    let beyondLimit: unknown = { code: "ER_DUP_ENTRY" };
    for (
      let depth = 0;
      depth <= MYSQL_DUPLICATE_ERROR_MAX_CAUSE_DEPTH;
      depth += 1
    ) {
      beyondLimit = { cause: beyondLimit };
    }
    expect(isMySqlDuplicateEntryError(beyondLimit)).toBe(false);
  });

  it("does not fail when a cause getter throws", () => {
    const error = {};
    Object.defineProperty(error, "cause", {
      get() {
        throw new Error("cause unavailable");
      },
    });

    expect(isMySqlDuplicateEntryError(error)).toBe(false);
  });
});
