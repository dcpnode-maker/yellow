import { expect, test } from "bun:test";

test("the real Overwatch entry uses the existing state setter, not an undefined callback", async () => {
  const source = await Bun.file("frontend/yellow/src/App.tsx").text();
  expect(source).not.toContain("setAssistantOpen(");
  expect(source).toContain('status: "Docked assistant", onOpen: () => setAssistant(true)');
});

test("a missing governed statement preserves the folio but emits no invented posting row", async () => {
  const source = await Bun.file("frontend/yellow/src/workspaces/ReservationWorkspace.tsx").text();
  const start = source.indexOf("for (const folio of reservation.folios)");
  const end = source.indexOf("for (const alert of reservation.alerts)", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const loop = source.slice(start, end);
  const folio = loop.indexOf('kind: "folio"');
  const missing = loop.indexOf("if (!statement) continue;");
  const rows = loop.indexOf("for (const row of statement.rows)");
  expect(missing).toBeGreaterThan(folio);
  expect(rows).toBeGreaterThan(missing);
  expect(loop).toContain("statement.folio.currency");
});
