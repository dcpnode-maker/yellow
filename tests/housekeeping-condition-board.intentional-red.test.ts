import { expect, test } from "bun:test";

test("Order 208 intentional red: governed room-condition read and human board are absent", async () => {
  const domain = await Bun.file("src/contexts/housekeeping/tasks.ts").text();
  const app = await Bun.file("src/app.ts").text();
  const html = await Bun.file("src/http/operator/index.html").text();
  const script = await Bun.file("src/http/operator/operator.js").text();

  expect(domain).toContain("async listConditions(");
  expect(domain).toContain('COLLATE "C"');
  expect(app).toContain("/housekeeping/conditions");
  expect(html).toContain('id="housekeeping-condition-board"');
  expect(html).toContain('id="housekeeping-condition-filter"');
  expect(html).toContain('id="housekeeping-condition-list"');
  expect(html).toContain('id="housekeeping-condition-status"');
  expect(script).toContain("housekeepingConditionRequestGeneration");
  expect(script).toContain("/housekeeping/conditions?");
});
