import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
const css=readFileSync(new URL("../frontend/yellow/src/workspaces/host-reservation-calendar.css",import.meta.url),"utf8");
test("host page retains document vertical scroll and seven equal columns at narrow widths",()=>{
  expect(css).toContain("overflow-x:clip; overflow-y:visible");
  expect(css).toContain("grid-template-columns:repeat(7,minmax(0,1fr))");
  expect(css).not.toMatch(/\.host-calendar\s*\{[^}]*overflow-y\s*:\s*(auto|scroll)/);
  expect(css).toContain("--host-accent:#b6ff00");
  expect(css).not.toMatch(/text-decoration\s*:\s*line-through/);
});
test("local sheet has bounded scrolling, safe-area placement and visible focus while Year keeps three columns",()=>{
  expect(css).toContain("max-height:min(calc(100dvh - 240px),560px)");
  expect(css).toContain("env(safe-area-inset-bottom,0px)");
  expect(css).toContain("overscroll-behavior:contain");
  expect(css).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
  expect(css).toContain("prefers-reduced-motion:no-preference");
  expect(css).toContain(":focus-visible");
});
