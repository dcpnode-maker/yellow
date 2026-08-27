import { expect, test } from "bun:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const cssFile = resolve(root, "src/http/operator/operator.css");
const scriptFile = resolve(root, "src/http/operator/operator.js");

test("Order195: desktop disclosure is an anchored overlay rather than a reflowing grid", async () => {
  const [css, script] = await Promise.all([Bun.file(cssFile).text(), Bun.file(scriptFile).text()]);
  const desktopStart = css.indexOf("@media (min-width: 1021px)");
  const desktop = css.slice(desktopStart, css.indexOf("@media (max-width: 767px)", desktopStart));
  expect(desktop).toMatch(/\.secondary-workspaces:not\(\[hidden\]\)\s*\{[^}]*position:\s*absolute/);
  expect(desktop).toMatch(/\.secondary-workspaces:not\(\[hidden\]\)\s*\{[^}]*top:\s*calc\(100% \+ 8px\)/);
  expect(script).toContain('event.key !== "Escape"');
  expect(script).toContain('secondaryWorkspacesToggle.focus()');
});

test("Order195: Win95 uses explicit grid areas so the active window cannot auto-place below the sidebar", async () => {
  const css = await Bun.file(cssFile).text();
  expect(css).toMatch(/data-theme="win95"\] \.workbench \{[^}]*grid-template-areas:\s*"nav chrome" "nav head" "nav content"/);
  expect(css).toMatch(/data-theme="win95"\] \.win-window-chrome \{[^}]*grid-area:\s*chrome/);
  expect(css).toMatch(/data-theme="win95"\] \.workbench-head \{[^}]*grid-area:\s*head/);
  expect(css).toMatch(/data-theme="win95"\] \.workbench > section:not\(\.login-layout\) \{[^}]*grid-area:\s*content/);
});
