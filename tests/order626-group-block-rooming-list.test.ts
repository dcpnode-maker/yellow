import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const service = readFileSync("src/contexts/reservations/group-blocks.ts", "utf8");
const operator = readFileSync("src/http/operator.ts", "utf8");
const api = readFileSync("frontend/yellow/src/yellow-api.tsx", "utf8");
const workspace = readFileSync("frontend/yellow/src/workspaces/ReservationWorkspace.tsx", "utf8");
const css = readFileSync("frontend/yellow/src/styles.css", "utf8");

test("Order 626 group blocks expose a rooming-list pickup drilldown", () => {
  expect(service).toContain("export interface GroupBlockRoomingListRow");
  expect(service).toContain("rooming_list AS MATERIALIZED");
  expect(service).toContain("CROSS JOIN LATERAL generate_series");
  expect(service).toContain("reservation.confirmation_no");
  expect(service).toContain("primaryGuestDisplayName");
  expect(service).toContain("pickedUpNights");
  expect(service).toContain("roomingList: roomingListRows(row.rooming_list)");

  expect(operator).toContain("roomingList: group.roomingList.map");
  expect(operator).toContain("reservationId: row.reservationId");

  expect(api).toContain("type GroupBlockRoomingListRow");
  expect(api).toContain("roomingList: readonly GroupBlockRoomingListRow[]");

  expect(workspace).toContain("Rooming list / pickup");
  expect(workspace).toContain("group.roomingList.slice(0, 6)");
  expect(workspace).toContain("window.location.assign(`/p/${propertyId}/res/${row.reservationId}`)");
  expect(workspace).toContain("Open reservation ${row.confirmationNo}");

  expect(css).toContain(".group-block-rooming-list");
  expect(css).toContain(".group-block-rooming-row");
  expect(css).toContain(".group-block-rooming-row { grid-template-columns: minmax(0, 1fr); }");
});
