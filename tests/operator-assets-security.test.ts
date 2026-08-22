import { expect, test } from "bun:test";

import { BROWSER_SQL_SYNTAX } from "./helpers/browser-asset-security";

const LEGACY_SQL_WORD_GUARD = /\b(?:SELECT|INSERT|UPDATE|DELETE)\s/i;
const ORDINARY_UI_COPY = "Save or select a draft before previewing.";

test("Order 074 P0/P1: SQL syntax is rejected without treating ordinary UI copy as SQL", async () => {
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  expect(script).toContain(ORDINARY_UI_COPY);
  expect(ORDINARY_UI_COPY).toMatch(LEGACY_SQL_WORD_GUARD);
  expect(ORDINARY_UI_COPY).not.toMatch(BROWSER_SQL_SYNTAX);
  for (const sql of [
    "SELECT tenant_id, code FROM rate_plan",
    "INSERT INTO rate_plan (id) VALUES ('x')",
    "UPDATE rate_plan SET code = 'x'",
    "UPDATE rate_plan WHERE id = 'x'",
    "DELETE FROM rate_plan WHERE id = 'x'",
    "DELETE rate_plan WHERE id = 'x'",
  ]) {
    expect(sql).toMatch(BROWSER_SQL_SYNTAX);
  }
  expect(script).not.toMatch(BROWSER_SQL_SYNTAX);
});
