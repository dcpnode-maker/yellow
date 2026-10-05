import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("frontend/yellow/src/App.tsx", "utf8");
const workspace = source.slice(source.indexOf("function HousekeepingWorkspace("), source.indexOf("type DepartmentPerformanceMatrixProps"));

test("active housekeeping mounts observed discrepancies against current loaded rooms", () => {
  expect(workspace).toContain('<HousekeepingDiscrepancyWorkbench propertyId={propertyId} getToken={session} rooms={rooms}');
  expect(workspace).toContain('disabled={busy} onBusyChange={(locked)');
  expect(workspace).toContain('onLifecycleBusyChange(busy || locked)');
  expect(workspace).toContain('const refreshed = await query.refetch()');
  expect(workspace).toContain('if (refreshed.isError) throw new Error(');
  expect(workspace.match(/<HousekeepingDiscrepancyWorkbench/g)?.length).toBe(1);
});

test("housekeeping reports and physical task actions cannot overlap or unlock each other", () => {
  expect(workspace).toContain('const housekeepingBusy = busy || discrepancyBusy');
  expect(workspace).toContain('onLifecycleBusyChange(housekeepingBusy)');
  expect(workspace).toContain('if (housekeepingBusy) return');
  expect(workspace).toContain('if (!proposal || !confirmed || housekeepingBusy) return');
  expect(workspace).toContain('disabled={housekeepingBusy} onClick={() => prepare(task, action)}');
  expect(workspace).toContain('disabled={!confirmed || housekeepingBusy}');
  expect(workspace).not.toContain('disabled={housekeepingBusy} onBusyChange={setDiscrepancyBusy}');
});

test("condition refetch failures retain the workbench and its unresolved operation key", () => {
  expect(workspace).toContain('if (query.isError && !query.data)');
  expect(workspace).not.toContain('if (query.isError)');
  expect(workspace).toContain('The last loaded rooms remain visible');
});
