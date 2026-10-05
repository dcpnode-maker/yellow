import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { location: { pathname: "/p/6081b544-22a1-534f-a86d-bb1ae0519e14/reservations", search: "", href: "http://yellow.test/p/6081b544-22a1-534f-a86d-bb1ae0519e14/reservations" } },
});
const { GroupBlockWorkbenchPanel, toggleGroupBlockListExpansion, groupBlockSummaryLabel } = await import("../frontend/yellow/src/workspaces/ReservationWorkspace");
if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
else Reflect.deleteProperty(globalThis, "window");

const groupId = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const otherGroupId = "7081b544-22a1-534f-a86d-bb1ae0519e14";
const otherPropertyId = "8081b544-22a1-534f-a86d-bb1ae0519e14";
const group = (id: string) => ({
  groupId: id, code: `GRP-${id.slice(0, 4)}`, name: "Conference block", status: "tentative",
  statusDeductsInventory: false, accountPartyId: null, accountPartyName: null, cutoffDate: null,
  elastic: false, washSchedule: null, masterFolioId: null, masterFolioNo: null, masterFolioStatus: null,
  arrivalDate: "2026-10-01", departureDate: "2026-10-11", blockedRooms: 10, pickedUpRooms: 8,
  remainingRooms: 2, pickupPercent: 80, cutoffState: "not_set" as const,
  allotment: Array.from({ length: 10 }, (_, index) => ({
    unitTypeId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    unitTypeCode: `T${index + 1}`, unitTypeName: `Type ${index + 1}`, stayDate: `2026-10-${String(index + 1).padStart(2, "0")}`,
    blocked: 1, pickedUp: 1, remaining: 0, rateOverride: null,
  })),
  roomingList: Array.from({ length: 8 }, (_, index) => ({
    reservationId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    confirmationNo: `Y-${index + 1}`, primaryGuestDisplayName: `Guest ${index + 1}`, status: "reserved",
    unitTypeCode: "STD", unitTypeName: "Standard", stayFrom: "2026-10-01T15:00:00.000000Z",
    stayTo: "2026-10-02T11:00:00.000000Z", pickedUpNights: 1,
  })),
});
const groups = [group(groupId), group(otherGroupId)] as Parameters<typeof GroupBlockWorkbenchPanel>[0]["groups"];
const renderPanel = (expandedLists: ReadonlySet<string>, property = groupId) => renderToStaticMarkup(createElement(GroupBlockWorkbenchPanel, {
  loading: false, error: null, groups, propertyId: property, expandedLists, onToggleList() {},
}));
const rowCount = (html: string) => html.match(/role="row"/g)?.length ?? 0;
const roomingLinkCount = (html: string) => html.match(/class="group-block-rooming-row"/g)?.length ?? 0;

test("block lists expand independently per block, preserve compact preview, counts, and linked reservation rows", () => {
  let expanded = new Set<string>();
  const compact = renderPanel(expanded);
  expect(rowCount(compact)).toBe(18); // two allotment headers plus 8 visible rows per block
  expect(roomingLinkCount(compact)).toBe(12); // six visible reservations per block
  expect(compact.match(/Showing first 8 of 10 allotment rows\./g)).toHaveLength(2);
  expect(compact.match(/Showing first 6 of 8 picked-up reservations\./g)).toHaveLength(2);
  expect(compact.match(/aria-expanded="false"/g)).toHaveLength(4);
  expect(compact).toContain("8 reservations linked to this block");
  expect(compact).toContain('aria-controls="group-block-allotment-6081b544-22a1-534f-a86d-bb1ae0519e14"');
  expect(compact).toContain('aria-controls="group-block-rooming-list-6081b544-22a1-534f-a86d-bb1ae0519e14"');
  expect(compact).toContain('aria-label="Open reservation Y-1 for Guest 1"');
  expect(compact).not.toContain('aria-label="Open reservation Y-8 for Guest 8"');
  expect(compact).toContain("Show all (10)");
  expect(compact).toContain("Show all (8)");

  expanded = new Set(toggleGroupBlockListExpansion(expanded, groupId, groupId, "allotment"));
  const allotmentOnly = renderPanel(expanded);
  expect(rowCount(allotmentOnly)).toBe(20); // only the selected block reveals its final two rows
  expect(roomingLinkCount(allotmentOnly)).toBe(12);
  expect(allotmentOnly).toContain('aria-label="Show fewer allotment rows for GRP-6081"');
  expect(allotmentOnly).toContain('aria-expanded="true"');

  expanded = new Set(toggleGroupBlockListExpansion(expanded, groupId, groupId, "rooming-list"));
  const bothLists = renderPanel(expanded);
  expect(rowCount(bothLists)).toBe(20);
  expect(roomingLinkCount(bothLists)).toBe(14); // only the selected block reveals its final two reservation links
  expect(bothLists).toContain('aria-label="Open reservation Y-8 for Guest 8"');
  expect(bothLists).toContain('aria-label="Show fewer picked-up reservations for GRP-6081"');
  expect(bothLists.match(/aria-expanded="true"/g)).toHaveLength(2);

  expanded = new Set(toggleGroupBlockListExpansion(expanded, groupId, groupId, "allotment"));
  expanded = new Set(toggleGroupBlockListExpansion(expanded, groupId, groupId, "rooming-list"));
  expect(rowCount(renderPanel(expanded))).toBe(18);
  expect(roomingLinkCount(renderPanel(expanded))).toBe(12);

  expanded = new Set(toggleGroupBlockListExpansion(expanded, groupId, otherGroupId, "allotment"));
  expect(rowCount(renderPanel(expanded))).toBe(20);
  expect(roomingLinkCount(renderPanel(expanded))).toBe(12);
  expect(expanded.has(`${groupId}:${groupId}:allotment`)).toBe(false);
  expect(expanded.has(`${groupId}:${otherGroupId}:allotment`)).toBe(true);
  expect(rowCount(renderPanel(expanded, otherPropertyId))).toBe(18);
});

test("loading, error, and empty block states remain unchanged", () => {
  const panel = (loading: boolean, error: string | null, rows: typeof groups) => renderToStaticMarkup(createElement(GroupBlockWorkbenchPanel, {
    loading, error, groups: rows, propertyId: groupId, expandedLists: new Set<string>(), onToggleList() {},
  }));
  expect(panel(true, null, [])).toContain("Loading group block workbench…");
  const failedRefresh = panel(false, "Block data is unavailable.", groups);
  expect(failedRefresh).toContain("Block data is unavailable.");
  expect(failedRefresh).not.toContain("GRP-6081");
  expect(failedRefresh).not.toContain("Show all");
  expect(failedRefresh).toContain('aria-label="Group block totals unavailable"');
  expect(failedRefresh).toContain("<strong>—</strong>");
  expect(groupBlockSummaryLabel(false, "Block data is unavailable.", groups.length)).toBe("Block count unavailable");
  expect(groupBlockSummaryLabel(true, null, groups.length)).toBe("Loading blocks…");
  expect(groupBlockSummaryLabel(false, null, groups.length)).toBe("2 blocks");
  expect(panel(false, null, [])).toContain("No room blocks are configured for this property.");
});
