import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { filterGroupSearchRows } from "../frontend/yellow/src/workspaces/reservation-search";

const P = "6081b544-22a1-534f-a86d-bb1ae0519e14";
Object.defineProperty(globalThis, "window", { configurable: true, value: { innerHeight: 900, location: { pathname: `/p/${P}/reservations`, search: "", hash: "" } } });
const { ReservationBoardWorkspace } = await import("../frontend/yellow/src/workspaces/ReservationWorkspace");
const rows = [{ reservationId: "one", confirmationNo: "Y-101", primaryGuestDisplayName: "A <script> guest", status: "due_in", operationalState: "expected_arrival", stayFrom: "2026-10-02T14:00:00Z", stayTo: "2026-10-04T10:00:00Z", unitTypeLabel: "Villa", channelCode: "airbnb" }];
function render(search: string) {
  window.location.search = search;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["reservation-board", P], { reservations: rows });
  client.setQueryData(["reservation-journey", P, "arrival"], { reservations: rows, businessDate: "2026-09-17" });
  client.setQueryData(["reservation-group-search", P, ""], { groups: [{ groupId: "00000000-0000-4000-8000-000000000004", name: "Synthetic group <script>", code: "GRP-1", kind: "linked", status: "active", memberCount: 2, roomsHeldByGroup: false }], nextCursor: "more" });
  try { return renderToString(createElement(QueryClientProvider, { client }, createElement(ReservationBoardWorkspace, { timezone: "UTC", onCrsContinue() {} }))); }
  finally { client.clear(); }
}
test("actual Individual board opens to search and returned rows without mounting group workbenches", () => {
  const html = render("");
  expect(html).toContain("Y-101"); expect(html).toContain("A &lt;script&gt; guest");
  expect(html).not.toContain('class="group-reservation-workspace"'); expect(html).not.toContain("Create linked group");
  expect(html).toContain('aria-label="New reservation"');
  for (const label of ["Individual", "Groups", "Calendar", "Pre-arrival", "Arrival", "In house", "Departure", "Post departure", "All reservations"]) expect(html).toContain(label);
  expect(html).toContain('aria-label="Reservation phases"');
  expect(html).toContain("Business date 2026-09-17");
  for (const control of ['aria-label="Search Arrival"', "Dictate Search Arrival", "Reset table controls", 'aria-label="Filter"', 'aria-label="Sort', 'aria-label="Columns']) expect(html).toContain(control);
  expect(html).not.toContain("<script>");
});
test("explicit All keeps the legacy board cache and shared search without inventing a business date", () => {
  const html = render("?stage=all");
  expect(html).toContain("Y-101"); expect(html).toContain("A &lt;script&gt; guest");
  expect(html).toContain('aria-label="Search All reservations"');
  expect(html).toContain("All recorded reservations");
  expect(html).not.toContain("Business date 2026-09-17");
  expect(html).not.toContain("Create linked group");
});
test("Groups selects a group search board without mislabelling individual rows as groups", () => {
  const html = render("?view=groups");
  expect(html).toContain("Search groups"); expect(html).not.toContain("Y-101");
  expect(html).toContain("Group management and room blocks");
  expect(html).not.toContain("Create linked group");
  expect(html).toContain("Synthetic group &lt;script&gt;"); expect(html).not.toContain("<script>");
  expect(html).toContain("GRP-1"); expect(html).toContain("matching groups in the returned page");
  expect(html).toContain("More groups exist");
});
test("a direct selected-group URL mounts the retained group commands only in Groups", () => {
  const id = "00000000-0000-4000-8000-000000000004";
  expect(render(`?view=groups&group=${id}`)).toContain("Create linked group");
  expect(render(`?group=${id}`)).not.toContain("Create linked group");
});
test("malformed selected group links mount the retained link error handler", () => {
  expect(render("?view=groups&group=bad")).toContain("Create linked group");
  expect(render("?view=groups&group=bad")).not.toContain("Y-101");
});
test("group page selectors use actual header fields without inferring membership from reservations", () => {
  const a = { groupId: "a", name: "A", code: "1", kind: "linked" as const, status: "active", memberCount: 1, roomsHeldByGroup: false as const };
  const b = { ...a, groupId: "b", kind: "block" as const, status: "closed" };
  expect(filterGroupSearchRows([a,b], "", "")).toEqual([a,b]);
  expect(filterGroupSearchRows([a,b], "active", "linked")).toEqual([a]);
  expect(filterGroupSearchRows([a,b], "active", "block")).toEqual([]);
  expect(filterGroupSearchRows([a,b], "invented", "")).toEqual([]);
});
