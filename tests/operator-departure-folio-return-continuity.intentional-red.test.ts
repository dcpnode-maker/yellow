import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 222 intentional red requires exact departure-to-Folio return continuity", () => {
  const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

  expect(script).toContain("function departureFolioReturnIsCurrent(");
  expect(script).toContain("function openDepartureFolioWorkspace(");
  expect(script).toContain("function returnFromFolioWorkspaceToDeparture(");
  expect(css).toContain(".folio-departure-return");
});
