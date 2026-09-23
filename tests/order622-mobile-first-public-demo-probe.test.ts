import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const probe = readFileSync("tools/probe-mobile-public-demo.ts", "utf8");

test("mobile public demo probe checks safe-area bottom navigation", () => {
  expect(probe).toContain(".mobile-nav");
  expect(probe).toContain("env(safe-area-inset-bottom)");
  expect(probe).toContain("compactCss");
  expect(probe).toContain("grid-template-columns:repeat(7,minmax(0,1fr))");
});

test("mobile public demo probe checks containment and demo-path scrolling", () => {
  expect(probe).toContain("overflow-x:hidden");
  expect(probe).toContain(".today-demo-path-grid");
  expect(probe).toContain("overflow-x:auto");
  expect(probe).toContain("scroll-snap-type:xproximity");
});

test("mobile public demo probe checks Overwatch and confirmation-gated copy", () => {
  expect(probe).toContain(".yellow-launch");
  expect(probe).toContain("Ask Yellow in Indian English/Hindi");
  expect(probe).toContain("explicit confirmation before actions");
  expect(probe).toContain("requiresConfirmation");
});

test("mobile public demo probe is read-only", () => {
  expect(probe).not.toMatch(/\bPOST\b|\bPUT\b|\bPATCH\b|\bDELETE\b|method:/);
});
