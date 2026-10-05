import { expect, test } from "bun:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const cssFile = resolve(root, "src/http/operator/operator.css");

test("public reference shell keeps the operator canvas white, hierarchy navy and actions Yellow", async () => {
  const css = await Bun.file(cssFile).text();
  const finalCascade = css.slice(css.lastIndexOf("/* Public reference authority"));
  expect(finalCascade).toContain("--paper:#fff");
  expect(finalCascade).toContain("--nav:#112b4d");
  expect(finalCascade).toContain("--accent:#e0b817");
  expect(css).toContain(".ambient-stage { display:none; }");
  expect(finalCascade).toContain(".primary,.invoice-workbench__print");
});

test("mobile uses the existing governed workspace controls as a bottom dock and retains Overwatch entry", async () => {
  const css = await Bun.file(cssFile).text();
  expect(css).toMatch(/@media \(max-width:767px\)[\s\S]*?\.domain-bar \{[^}]*position:fixed[^}]*bottom:0[^}]*top:auto/);
  expect(css).toContain(".workspace-navigation-disclosure[open] > .domain-nav,.domain-nav { display:flex!important;");
  expect(css).toMatch(/\.jarvis-launch \{[^}]*bottom:4\.45rem[^}]*border-radius:50%[^}]*font-size:0/);
  expect(css).toContain(".workspace-group,.workspace-group[open],.workspace-group-items { display:contents!important; }");
});
