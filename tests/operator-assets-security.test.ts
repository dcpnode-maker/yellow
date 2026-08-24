import { expect, test } from "bun:test";

import { BROWSER_SQL_SYNTAX } from "./helpers/browser-asset-security";

const LEGACY_SQL_WORD_GUARD = /\b(?:SELECT|INSERT|UPDATE|DELETE)\s/i;
const ORDINARY_UI_COPY = "Save or select a draft before previewing.";

test("Order 074 P0/P1: SQL syntax is rejected without treating ordinary UI copy as SQL", async () => {
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  expect(script).toContain(ORDINARY_UI_COPY);
  expect(ORDINARY_UI_COPY).toMatch(LEGACY_SQL_WORD_GUARD);
  expect(ORDINARY_UI_COPY).not.toMatch(BROWSER_SQL_SYNTAX);
  for (const sql of [
    "SELECT tenant_id, code FROM rate_plan",
    "INSERT INTO rate_plan (id) VALUES ('x')",
    "UPDATE rate_plan SET code = 'x'",
    "UPDATE rate_plan WHERE id = 'x'",
    "DELETE FROM rate_plan WHERE id = 'x'",
    "DELETE rate_plan WHERE id = 'x'",
  ]) {
    expect(sql).toMatch(BROWSER_SQL_SYNTAX);
  }
  expect(script).not.toMatch(BROWSER_SQL_SYNTAX);
});

test("Order 076 P3: immutable rate history is inspectable and only copied as an unsaved Expert start", async () => {
  const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
  const css = await Bun.file(new URL("../src/http/operator/operator.css", import.meta.url)).text();
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  expect(html).toContain("Inspect exact server-owned configuration");
  expect(html).toContain("Old versions never change");
  expect(css).toContain(".release-inspection");
  expect(css).toContain(".release-command");
  expect(script).toContain('inspectionTitle.textContent = "Inspect exact version"');
  expect(script).toContain('reuse.textContent = "Use as starting point"');
  expect(script).toContain('use.textContent = release.id === builderReleaseId ? "Selected" : "Use draft"');
  expect(script).toContain('undo.textContent = "Create undo draft"');
  expect(script).toContain('setBuilderMode("expert", false)');
  expect(script).toContain("builderExpertJson.value = JSON.stringify(command, null, 2)");
  expect(script).toContain("commandView.textContent = JSON.stringify(command, null, 2)");
  expect(script).toContain("No release was changed or saved");
  expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie/);
  expect(script).not.toMatch(BROWSER_SQL_SYNTAX);
});

test("Order 077 P4: approval inbox exposes only server-authorized deliberate actions", async () => {
  const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
  const css = await Bun.file(new URL("../src/http/operator/operator.css", import.meta.url)).text();
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  expect(html).toContain('id="builder-approval-inbox"');
  expect(html).toContain('id="builder-refresh-approvals"');
  expect(html).toContain('id="builder-load-more-approvals"');
  expect(html).toContain('id="builder-selected-approval"');
  expect(html).toContain("Only the operator who approved the latest draft may publish it");
  expect(html).not.toContain('id="builder-approval-id"');
  expect(css).toContain(".approval-inbox-row");
  expect(css).toContain('.approval-inbox-row[data-status="approved"]');
  expect(script).toContain("approval.canDecide");
  expect(script).toContain("approval.canPublish");
  expect(script).toContain("selectedRateApprovalId");
  expect(script).toContain("builderSimulationReleaseId === builderReleaseId");
  expect(script).toContain("/approvals?limit=50");
  expect(script).toContain("/decision");
  expect(script).not.toContain("builderApprovalId");
  expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie|setInterval|EventSource|WebSocket/);
  expect(script).not.toMatch(BROWSER_SQL_SYNTAX);
});

test("Order 096 P0/P4: reservation guest workbench is explicit and browser-authority free", async () => {
  const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
  const css = await Bun.file(new URL("../src/http/operator/operator.css", import.meta.url)).text();
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  expect(html).toContain('data-view="reservations"');
  expect(html).toContain('id="reservation-guest-form"');
  expect(html).toContain("Primary guest cannot be removed");
  expect(css).toContain(".reservation-guest-row");
  expect(css).toContain("min-height: 44px");
  expect(css).toContain("prefers-reduced-motion: reduce");
  expect(script).toContain("/reservation-guests?confirmationNo=");
  expect(script).toContain("/guests");
  expect(script).toContain("primarySharePct");
  expect(script).toContain("BigInt(whole) * 100n + BigInt(fraction)");
  expect(script).toContain("focusTarget.focus()");
  expect(script).not.toMatch(/Math\.round\(Number\(|\.toFixed\(2\)/);
  expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie/);
  expect(script).not.toMatch(BROWSER_SQL_SYNTAX);
});

test("Order 096 independent canary: share guidance is exact integer basis-point arithmetic", async () => {
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  const start = script.indexOf("  function canonicalShare(value) {");
  const end = script.indexOf("  function updateReservationShareTotal() {", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const helpers = script.slice(start, end);
  expect(helpers).not.toMatch(/Number\s*\(|parseFloat\s*\(|Math\.round\s*\(|\.toFixed\s*\(/);
  const execute = Function(`${helpers}\nreturn { shareBasisPoints, formatBasisPoints };`) as () => {
    shareBasisPoints(value: string): bigint | null;
    formatBasisPoints(value: bigint): string;
  };
  const { shareBasisPoints, formatBasisPoints } = execute();
  const values = ["33.33", "33.33", "33.34"].map(shareBasisPoints);
  expect(values).toEqual([3333n, 3333n, 3334n]);
  const total = values.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n);
  expect(total).toBe(10000n);
  expect(formatBasisPoints(total)).toBe("100.00");
  expect(shareBasisPoints("33.3")).toBeNull();
});

test("Order 096 independent canary: removing first, middle, last and sole rows transfers focus", async () => {
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  const marker = 'remove.addEventListener("click", () => {';
  const start = script.indexOf(marker, script.indexOf("function addReservationGuestRow"));
  const end = script.indexOf("    });\n    role.addEventListener", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const body = script.slice(start + marker.length, end);
  const focusLog: string[] = [];
  interface FocusTarget { focus(): void }
  interface FakeRow {
    readonly name: string;
    nextElementSibling: FakeRow | null;
    previousElementSibling: FakeRow | null;
    querySelector(selector: string): FocusTarget;
    remove(): void;
  }
  const focusable = (name: string): FocusTarget => ({ focus: () => { focusLog.push(name); } });
  const add = focusable("add");
  const makeRow = (name: string): FakeRow => ({
    name,
    nextElementSibling: null,
    previousElementSibling: null,
    querySelector: (_selector: string) => focusable(name),
    remove() { this.nextElementSibling = null; this.previousElementSibling = null; },
  });
  const makeHandler = Function("row", "addReservationGuest", "updateReservationShareTotal",
    `return () => {${body}};`) as (row: FakeRow, addButton: FocusTarget, update: () => void) => () => void;

  const run = (position: "first" | "middle" | "last" | "sole") => {
    focusLog.length = 0;
    const first = makeRow("first");
    const middle = makeRow("middle");
    const last = makeRow("last");
    first.nextElementSibling = middle;
    middle.previousElementSibling = first;
    middle.nextElementSibling = last;
    last.previousElementSibling = middle;
    const row = position === "first" ? first : position === "middle" ? middle : position === "last" ? last : makeRow("sole");
    let updates = 0;
    makeHandler(row, add, () => { updates += 1; })();
    expect(updates).toBe(1);
    return [...focusLog];
  };

  expect(run("first")).toEqual(["middle"]);
  expect(run("middle")).toEqual(["last"]);
  expect(run("last")).toEqual(["middle"]);
  expect(run("sole")).toEqual(["add"]);
});

test("Order 097 P0/P4: lifecycle controls expose no browser transition authority", async () => {
  const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
  const css = await Bun.file(new URL("../src/http/operator/operator.css", import.meta.url)).text();
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  expect(html).toContain('id="reservation-lifecycle-lookup-form"');
  expect(html).toContain('id="reservation-metadata-form"');
  expect(html).toContain('id="reservation-cancel-form"');
  expect(html).toContain('id="reservation-reinstate"');
  expect(css).toContain(".reservation-lifecycle-editor");
  expect(script).toContain("/reservations?confirmationNo=");
  expect(script).toContain("/cancel");
  expect(script).toContain("/reinstate");
  expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie/);
  expect(script).not.toMatch(BROWSER_SQL_SYNTAX);
});
