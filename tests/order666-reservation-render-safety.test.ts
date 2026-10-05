import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("reservation loading-to-detail rendering keeps the same top-level hooks", () => {
  const path = resolve(import.meta.dir, "../frontend/yellow/src/workspaces/ReservationWorkspace.tsx");
  const source = readFileSync(path, "utf8");
  const start = source.indexOf("function ReservationWorkspace(");
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("\nfunction ", start + 1);
  expect(end).toBeGreaterThan(start);
  const component = source.slice(start, end);
  const loadingReturn = component.indexOf("if (detail.isLoading)");
  expect(loadingReturn).toBeGreaterThan(0);
  // This focused guard protects the known loading branch. The release browser
  // proof additionally exercises the actual loading -> loaded transition.
  const hooks = [...component.matchAll(/\buse(?:Memo|State|Effect|Ref|Query|Queries|QueryClient)\s*\(/g)];
  expect(hooks.length).toBeGreaterThan(0);
  expect(hooks.filter((hook) => hook.index > loadingReturn).map((hook) => hook[0])).toEqual([]);
});
