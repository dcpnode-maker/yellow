import { expect, test } from "bun:test";
import type { OwnerTrustApprovalView } from "../src/contexts/financials";
import { renderOwnerTrustApprovalEvidence, type OwnerTrustApprovalEvidenceProps } from "../src/http/operator/owner-trust-approval-evidence.mjs";

class ElementFixture {
  readonly children: ElementFixture[] = [];
  readonly attributes = new Map<string, string>();
  private value = "";
  className = "";
  constructor(readonly tagName: string) {}
  set textContent(value: string) { this.value = value; this.children.length = 0; }
  get textContent(): string { return this.value + this.children.map(child => child.textContent).join(""); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  appendChild(child: ElementFixture) { this.children.push(child); return child; }
}
const documentFixture = { createElement: (tag: string) => new ElementFixture(tag.toUpperCase()) };
const id = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
function approval(index = 1, overrides: Partial<OwnerTrustApprovalView> = {}): OwnerTrustApprovalView {
  return Object.freeze({ approvalId: id(index), accountReference: id(1001), accountLabel: "Owner ledger", ownerLabel: "Riverstone Holdings",
    currency: "USD", amountMinor: "2000", availableBalanceMinor: "1000", projectedBalanceMinor: "-1000", reason: "Repair the entrance",
    requesterLabel: "Native maker", status: "pending", requestedAt: "2026-10-02T23:30:00.000Z", decidedAt: null, canDecide: true, canPost: false, ...overrides });
}
function props(rows: readonly OwnerTrustApprovalView[] = [approval()], nextCursor: string | null = null): OwnerTrustApprovalEvidenceProps {
  return Object.freeze({ state: "ready", propertyNode: "property-1", propertyLabel: "Original Yellow property", readIdentity: "read-1",
    page: Object.freeze({ approvals: Object.freeze([...rows]), nextCursor }) });
}
function render(input: unknown): ElementFixture {
  return renderOwnerTrustApprovalEvidence(documentFixture as unknown as Document, input as OwnerTrustApprovalEvidenceProps) as unknown as ElementFixture;
}
function descendants(root: ElementFixture, tag: string): ElementFixture[] {
  return root.children.flatMap(child => [...(child.tagName === tag ? [child] : []), ...descendants(child, tag)]);
}
function facts(root: ElementFixture): Array<[string, string]> {
  return descendants(root, "DIV").filter(row => row.children[0]?.tagName === "DT")
    .map(row => [row.children[0]!.textContent, row.children[1]!.textContent]);
}
const cards = (root: ElementFixture) => descendants(root, "ARTICLE");

test("native reason requester status dates and route hints remain request evidence with no actions", () => {
  const root = render(props());
  expect(root.getAttribute("data-evidence-state")).toBe("ready");
  expect(root.textContent).toContain("Balances are request snapshots");
  expect(root.textContent).toContain("Repair the entrance");
  expect(facts(root)).toContainEqual(["Requested by", "Native maker"]);
  expect(facts(root)).toContainEqual(["Request status", "pending"]);
  expect(facts(root)).toContainEqual(["Requested at (native UTC)", "2026-10-02T23:30:00.000Z"]);
  expect(facts(root)).toContainEqual(["Decided at (native UTC)", "Not supplied"]);
  expect(root.textContent).toContain("Decision route hint: available");
  expect(root.textContent).toContain("Expense route hint: unavailable");
  for (const tag of ["BUTTON", "FORM", "INPUT", "A", "SCRIPT", "IMG"]) expect(descendants(root, tag)).toHaveLength(0);
  expect(root.textContent).not.toMatch(/approved funds|bank balance|payment success|posted journal|settled|current balance|ready to post/i);
});

test("all 100 rows retain native order and duplicate labels or account references", () => {
  const rows = Object.freeze(Array.from({ length: 100 }, (_, i) => approval(100 - i, { accountLabel: "Same label", ownerLabel: "Same owner" })));
  const root = render(props(rows, "100"));
  expect(cards(root)).toHaveLength(100);
  expect(cards(root).map(row => row.getAttribute("data-approval-id"))).toEqual(rows.map(row => row.approvalId));
  expect(root.textContent).toContain("100 requests in this returned page");
  expect(root.textContent).toContain("More rows are available");
  expect(descendants(root, "DETAILS")).toHaveLength(101);
});

test("duplicate approval identities invalidate the entire page rather than deduplicating or rendering partial data", () => {
  const root = render(props([approval(1), approval(2), approval(1, { status: "approved" })]));
  expect(root.getAttribute("data-evidence-state")).toBe("unavailable");
  expect(cards(root)).toHaveLength(0);
  expect(root.textContent).not.toContain("Repair the entrance");
  const tooMany = render(props(Array.from({ length: 101 }, (_, i) => approval(i + 1))));
  expect(tooMany.getAttribute("data-evidence-state")).toBe("unavailable");
  expect(cards(tooMany)).toHaveLength(0);
});

test("every native status and route flag combination is literal without inferring posting or decision freshness", () => {
  for (const status of ["pending", "approved", "rejected", "expired"] as const) {
    for (const canDecide of [true, false]) for (const canPost of [true, false]) {
      const root = render(props([approval(1, { status, canDecide, canPost, decidedAt: null })]));
      expect(facts(root)).toContainEqual(["Request status", status]);
      expect(facts(root)).toContainEqual(["Exact canDecide", String(canDecide)]);
      expect(facts(root)).toContainEqual(["Exact canPost", String(canPost)]);
      expect(facts(root)).toContainEqual(["Decided at (native UTC)", "Not supplied"]);
      expect(root.textContent).not.toMatch(/posted|settled|payment|approved funds|permitted to/i);
    }
  }
});

test("positive zero negative and huge request-snapshot strings are exact without monetary arithmetic", () => {
  for (const amount of ["0", "-250", "9223372036854775807", "-9223372036854775808", "9".repeat(250)]) {
    const root = render(props([approval(1, { availableBalanceMinor: amount, projectedBalanceMinor: amount, amountMinor: "1".repeat(200) })]));
    expect(facts(root)).toContainEqual(["Exact available minor units at request", amount]);
    expect(facts(root)).toContainEqual(["Exact projected minor units at request", amount]);
    expect(facts(root)).toContainEqual(["Requested expense", `${"1".repeat(200)} USD minor units (raw)`]);
  }
  const inconsistent = render(props([approval(1, { amountMinor: "100", availableBalanceMinor: "0", projectedBalanceMinor: "999" })]));
  expect(facts(inconsistent)).toContainEqual(["Projected trust funds (request snapshot)", "999 USD minor units (raw)"]);
  expect(inconsistent.getAttribute("data-evidence-state")).toBe("ready");
});

test("caller formatting belongs to exact approval identity and preserves currency precision without totals", () => {
  const rows = [approval(1, { currency: "JPY", amountMinor: "120" }), approval(2, { currency: "KWD", amountMinor: "1250" }), approval(3, { currency: "CLF", amountMinor: "12345" })];
  const root = render({ ...props(rows), formattedAmounts: { [id(1)]: { expense: "JPY 120", before: "JPY 1000" }, [id(2)]: { expense: "KWD 1.250", projected: "KWD -1.000" }, [id(3)]: { expense: "CLF 1.2345" } } });
  for (const text of ["JPY 120", "KWD 1.250", "CLF 1.2345", "JPY 1000", "KWD -1.000"]) expect(root.textContent).toContain(text);
  expect(root.textContent).not.toMatch(/total funds|combined balance|portfolio total/);
  const inherited = render({ ...props(), formattedAmounts: Object.create({ [id(1)]: { expense: "USD 999.00" } }) });
  expect(inherited.textContent).not.toContain("USD 999.00");
  const raw = render({ ...props(), formattedAmounts: { [id(1)]: { before: " ", expense: null } } });
  expect(facts(raw)).toContainEqual(["Requested expense", "2000 USD minor units (raw)"]);
});

test("explicit native empty array is distinct from missing or failed page and cursor coverage is preserved", () => {
  const empty = render(props([], "50"));
  expect(empty.getAttribute("data-evidence-state")).toBe("ready");
  expect(empty.textContent).toContain("No approval requests were returned in this page");
  expect(empty.textContent).toContain("More rows are available");
  expect(facts(empty)).toContainEqual(["Next page cursor", "50"]);
  expect(render(props([], null)).textContent).toContain("No further page cursor returned");
  for (const page of [{}, { approvals: undefined, nextCursor: null }, { approvals: null, nextCursor: null }, { approvals: [], nextCursor: undefined }]) {
    const root = render({ ...props(), page }); expect(root.getAttribute("data-evidence-state")).toBe("unavailable");
    expect(root.textContent).not.toContain("No approval requests were returned");
  }
});

test("loading unavailable and malformed replacements have no retained historical data or disclosures", () => {
  for (const state of ["loading", "unavailable"]) {
    const root = render({ ...props(), state });
    expect(root.getAttribute("data-evidence-state")).toBe(state);
    expect(root.getAttribute("aria-busy")).toBe(state === "loading" ? "true" : "false");
    expect(cards(root)).toHaveLength(0);
    expect(descendants(root, "DETAILS")).toHaveLength(0);
    expect(root.textContent).not.toMatch(/Riverstone|Native maker|Repair the entrance|2000|2026-10|property-1|read-1/);
  }
});

test("missing malformed or sparse rows fail atomically even after a good first row", () => {
  const badRows: unknown[] = [null, {}, ...[undefined, null, 0, "01", "-0", "1e3", "NaN"].map(value => ({ ...approval(2), availableBalanceMinor: value })),
    { ...approval(2), approvalId: "bad-id" }, { ...approval(2), accountReference: null }, { ...approval(2), canPost: "false" },
    { ...approval(2), status: "posted" }, { ...approval(2), reason: "" }, { ...approval(2), requesterLabel: null },
    { ...approval(2), currency: "usd" }, { ...approval(2), amountMinor: "0" }];
  for (const row of badRows) {
    const root = render({ ...props(), page: { approvals: [approval(1), row], nextCursor: null } });
    expect(root.getAttribute("data-evidence-state")).toBe("unavailable"); expect(cards(root)).toHaveLength(0);
    expect(root.textContent).not.toContain("Riverstone");
  }
  expect(render({ ...props(), page: { approvals: new Array(2), nextCursor: null } }).getAttribute("data-evidence-state")).toBe("unavailable");
});

test("canonical native timestamps stay exact while malformed or invented missing timestamps fail", () => {
  const decided = "2026-10-03T00:15:30.123Z";
  const root = render(props([approval(1, { status: "approved", decidedAt: decided })]));
  expect(facts(root)).toContainEqual(["Decided at (native UTC)", decided]);
  for (const value of [undefined, "", "yesterday", "2026-02-31T00:00:00.000Z", "2026-10-03", 0]) {
    for (const field of ["requestedAt", "decidedAt"]) {
      const invalid = render(props([{ ...approval(), [field]: value } as OwnerTrustApprovalView]));
      expect(invalid.getAttribute("data-evidence-state")).toBe("unavailable");
      expect(cards(invalid)).toHaveLength(0);
    }
  }
});

test("getter fields including array indexes and formatters are rejected without invocation", () => {
  let calls = 0;
  const descriptor = { enumerable: true, get(): never { calls++; throw Error("accessor must not execute"); } };
  for (const field of ["approvalId", "reason", "requesterLabel", "requestedAt", "canDecide"]) {
    const row = { ...approval() }; Object.defineProperty(row, field, descriptor);
    expect(render(props([row])).getAttribute("data-evidence-state")).toBe("unavailable");
  }
  const rows = [approval()]; Object.defineProperty(rows, "0", descriptor);
  expect(render({ ...props(), page: { approvals: rows, nextCursor: null } }).getAttribute("data-evidence-state")).toBe("unavailable");
  const formats = {}; Object.defineProperty(formats, id(1), descriptor);
  expect(render({ ...props(), formattedAmounts: formats }).getAttribute("data-evidence-state")).toBe("unavailable");
  const nested = {}; Object.defineProperty(nested, "before", descriptor);
  expect(render({ ...props(), formattedAmounts: { [id(1)]: nested } }).getAttribute("data-evidence-state")).toBe("unavailable");
  const source = { ...props() }; Object.defineProperty(source, "page", descriptor);
  expect(render(source).getAttribute("data-evidence-state")).toBe("unavailable");
  expect(calls).toBe(0);
});

test("native unknown labels remain explicit and requester is never substituted with owner", () => {
  const root = render(props([approval(1, { accountLabel: "", ownerLabel: "", requesterLabel: "", currency: "XXX" })]));
  expect(root.textContent).toContain("Account label not supplied"); expect(root.textContent).toContain("Owner label not supplied");
  expect(facts(root)).toContainEqual(["Requested by", "Requester label not supplied"]);
  expect(root.textContent).toContain("2000 XXX minor units (raw)");
});

test("hostile strings stay literal and every fresh read resets disclosures without input mutation", () => {
  const text = '<img src=x onerror=window.hostile=1><script>danger()</script>' + "長".repeat(400);
  const input = props([approval(1, { reason: text, requesterLabel: text, ownerLabel: text })]);
  const before = JSON.stringify(input); const root = render(input);
  expect(root.textContent).toContain(text); expect(descendants(root, "IMG")).toHaveLength(0); expect(descendants(root, "SCRIPT")).toHaveLength(0);
  descendants(root, "DETAILS")[0]!.setAttribute("open", "");
  for (const readIdentity of ["read-1", "read-2"]) {
    const fresh = render({ ...input, readIdentity }); expect(fresh).not.toBe(root);
    expect(descendants(fresh, "DETAILS").every(detail => detail.getAttribute("open") === null)).toBe(true);
  }
  expect(JSON.stringify(input)).toBe(before);
});
