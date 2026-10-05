import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CashDrawerPanel, CashDrawerWorkbench } from "../frontend/yellow/src/workspaces/CashDrawerWorkbench";
import type { CashDrawerController, CashDrawerState } from "../frontend/yellow/src/workspaces/cash-drawer-client";

const propertyId = "71610000-0000-4000-8000-000000000001";
const drawerId = "71610000-0000-4000-8000-000000000002";
const sessionId = "71610000-0000-4000-8000-000000000003";
const countId = "71610000-0000-4000-8000-000000000004";
const actorId = "71610000-0000-4000-8000-000000000005";
const stamp = "2026-09-25T10:00:00Z";
const drawer = { drawerId, id: drawerId, propertyNode: propertyId, code: "FRONT", name: "Front desk", currency: "USD",
  denominations: [{ denominationMinor: "100" }, { denominationMinor: "500" }], canOpen: true, canCount: true, canClose: true, supervised: false,
  session: { sessionId, businessDate: "2026-09-25", openedAt: stamp, openedBy: actorId, openingCountId: actorId,
    latestCount: { countId, attemptNo: 1, countedAt: stamp, countedBy: actorId }, countHistory: [] },
} as const;
const base: CashDrawerState = { status: "idle", snapshot: { drawers: [drawer] }, loading: false, readError: null,
  selectedDrawerId: drawerId, action: null, quantities: {}, reason: "", approvalId: "", reviewed: null, message: null, evidence: null };
const noop = () => undefined;
const controller = { getState: () => base, subscribe: () => noop, refresh: async () => undefined, selectDrawer: noop,
  start: () => true, setQuantity: noop, setReason: noop, setApprovalId: noop, review: () => true, edit: noop,
  cancel: noop, acknowledge: noop, submit: async () => undefined, activate: noop, dispose: noop } as CashDrawerController;
const panel = (state: CashDrawerState, disabled = false, confirmed = false) => renderToStaticMarkup(createElement(CashDrawerPanel, {
  state, controller, disabled, confirmed, onConfirmed: noop,
}));

test("cashier panel exposes only permitted actions, preserves truthful no-drawer/loading/error states", () => {
  const html = panel(base);
  expect(html).toContain("Record blind count");
  expect(html).toContain("Request over/short approval");
  expect(html).toContain("Close drawer");
  expect(html).not.toContain("Approve request");
  expect(html).not.toContain("Supervisor: close drawer");
  expect(panel({ ...base, snapshot: { drawers: [] }, selectedDrawerId: null })).toContain("No cash drawer is configured");
  expect(panel({ ...base, snapshot: null, loading: true })).toContain("Loading configured drawers");
  const failed = panel({ ...base, readError: "Current cash drawer data is unavailable." });
  expect(failed).toContain("Current cash drawer data is unavailable.");
  expect(failed).not.toContain("Record blind count");
});

test("blind count edit and frozen review expose denomination quantities, never expected cash", () => {
  const editing = panel({ ...base, status: "editing", action: "count", quantities: { "100": "2", "500": "3" } });
  expect(editing).toContain('data-lifecycle-recovery="true"');
  expect(editing).toContain("No expected amount or calculated total is shown during a blind count.");
  expect(editing).toContain('value="2"');
  expect(editing).toContain('value="3"');
  const reviewed = { action: "count" as const, drawerId, sessionId, countId, approvalId: null,
    body: { denominations: [{ denominationMinor: "100", quantity: "2" }, { denominationMinor: "500", quantity: "3" }] }, route: "/unused" };
  const locked = panel({ ...base, status: "review", action: "count", reviewed }, true);
  expect(locked).toContain("100 minor units × 2");
  expect(locked).toContain("500 minor units × 3");
  expect(locked).toContain("operation key freeze");
  expect(locked).toContain('disabled=""');
  expect(locked).not.toContain("expectedMinor");
  const confirmed = panel({ ...base, status: "review", action: "count", reviewed }, true, true);
  expect(confirmed).toContain('checked=""');
  expect(confirmed).toContain("Submit Record blind count");
});

test("uncertain retains own recovery despite parent disable; supervisor approval uses explicit handoff", () => {
  const uncertain = panel({ ...base, status: "uncertain", action: "count", message: "Outcome unconfirmed." }, true);
  expect(uncertain).toContain('data-lifecycle-recovery="true"');
  expect(uncertain).toContain("Reconcile exact request");
  expect(uncertain).not.toMatch(/<button[^>]*disabled[^>]*>Reconcile exact request/u);
  const supervised = panel({ ...base, snapshot: { drawers: [{ ...drawer, canOpen: false, canCount: false, supervised: true }] },
    status: "editing", action: "approve", approvalId: "" });
  expect(supervised).toContain("Approval request UUID");
  expect(supervised).toContain("separately supervised request handoff");
  expect(supervised).toContain("server enforces actor separation");
  const closing = panel({ ...base, status: "editing", action: "close", reason: "Reviewed variance" });
  expect(closing).toContain('aria-label="Cash drawer variance reason"');
  expect(closing).toContain('aria-label="Dictate Cash drawer variance reason"');
  expect(closing).not.toContain("Dictate Approval request UUID");
});

test("failed refresh or removed drawer cannot hide retained recovery or prewrite Cancel", () => {
  const missing = { ...base, snapshot: { drawers: [] }, selectedDrawerId: drawerId };
  const uncertain = panel({ ...missing, status: "uncertain", action: "count", readError: "Current read failed.", message: "Outcome unconfirmed." }, true);
  expect(uncertain).toContain("Reconcile exact request");
  expect(uncertain).toContain('data-lifecycle-recovery="true"');
  expect(uncertain).not.toContain("Record blind count");
  const editing = panel({ ...missing, status: "editing", action: "count", readError: "Current read failed." }, true);
  expect(editing).toContain("Cancel draft");
  const reviewed = panel({ ...missing, status: "review", action: "close", readError: "Current read failed.", reviewed: {
    action: "close", drawerId, sessionId, countId, approvalId: null, body: { countId }, route: "/unused",
  } }, true, true);
  expect(reviewed).toContain("Review Close drawer");
  expect(reviewed).toContain(">Cancel</button>");
  expect(reviewed).toMatch(/<button[^>]*disabled[^>]*>Submit Close drawer/u);
});

test("top-level workbench is safe before effects and does not invent a drawer", () => {
  const html = renderToStaticMarkup(createElement(CashDrawerWorkbench, { propertyId, getToken: async () => "not-used",
    loadSnapshot: async () => ({ drawers: [] }), acquireMutationLease: () => true, releaseMutationLease: noop }));
  expect(html).toContain("Cash drawer custody");
  expect(html).toContain("Loading configured drawers");
  expect(html).not.toContain("Front desk");
});
