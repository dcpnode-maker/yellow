import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("phone users retain manual navigation to core PMS workspaces", () => {
  expect(app).toContain('aria-label="Mobile PMS navigation"');
  expect(app).toContain("Open Today");
  expect(app).toContain("Open Reservations");
  expect(app).toContain("Open Guests");
  expect(app).toContain("Open Cashier and folios");
  expect(app).toContain('aria-label="Activate Yellow"');
  expect(app).toContain('aria-current={workspacePart === "today" ? "page" : undefined}');
  expect(css).toContain(".mobile-nav button.active");
  expect(css).toContain(".mobile-nav {\n    position: fixed;");
  expect(css).toContain(".yellow-launch { right: 14px; bottom: 75px;");
  expect(app).toContain("function PmsIcon");
  expect(app).toContain('<PmsIcon name="today" />');
  expect(app).toContain('<PmsIcon name="yellow" />');
  expect(app).not.toContain("<span>◷</span>");
  expect(app).not.toContain("<span>▤</span>");
  expect(app).not.toContain("<span>♙</span>");
  expect(app).not.toContain("<span>▣</span>");
  expect(css).toContain("min-height: 48px;");
  expect(css).not.toContain("color: #263451;");
  expect(css).toContain(".yellow-next > .mobile-nav { position: fixed; z-index: 20; }");
});
