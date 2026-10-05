import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order386 intentional red: bounded owner-trust workbench is a first-class operator surface", () => {
  const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
  const js = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
  expect(html).toContain('id="trust-view"');
  expect(html).toContain('id="trust-account"');
  expect(html).toContain('id="trust-preview"');
  expect(html).toContain('id="trust-approval-inbox"');
  expect(js).toContain("loadTrustWorkbench");
  expect(js).toContain("trustRequestGeneration");
  expect(js).toContain("trustMutationKeys");
  expect(css).toContain(".trust-workbench");
});
