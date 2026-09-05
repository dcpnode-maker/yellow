import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path: string): Promise<string> {
  return readFile(new URL(path, root), "utf8");
}

describe("Order 196 intentional red proof", () => {
  test("bounded folio settlement authority is absent before implementation", async () => {
    const migration = await source("migrations/0023_folio_settlement_capability.sql");
    expect(migration).toContain("transition_folio_status");
    expect(migration).toContain("open");
    expect(migration).toContain("settled");
    expect(migration).toContain("closed");
  });

  test("operator settlement route is absent before implementation", async () => {
    const app = await source("src/app.ts");
    const operator = await source("src/http/operator.ts");
    expect(app).toContain("folios/:folioId/status");
    expect(operator).toContain("financials.folios:settle");
    expect(operator).toContain("financials.folios:close");
    expect(operator).toContain("transitionFolioStatus");
  });
});
