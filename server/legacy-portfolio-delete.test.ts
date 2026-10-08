import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { getTableName, type SQL } from "drizzle-orm";

const adapter = vi.hoisted(() => ({ db: null as any }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => adapter.db }));
import { deletePortfolio } from "./db";

type Row = { id: number; userId?: number; portfolioId?: number };
type State = Record<string, Row[]>;
const dialect = new MySqlDialect();
let state: State;
let failAt: string | undefined;
let deletes: string[];
let locks: string[];

// Deliberately stateful adapter: exercise the real repository function, including
// authorization, table scope and error propagation. Not a live MySQL integration
// test; transaction rollback/locking semantics still need a database CI gate.
beforeEach(() => {
  process.env.DATABASE_URL = "mysql://test:test@localhost/test";
  state = {
    portfolios: [{ id: 1, userId: 10 }, { id: 2, userId: 20 }],
    uploaded_files: [{ id: 11, portfolioId: 1 }, { id: 12, portfolioId: 2 }],
    evidence_comments: [{ id: 21, portfolioId: 1 }, { id: 22, portfolioId: 2 }],
    share_links: [{ id: 31, portfolioId: 1 }, { id: 32, portfolioId: 2 }],
  };
  failAt = undefined;
  deletes = [];
  locks = [];
  adapter.db = {
    transaction: async (run: (tx: any) => Promise<unknown>) => {
      const draft = structuredClone(state);
      const tx = {
        select: () => ({ from: () => ({ where: (condition: SQL) => ({ limit: () => ({
          for: async (lock: string) => {
            locks.push(lock);
            const [id, userId] = dialect.sqlToQuery(condition).params;
            return draft.portfolios.filter(row => row.id === id && row.userId === userId);
          },
        }) }) }) }),
        delete: (table: Parameters<typeof getTableName>[0]) => ({ where: async (condition: SQL) => {
          const name = getTableName(table);
          deletes.push(name);
          if (name === failAt) throw new Error("injected delete failure");
          const [id, userId] = dialect.sqlToQuery(condition).params;
          draft[name] = draft[name].filter(row => name === "portfolios"
            ? !(row.id === id && row.userId === userId)
            : row.portfolioId !== id);
        } }),
      };
      const result = await run(tx);
      state = draft; // Commit only when the real callback completes successfully.
      return result;
    },
  };
});

describe("deletePortfolio authorization and atomic deletion", () => {
  it.each([[1, 20], [999, 10]])("does not delete any rows for portfolio %i requested by user %i", async (id, userId) => {
    const before = structuredClone(state);
    await expect(deletePortfolio(id, userId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(deletes).toEqual([]);
    expect(state).toEqual(before);
  });

  it("deletes only the owner's parent and children after locking the parent", async () => {
    await expect(deletePortfolio(1, 10)).resolves.toEqual({ success: true });
    expect(locks).toEqual(["update"]);
    expect(deletes).toEqual(["uploaded_files", "evidence_comments", "share_links", "portfolios"]);
    expect(state).toEqual({
      portfolios: [{ id: 2, userId: 20 }],
      uploaded_files: [{ id: 12, portfolioId: 2 }],
      evidence_comments: [{ id: 22, portfolioId: 2 }],
      share_links: [{ id: 32, portfolioId: 2 }],
    });
  });

  it.each(["evidence_comments", "share_links", "portfolios"])("propagates failure at %s so the transaction does not commit earlier deletes", async (table) => {
    failAt = table;
    const before = structuredClone(state);
    await expect(deletePortfolio(1, 10)).rejects.toThrow("injected delete failure");
    expect(deletes.length).toBeGreaterThan(1);
    expect(state).toEqual(before);
  });
});
