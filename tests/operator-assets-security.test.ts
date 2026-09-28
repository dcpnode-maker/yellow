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
  expect(css).toContain(".reservation-lifecycle-editor input, .reservation-lifecycle-editor textarea, .reservation-lifecycle-editor button { min-height: 44px; }");
  expect(script).toContain("/reservations?confirmationNo=");
  expect(script).toContain("/cancel");
  expect(script).toContain("/reinstate");
  expect(script).toContain("reservation.actions.canModify");
  expect(script).toContain("reservation.actions.canCancel");
  expect(script).toContain("reservation.actions.canReinstate");
  expect(script).toContain("reservationLifecycleEditor.focus()");
  expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie/);
  expect(script).not.toMatch(BROWSER_SQL_SYNTAX);
});

test("Order 098 P0/P4: segment history and commands expose no browser occupancy authority", async () => {
  const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
  const css = await Bun.file(new URL("../src/http/operator/operator.css", import.meta.url)).text();
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  expect(html).toContain('id="reservation-segment-lookup-form"');
  expect(html).toContain('id="reservation-segment-editor"');
  expect(html).toContain('id="reservation-segment-history"');
  expect(html).toContain('id="reservation-departure-form"');
  expect(html).toContain('id="reservation-room-move-form"');
  expect(html).toContain('type="datetime-local" step="0.001"');
  expect(css).toContain(".reservation-segment-editor");
  expect(css).toContain(".reservation-segment-history");
  expect(css).toContain(".reservation-segment-editor input, .reservation-segment-editor select, .reservation-segment-editor button { min-height: 44px; }");
  expect(script).toContain("/reservation-segments?confirmationNo=");
  expect(script).toContain('submitSegmentCommand("/departure", "PATCH"');
  expect(script).toContain('submitSegmentCommand("/move", "POST"');
  expect(script).toContain("latest?.actions.canChangeDeparture");
  expect(script).toContain("latest?.actions.canMoveRoom");
  expect(script).toContain("departure.toISOString()");
  expect(script).toContain("utcInstantInputValue(latest.period.to)");
  expect(script).toContain('new Date(`${value}Z`)');
  expect(script).not.toContain("new Date(value)");
  expect(script).toContain("reservationSegmentEditor.focus()");
  expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie/);
  expect(script).not.toMatch(BROWSER_SQL_SYNTAX);
});

test("Order 098 correction: loaded departure round-trips through a DST fold", async () => {
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  const start = script.indexOf("  function utcInstantInputValue(instant) {");
  const end = script.indexOf("  function initializeDates() {", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const helper = script.slice(start, end);
  const execute = Function(`${helper}\nreturn { utcInstantInputValue };`) as () => {
    utcInstantInputValue(instant: string): string;
  };
  const priorTimezone = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    const serverInstant = "2025-11-02T06:30:00.789Z";
    const fieldValue = execute().utcInstantInputValue(serverInstant);
    expect(fieldValue).toBe("2025-11-02T06:30:00.789");
    expect(new Date(`${fieldValue}Z`).toISOString()).toBe(serverInstant);
  } finally {
    if (priorTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = priorTimezone;
  }
});

test("Order 165: reservation dates initialize as one editable near-future UTC stay", async () => {
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  const start = script.indexOf("  function localInputValue(date) {");
  const end = script.indexOf("  async function request(path, options = {}) {", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const helpers = script.slice(start, end);
  const field = () => ({ value: "" });
  const form = (...names: string[]) => ({
    elements: Object.fromEntries(names.map((name) => [name, field()])),
  });
  const availabilityForm = form("from", "to");
  const reservationBookingForm = form("from", "to");
  const restrictionForm = form("stayStart", "stayEnd");
  const ratePriceForm = form("stayStart", "stayEnd");
  const currentPriceForm = form("stayDate");
  const operationalBlockForm = form("from", "to");
  const builderStayStart = field();
  const builderStayEnd = field();
  const builderPreviewDates = field();
  const builderQuoteStart = field();
  const builderQuoteEnd = field();
  const execute = Function(
    "availabilityForm", "reservationBookingForm", "restrictionForm", "ratePriceForm",
    "currentPriceForm", "operationalBlockForm", "builderStayStart", "builderStayEnd",
    "builderPreviewDates", "builderQuoteStart", "builderQuoteEnd",
    `${helpers}\ninitializeDates();`,
  ) as (...inputs: unknown[]) => void;

  expect(reservationBookingForm.elements.from!.value).toBe("");
  expect(reservationBookingForm.elements.to!.value).toBe("");
  const before = Date.now();
  execute(
    availabilityForm, reservationBookingForm, restrictionForm, ratePriceForm,
    currentPriceForm, operationalBlockForm, builderStayStart, builderStayEnd,
    builderPreviewDates, builderQuoteStart, builderQuoteEnd,
  );
  const after = Date.now();
  const fromValue = reservationBookingForm.elements.from!.value;
  const toValue = reservationBookingForm.elements.to!.value;
  expect(fromValue).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/);
  expect(toValue).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/);
  const from = new Date(`${fromValue}Z`).getTime();
  const to = new Date(`${toValue}Z`).getTime();
  expect(from).toBeGreaterThan(before);
  expect(from).toBeLessThanOrEqual(after + 2 * 86_400_000);
  expect(to).toBeGreaterThan(from);
  expect(to - from).toBeGreaterThanOrEqual(47 * 3_600_000);
  expect(to - from).toBeLessThanOrEqual(49 * 3_600_000);
  expect(script).toContain("reservationBookingForm.elements.from.value = utcInstantInputValue(from)");
  expect(script).toContain("reservationBookingForm.elements.to.value = utcInstantInputValue(to)");
});

test("Order 099 P1/P4: booking journey renders server truth without browser promise authority", async () => {
  const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
  const css = await Bun.file(new URL("../src/http/operator/operator.css", import.meta.url)).text();
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  expect(html).toContain('id="reservation-booking-form"');
  expect(html).toContain('id="reservation-booking-options"');
  expect(html).toContain('id="reservation-booking-confirmation"');
  expect(html).toContain("Offers are read-only evidence, not promised inventory.");
  expect(html).toContain("Confirmation does not imply payment, tax finalization, a folio, journal or fiscal document.");
  expect(html).toContain("Party creation/profile merge, deposits and public guest booking remain separate later workflows.");
  expect(css).toContain(".reservation-booking-form input, .reservation-booking-form button, .reservation-booking-commit button { min-height: 44px; }");
  expect(script).toContain("function renderReservationBookingOffers(options, issues)");
  expect(script).toContain("offer.bookable !== true");
  expect(script).toContain("offer.promise !== false");
  expect(script).toContain("offer.commitArbitrationRequired !== true");
  expect(script).toContain("/availability:search");
  expect(script).toContain("/api/v1/reservations:commit");
  expect(script).toContain("Temporary hold");
  expect(script).toContain("result.reservation.confirmationNo");
  expect(script).not.toMatch(/Math\.round|\.toFixed|parseFloat/);
  expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie/);
  expect(script).not.toMatch(BROWSER_SQL_SYNTAX);
});

test("Order 102 P4: Party journey is accessible, explicit and retains no browser identity authority", async () => {
  const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
  const css = await Bun.file(new URL("../src/http/operator/operator.css", import.meta.url)).text();
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();

  expect(html).toContain('id="party-profile-search-form"');
  expect(html).toContain('id="party-profile-results" role="region" aria-label="Party search results" aria-live="polite"');
  expect(html).toContain('id="party-profile-create-form"');
  expect(html).toContain('id="party-duplicate-review" hidden aria-labelledby="party-duplicate-title" tabindex="-1"');
  expect(html).toContain('id="party-duplicate-message" role="status" aria-live="assertive"');
  expect(html).toContain('id="party-create-distinct-confirm" type="checkbox"');
  expect(html).toContain('id="party-create-distinct" type="button" disabled');
  expect(html).toContain('name="primaryPartyId" required readonly');
  expect(html).toContain("Search terms are sent in the request body and are not saved in this browser.");
  expect(html).toContain("Choose an existing masked candidate, or acknowledge every candidate");
  expect(html).toContain("editing, merge, anonymisation, guest 360, consent and verification remain later workflows");
  expect(html).not.toMatch(/name="(?:dateOfBirth|nationality|document|consent|verified|payment|pan|cvv)"/i);

  expect(css).toContain(".party-profile-panel input, .party-profile-panel select, .party-profile-panel button, .party-profile-panel summary { min-height: 44px; }");
  expect(css).toContain(".party-distinct-confirmation");
  expect(css).toContain("prefers-reduced-motion: reduce");

  expect(script).toContain('method: "POST", body: JSON.stringify({ query, limit: 20 })');
  expect(script).toContain("use.textContent = \"Use for reservation\"");
  expect(script).toContain("partyDuplicateIds = candidates.map(({ partyId }) => partyId).sort()");
  expect(script).toContain("if (!partyCreateDistinctConfirm.checked || partyDuplicateIds.length === 0) return");
  expect(script).toContain("void createPartyProfile([...partyDuplicateIds])");
  expect(script).toContain("partyCreateAttemptKey = partyCreateAttemptKey || crypto.randomUUID()");
  expect(script).toContain("reservationBookingForm.elements.primaryPartyId.value = partyId");
  expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB|sendBeacon|CacheStorage|caches\.(?:open|put|match)/);
  expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
  expect(script).not.toMatch(BROWSER_SQL_SYNTAX);
  const partySurface = script.slice(
    script.indexOf("  function partyContactSummary(contacts) {"),
    script.indexOf("  function clearReservationBookingSelection() {"),
  );
  expect(partySurface).not.toMatch(/(?:party|contact|duplicate)[A-Za-z]*\.(?:dataset|setAttribute\(\s*["']data-)/i);
  expect(script).not.toMatch(/acknowledgedDuplicatePartyIds\s*:\s*(?:candidates|partyDuplicateIds)/);
});

test("Order 102 independent extracted canary: only a selected server Party id fills booking and resets pending evidence", async () => {
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  const start = script.indexOf("  function selectPartyProfile(profile, masked = false) {");
  const end = script.indexOf("  function partyProfileCard(profile, masked = false) {", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const source = script.slice(start, end);

  const primaryPartyId = { value: "caller-owned-before" };
  const strong = { textContent: "" };
  const small = { textContent: "" };
  let selectedFocus = 0;
  let duplicateClears = 0;
  let bookingClears = 0;
  const selected = {
    hidden: true,
    querySelector(selector: string) { return selector === "strong" ? strong : small; },
    focus() { selectedFocus += 1; },
  };
  const form = { reset() {} };
  const list = { replaceChildren() {} };
  const picker = { hidden: false };
  const clear = { hidden: true };

  const factory = Function(
    "reservationBookingForm", "partyProfileSelected", "partyProfileSearchForm", "partyProfileCreateForm",
    "partyProfileResults", "clearPartyDuplicateReview", "partyProfilePicker", "partyProfileClear",
    "reservationBookingOptions", "clearReservationBookingSelection", "partyContactSummary",
    "partyProfileGeneration", "partyCreateAttemptKey", "partyCreateDraft", "reservationBookingSearchGeneration",
    "reservationBookingOffers", "reservationBookingDraft",
    `${source}\nreturn selectPartyProfile;`,
  ) as (...args: unknown[]) => (profile: Record<string, unknown>, masked?: boolean) => void;
  const select = factory(
    { elements: { primaryPartyId } }, selected, form, form, list,
    () => { duplicateClears += 1; }, picker, clear, list,
    () => { bookingClears += 1; },
    (contacts: Array<{ kind: string; hint: string }>) => contacts.map(({ kind, hint }) => `${kind}: ${hint}`).join(" · "),
    0, "pending-key", { raw: "pending" }, 0, [{ stale: true }], { stale: true },
  );

  const serverPartyId = "00000000-0000-0000-0000-000000010299";
  select({
    partyId: serverPartyId,
    displayName: "Server Party",
    roles: ["guest"],
    contacts: [{ kind: "email", hint: "s•••@example.test" }],
  });
  expect(primaryPartyId.value).toBe(serverPartyId);
  expect(strong.textContent).toContain(serverPartyId);
  expect(small.textContent).toContain("s•••@example.test");
  expect(picker.hidden).toBeTrue();
  expect(selected.hidden).toBeFalse();
  expect(clear.hidden).toBeFalse();
  expect(selectedFocus).toBe(1);
  expect(duplicateClears).toBe(1);
  expect(bookingClears).toBe(1);
});

test("Order 102 independent canary: property/sign-out clearing and both late-response guards are permanent", async () => {
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  const searchStart = script.indexOf("  async function searchPartyProfiles() {");
  const createStart = script.indexOf("  async function createPartyProfile(", searchStart);
  const nextAfterCreate = script.indexOf("  function clearReservationBookingSelection() {", createStart);
  const searchBody = script.slice(searchStart, createStart);
  const createBody = script.slice(createStart, nextAfterCreate);
  expect(searchBody).toContain("const generation = ++partyProfileGeneration");
  expect(searchBody.match(/generation !== partyProfileGeneration \|\| property !== propertySelect\.value/g)).toHaveLength(2);
  expect(createBody).toContain("const generation = ++partyProfileGeneration");
  expect(createBody.match(/generation !== partyProfileGeneration \|\| property !== propertySelect\.value/g)).toHaveLength(2);

  const propertyChange = script.slice(
    script.indexOf('propertySelect.addEventListener("change"'),
    script.indexOf("  for (const tab of navigation)", script.indexOf('propertySelect.addEventListener("change"')),
  );
  const showLogin = script.slice(script.indexOf("  function showLogin() {"), script.indexOf("  function showWorkbench() {"));
  expect(propertyChange).toContain("clearPartyProfileState()");
  expect(showLogin).toContain("clearPartyProfileState()");
  expect(showLogin).toContain('accessToken = ""');
  const clearProfile = script.slice(script.indexOf("  function clearPartyProfileState() {"), script.indexOf("  function selectPartyProfile"));
  const clearDuplicates = script.slice(script.indexOf("  function clearPartyDuplicateReview() {"), script.indexOf("  function clearPartyProfileState() {"));
  expect(clearProfile).toMatch(/partyCreateAttemptKey = ""[\s\S]*partyCreateDraft = null[\s\S]*clearPartyDuplicateReview\(\)[\s\S]*primaryPartyId\.value = ""/);
  expect(clearDuplicates).toContain("partyDuplicateIds = []");
});
