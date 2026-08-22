import { expect, test } from "bun:test";

const LEGACY_SQL_WORD_GUARD = /\b(?:SELECT|INSERT|UPDATE|DELETE)\s/i;

test("Order 074 P0: the inherited browser SQL-word guard is red on ordinary UI copy", async () => {
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  expect(script).toContain("Save or select a draft before previewing.");
  expect(script).not.toMatch(LEGACY_SQL_WORD_GUARD);
});
