import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { HousekeepingFloorWorkbench } from "../frontend/yellow/src/workspaces/HousekeepingFloorWorkbench";
import { HousekeepingTaskDashboard } from "../frontend/yellow/src/workspaces/HousekeepingTaskDashboard";

test("floor workbench mounts one stable task table surface even before evidence loads", () => {
  const html = renderToString(createElement(HousekeepingFloorWorkbench, { propertyId: "synthetic", timezone: "UTC", getToken: async () => "synthetic", onPrepare() {} }));
  expect(html.match(/class="hk-task-dashboard"/g)?.length).toBe(1);
  expect(html).toContain("Loading current task evidence");
  expect(html).not.toContain("No current tasks are listed");
  expect(html).not.toContain('aria-label="Loaded room conditions"');
});

test("unavailable evidence cannot be rendered as a verified empty task result", () => {
  const props = { rooms: [], tasks: [], disabled: true, actionLabel: (a: string) => a, onPrepare() {}, evidenceState: "unavailable" as const, showSummary: false };
  const html = renderToString(createElement(HousekeepingTaskDashboard, props));
  expect(html).toContain("Current task evidence is unavailable");
  expect(html).not.toContain("0 of 0");
  expect(html).not.toContain("No current tasks are listed");
});
