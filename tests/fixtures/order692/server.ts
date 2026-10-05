// Loopback-only, read-only Order692 stage fixture. Never proxies a request or writes hotel data.
import { resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "../../../public/yellow-next");
const property = "6081b544-22a1-534f-a86d-bb1ae0519e14";
type Stage = "pre_arrival" | "arrival" | "in_house" | "departure" | "post_departure";
const stages: readonly Stage[] = ["pre_arrival", "arrival", "in_house", "departure", "post_departure"];
const base = { unitTypeCode: "DLX", unitTypeLabel: "Deluxe", sellableUnitLabel: "Room 101", ratePlanCode: "BAR",
  ratePlanLabel: "Best available", adults: 2, children: 0, channelCode: "direct", marketCode: null, sourceCode: null,
  currency: "INR", arrivalTravel: null, departureTravel: null };
const record = (suffix: string, status: string, state: string, name: string, from: string, to: string) => ({ ...base,
  reservationId: `69200000-0000-4000-8000-0000000000${suffix}`, primaryPartyId: `69210000-0000-4000-8000-0000000000${suffix}`,
  confirmationNo: `Y-692-${suffix}`, status, operationalState: state, primaryGuestDisplayName: name,
  stayFrom: `${from}T15:00:00.000000Z`, stayTo: `${to}T11:00:00.000000Z`, createdAt: "2026-09-20T12:00:00.000000Z",
});
const rows = [
  record("01", "reserved", "reserved", "Future guest", "2026-09-27", "2026-09-29"),
  record("02", "waitlist", "waitlist", "Waitlisted guest", "2026-09-28", "2026-09-30"),
  record("03", "due_in", "due_in", "Expected arrival", "2026-09-24", "2026-09-26"),
  record("04", "in_house", "checked_in_today", "Arrived today", "2026-09-24", "2026-09-27"),
  record("05", "in_house", "stayover", "Stayover guest", "2026-09-22", "2026-09-27"),
  record("06", "due_out", "due_out", "Departure guest", "2026-09-22", "2026-09-24"),
  record("07", "checked_out", "checked_out_today", "Departed guest", "2026-09-22", "2026-09-24"),
  record("08", "cancelled", "cancelled", "Cancelled guest", "2026-09-24", "2026-09-26"),
] as const;
const byStage: Record<Stage, readonly number[]> = {
  pre_arrival: [0, 1], arrival: [2, 3], in_house: [3, 4, 5], departure: [5], post_departure: [6],
};
let businessDate: string | null = "2026-09-24";
const reads: string[] = [];
const json = (body: unknown, status = 200) => Response.json(body, { status });
const server = Bun.serve({ hostname: "127.0.0.1", port: 4176, async fetch(request) {
  const url = new URL(request.url), path = url.pathname;
  if (path === "/__proof/status") return json({ businessDate, reads });
  if (path === "/__proof/day") { businessDate = url.searchParams.get("value") === "none" ? null : "2026-09-24"; return json({ businessDate }); }
  if (path.endsWith("/auth/demo:enter")) return json({ accessToken: "«REDACTED-SECRET»" });
  if (path.endsWith("/me/properties")) return json({ properties: [{ id: property, name: "Synthetic journey hotel", timezone: "Asia/Kolkata" }] });
  if (path.endsWith("/reservation-board")) {
    const stage = url.searchParams.get("stage"); reads.push(stage ?? "all");
    if (stage && !stages.includes(stage as Stage)) return json({ detail: "Invalid synthetic stage" }, 400);
    if (stage && !businessDate) return json({ type: "reservations/board_conflict", detail: "No open property business day is available for journey phases" }, 409);
    return json({ businessDate, reservations: stage ? byStage[stage as Stage].map(index => rows[index]) : rows, nextCursor: null });
  }
  if (path.endsWith("/group-blocks")) return json({ groups: [] });
  if (path.startsWith("/api/")) return json({ detail: "Unsupported synthetic route; no forwarding" }, 404);
  const relative = path.startsWith("/yellow-next/assets/") ? path.slice("/yellow-next/".length) : "index.html";
  const target = resolve(root, relative);
  if (!target.startsWith(root + sep)) return new Response("Forbidden", { status: 403 });
  const file = Bun.file(target);
  return await file.exists() ? new Response(file) : new Response("Not found", { status: 404 });
} });
console.log(`Order692 synthetic-only read fixture: http://127.0.0.1:${server.port}/p/${property}/reservations?stage=arrival`);
