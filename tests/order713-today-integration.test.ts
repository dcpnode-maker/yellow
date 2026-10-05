import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Wiring regression guards; loader tests execute transport/date behavior and
// release QA verifies the rendered live data. No hotel data is mutated here.
const source = readFileSync("frontend/yellow/src/App.tsx", "utf8");
const app = source.slice(source.indexOf("export function App()"));
const today = app.slice(app.indexOf('<section className={`workspace${activeLane'));

test("Today movement ribbon, table and dashboard share canonical phase responses", () => {
  expect(app).toContain('queryKey: ["today", propertyId, "business-day"]');
  expect(app).toContain('queryFn: () => todayBusinessDayLoader.loadToday()');
  expect(today).toContain('todayMovementLanes.find((item) => item.status === activeLane)?.lane');
  expect(today).toContain('items={todayMovementLanes.map');
  for (const phase of ["arrival", "departure", "in_house"]) {
    expect(today).toContain(`todayPhaseQuery.data?.${phase}.reservations.length`);
  }
  expect(today).toContain('lane={movementError ? undefined : lane}');
  expect(today).toContain('todayPhaseQuery.isPending || todayPhaseQuery.isError ? null');
  expect(today).toContain('includes arrivals already checked in today');
  expect(today).toContain('Guest movements · business day ${todayPhaseQuery.data.businessDate}');
  expect(today).not.toContain('value: dueInQuery.data');
  expect(today).not.toContain('value: dueOutQuery.data');
});

test("past-due access is explicit, timezone scoped and rejects a changed business day", () => {
  expect(app).toContain('movementScope === "past_due" && (activeLane === "due_in" || activeLane === "due_out")');
  expect(app).toContain('loadPastDue(activeLane === "due_in" ? "arrival" : "departure", selected.timezone)');
  expect(app).toContain('result.businessDate !== todayPhaseQuery.data?.businessDate');
  expect(today).toContain('aria-label="Movement date scope"');
  expect(today).toContain('className="movement-date-scope"');
  expect(today).toContain('className="movement-date-refresh" aria-label="Refresh movements"');
  expect(today).toContain('onClick={() => setMovementScope("past_due")}>Past due');
  expect(today).toContain('Past due · before');
  expect(today).toContain('`${item.label} · past due`');
  expect(today).toContain('movementError || movementLoading ? null : pastDueQuery.data?.reservations.length ?? null');
  expect(today).toContain('Refresh movements');
  expect(today).toContain('propertyQuery.isError || (!propertyQuery.isPending && !selected?.timezone)');
  expect(today).toContain('todayPhaseQuery.error ?? metadataError');
  expect(today).toContain('await propertyQuery.refetch()');
  expect(today).toContain('key={`${activeLane}:${movementScope}`}');
  const navigation = app.slice(app.indexOf('const openOperationalTable'), app.indexOf('const cancelSpeech'));
  expect(navigation.match(/setMovementScope\("today"\)/g)?.length).toBe(2);
});

test("loading or failed movement reads never render a false zero in controls or footer", () => {
  const start = source.indexOf('function MovementGrid(');
  const grid = source.slice(start, source.indexOf('/* Order584 extracted', start));
  expect(grid).toContain('{!loading && !error ? <MovementTableControls');
  expect(grid).toContain('{!loading && !error ? <footer className="movement-footer"');
  expect(grid).toContain('error ? "Reservations unavailable"');
});

test("operational and assistant status queues are preserved and phase data is invalidated after writes", () => {
  expect(app).toContain('queryFn: () => loadLane("due_in")');
  expect(app).toContain('queryFn: () => loadLane("due_out")');
  expect(app).toContain('queryFn: () => loadLane("in_house")');
  expect(app).toContain('...(dueInQuery.data?.reservations ?? [])');
  expect(app).toContain('...(dueOutQuery.data?.reservations ?? [])');
  expect(app).toContain('if (wasBusy && !busy) void queryClient.invalidateQueries({ queryKey: ["today", propertyId] })');
  expect(app.match(/invalidateQueries\(\{ queryKey: \["today", propertyId, "business-day"\]/g)?.length).toBe(2);
  expect(app.match(/invalidateQueries\(\{ queryKey: \["today", propertyId, "past-due"\]/g)?.length).toBe(2);
});
