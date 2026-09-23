import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const workspace = readFileSync(resolve(root, "frontend/yellow/src/workspaces/ReservationWorkspace.tsx"), "utf8");
const css = readFileSync(resolve(root, "frontend/yellow/src/styles.css"), "utf8");

test("Order611 timeline is read-only and composed from authoritative reservation and folio reads", () => {
  expect(workspace).toContain("function reservationOperationalTimeline(");
  expect(workspace).toContain("loadFolioStatement(folio.folioId)");
  expect(workspace).toContain('kind: "posting"');
  expect(workspace).toContain('kind: "task"');
  expect(workspace).toContain('kind: "message"');
  expect(workspace).toContain('kind: "event"');
  expect(workspace).toContain("Posting rows load through the governed folio statement read; this timeline will not invent them.");
  expect(workspace).not.toContain("fetch(`/api/v1/properties/${propertyId}/operational-timeline`");
  expect(workspace).not.toContain("/timeline:");
});

test("Order611 timeline links by canonical IDs instead of display names", () => {
  for (const evidence of [
    "Reservation ID",
    "Primary Party ID",
    "Party ID",
    "Segment ID",
    "Sellable unit ID",
    "Folio ID",
    "Posting line ID",
    "Journal ID",
    "Task ID",
    "Fact ID",
  ]) expect(workspace).toContain(evidence);
  expect(workspace).toContain("duplicate names remain separate records");
  expect(workspace).toContain("Links use canonical IDs only");
  expect(workspace).not.toContain("guest.displayName ===");
});

test("Order611 timeline is bounded and truthful about unavailable domains", () => {
  expect(workspace).toContain("const compact = entries.slice(0, 18);");
  expect(workspace).toContain("Showing the latest {compact.length} timeline records");
  expect(workspace).toContain('value: segment.sellableUnitId ?? "Unavailable"');
  expect(workspace).toContain('value: statement?.generation ?? "Unavailable until statement read completes"');
  expect(workspace).toContain("task details remain governed by the task read endpoint");
});

test("Order611 timeline is contained for mobile dense evidence", () => {
  for (const selector of [
    ".operational-timeline-card",
    ".operational-timeline",
    ".timeline-entry",
    ".timeline-body code",
    ".timeline-unavailable",
  ]) expect(css).toContain(selector);
  expect(css).toContain("overflow-wrap: anywhere");
  expect(css).toContain("@media (max-width: 760px)");
  expect(css).toContain(".timeline-body dl { grid-template-columns: 1fr; }");
  expect(css).toContain("max-height: 520px");
});
