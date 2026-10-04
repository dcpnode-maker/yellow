import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { pathname: "/p/6081b544-22a1-534f-a86d-bb1ae0519e14/reservations", search: "?view=calendar" } } });
const { CalendarTimeline, ReservationCalendar } = await import("../frontend/yellow/src/workspaces/ReservationCalendar");
if (descriptor) Object.defineProperty(globalThis, "window", descriptor); else Reflect.deleteProperty(globalThis, "window");
const rows = [{ reservationId: "one", confirmationNo: "Y-101", primaryGuestDisplayName: "A <script> guest", status: "due_in", stayFrom: "2026-10-02T14:00:00Z", stayTo: "2026-10-04T10:00:00Z", unitTypeLabel: "Villa", channelCode: "airbnb" }];
test("actual calendar renders clickable accessible summaries, exclusive checkout and retained theme", () => {
  const html = renderToString(createElement(CalendarTimeline, { stays: rows, start: "2026-10-02", days: 7, timezone: "UTC", search: "", view: "active", limit: 100, onOpen() {} }));
  expect(html).toContain('aria-colcount="8"'); expect(html).toContain('aria-colspan="2"'); expect(html).toContain('grid-column:2 / span 2');
  expect(html).toContain("A &lt;script&gt; guest"); expect(html).not.toContain("<script>");
  expect(html).toContain("Y-101"); expect(html).toContain("Room changes and gaps within split stays"); expect(html).toContain("Blank cells do not confirm availability");
});
test("actual renderer distinguishes no matching stays, explicit history and incomplete data", () => {
  const render = (stays: typeof rows, search = "", view: "active" | "all" = "active") => renderToString(createElement(CalendarTimeline, { stays, start: "2026-10-02", days: 7, timezone: "UTC", search, view, limit: 100, onOpen() {} }));
  expect(render(rows, "absent")).toContain("No matching recorded stays");
  const cancelled = [{ ...rows[0]!, status: "cancelled" }]; expect(render(cancelled)).not.toContain('class="calendar-stay"'); expect(render(cancelled, "", "all")).toContain('data-state="cancelled"');
  expect(render([{ ...rows[0]!, stayFrom: "bad" }])).toContain("calendar is incomplete");
});
test("invalid property timezone renders an explicit error without an initialization exception", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const html = renderToString(createElement(QueryClientProvider, { client }, createElement(ReservationCalendar, { propertyId: "property", timezone: "Invalid/Timezone", onOpen() {} })));
    expect(html).toContain("The property timezone is unavailable"); expect(html).toContain('disabled=""');
  } finally { client.clear(); }
});
test("actual mounted reservation routes retain Calendar, CRS, Individual, Groups and guarded Calendar Open reservation", async () => {
  const { fileURLToPath } = await import("node:url");
  const proof = process.env.YELLOW_ORDER754_ROUTING_PROOF_DIR ?? fileURLToPath(new URL("../../proof/retained-routing", import.meta.url));
  const child = Bun.spawn([process.execPath, "test", import.meta.dir + "/order754-original-reservation-screen.test.tsx"], {
    cwd: import.meta.dir + "/..", windowsHide: true, stdout: "pipe", stderr: "pipe",
    env: { ...process.env, YELLOW_ORDER754_ROUTING_ONLY: "1", YELLOW_ORDER754_PROOF_DIR: proof },
  });
  const output = Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
  const status = await child.exited;
  const text = (await output).join("\n");
  if (status !== 0) throw new Error("Mounted calendar routing proof failed:\n" + text);
  expect(status).toBe(0);
  expect(text).toContain("1 pass");
  const receipt = await Bun.file(proof + "/observations.json").json();
  expect(receipt.actualFullApp).toBe(true);
  expect(receipt.browserExitVerified).toBe(true);
  expect(receipt.writes).toEqual([]);
  expect(receipt.errors).toEqual([]);
}, 45000);
