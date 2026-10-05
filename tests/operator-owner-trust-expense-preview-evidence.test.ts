import { expect, test } from "bun:test";
import type { OwnerTrustExpensePreview } from "../src/contexts/financials";
import { renderOwnerTrustExpensePreviewEvidence, type OwnerTrustExpensePreviewEvidenceProps } from "../src/http/operator/owner-trust-expense-preview-evidence.mjs";

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
const reference = "00000000-0000-4000-8000-000000000001";
function preview(overrides: Partial<OwnerTrustExpensePreview> = {}): OwnerTrustExpensePreview {
  return Object.freeze({ accountReference: reference, accountLabel: "Owner ledger", ownerLabel: "Riverstone Holdings",
    currency: "USD", amountMinor: "2000", availableBalanceMinor: "6000", projectedBalanceMinor: "4000", approvalRequired: false, ...overrides });
}
function props(result: OwnerTrustExpensePreview = preview()): OwnerTrustExpensePreviewEvidenceProps {
  return Object.freeze({ state: "ready", propertyNode: "property-1", propertyLabel: "Original Yellow property",
    readIdentity: "read-1", draftIdentity: "draft-1", preview: result,
    draft: Object.freeze({ accountReference: result.accountReference, amountMinor: result.amountMinor, reason: "Repair the entrance" }) });
}
function render(input: unknown): ElementFixture {
  return renderOwnerTrustExpensePreviewEvidence(documentFixture as unknown as Document, input as OwnerTrustExpensePreviewEvidenceProps) as unknown as ElementFixture;
}
function descendants(root: ElementFixture, tag: string): ElementFixture[] {
  return root.children.flatMap(child => [...(child.tagName === tag ? [child] : []), ...descendants(child, tag)]);
}
function facts(root: ElementFixture): Array<[string, string]> {
  return descendants(root, "DIV").filter(row => row.children[0]?.tagName === "DT")
    .map(row => [row.children[0]!.textContent, row.children[1]!.textContent]);
}

test("native preview amounts and approval evidence are presented without action authority", () => {
  const root = render({ ...props(), formattedAmounts: { before: "USD 60.00", expense: "USD 20.00", projected: "USD 40.00" } });
  expect(root.getAttribute("data-evidence-state")).toBe("ready");
  expect(root.textContent).toContain("Riverstone Holdings");
  expect(root.textContent).toContain("Owner ledger");
  expect(facts(root)).toContainEqual(["Available trust funds before", "USD 60.00"]);
  expect(facts(root)).toContainEqual(["Expense", "USD 20.00"]);
  expect(facts(root)).toContainEqual(["Projected trust funds", "USD 40.00"]);
  expect(facts(root)).toContainEqual(["Approval requirement", "Approval not required"]);
  for (const tag of ["BUTTON", "FORM", "INPUT", "A", "SCRIPT", "IMG"]) expect(descendants(root, tag)).toHaveLength(0);
  expect(root.textContent).not.toMatch(/ready to post|ready to pay|approved funds|bank balance|profit|payment success|payout|settled/i);
});

test("literal required boolean stays separate from balances and never becomes approval or permission", () => {
  for (const required of [true, false]) {
    const root = render(props(preview({ approvalRequired: required, availableBalanceMinor: "-100", projectedBalanceMinor: "-300" })));
    expect(facts(root)).toContainEqual(["Approval requirement", required ? "Approval required" : "Approval not required"]);
    expect(facts(root)).toContainEqual(["Exact approvalRequired", String(required)]);
    expect(root.textContent).toContain("-300 USD minor units (raw)");
    expect(root.textContent).not.toMatch(/sufficient funds|approved|post now|route available/i);
  }
});

test("signed balances and unbounded exact amounts remain strings without conversion", () => {
  const balances = ["0", "-250", "9223372036854775807", "-9223372036854775808", "1".repeat(500)];
  for (const balance of balances) {
    const root = render(props(preview({ availableBalanceMinor: balance, projectedBalanceMinor: balance, amountMinor: "9".repeat(250) })));
    expect(facts(root)).toContainEqual(["Available trust funds before", `${balance} USD minor units (raw)`]);
    expect(facts(root)).toContainEqual(["Projected trust funds", `${balance} USD minor units (raw)`]);
    expect(facts(root)).toContainEqual(["Exact expense minor units", "9".repeat(250)]);
  }
});

test("supplied projected evidence is not recomputed or corrected by presentation", () => {
  const root = render(props(preview({ amountMinor: "100", availableBalanceMinor: "0", projectedBalanceMinor: "999", approvalRequired: true })));
  expect(facts(root)).toContainEqual(["Projected trust funds", "999 USD minor units (raw)"]);
  expect(facts(root)).toContainEqual(["Approval requirement", "Approval required"]);
  expect(root.getAttribute("data-evidence-state")).toBe("ready");
});

test("only exact echoed account and amount matches admit a preview", () => {
  const source = props();
  if (source.state !== "ready") throw Error("ready fixture");
  for (const change of [{ accountReference: "other-account" }, { amountMinor: "2001" }, { amountMinor: "02000" }, { amountMinor: 2000 }]) {
    const root = render({ ...source, draft: { ...source.draft, ...change } });
    expect(root.getAttribute("data-evidence-state")).toBe("unavailable");
    expect(root.textContent).not.toMatch(/Riverstone|Owner ledger|6000|Repair the entrance/);
    expect(descendants(root, "DETAILS")).toHaveLength(0);
  }
});

test("reason and property are explicitly caller-proposed without a fabricated native echo check", () => {
  const source = props();
  if (source.state !== "ready") throw Error("ready fixture");
  const root = render({ ...source, propertyNode: "caller-property", preview: { ...source.preview, propertyNode: "foreign-extra", reason: "different-extra" },
    draft: { ...source.draft, reason: "  Proposed reason with whitespace\n長い理由  " } });
  expect(root.getAttribute("data-evidence-state")).toBe("ready");
  expect(facts(root)).toContainEqual(["Caller-proposed reason", "  Proposed reason with whitespace\n長い理由  "]);
  expect(facts(root)).toContainEqual(["Caller property reference", "caller-property"]);
  expect(root.textContent).not.toContain("different-extra");
  expect(root.textContent).not.toContain("foreign-extra");
});

test("per-field formatting is verbatim, optional and never inherited or fabricated", () => {
  for (const [currency, amount, formatted] of [["JPY", "120", "JPY 120"], ["KWD", "1250", "KWD 1.250"], ["CLF", "12345", "CLF 1.2345"]]) {
    const root = render({ ...props(preview({ currency: currency!, amountMinor: amount! })), formattedAmounts: { expense: formatted } });
    expect(facts(root)).toContainEqual(["Expense", formatted!]);
    expect(facts(root)).toContainEqual(["Available trust funds before", `6000 ${currency} minor units (raw)`]);
  }
  const inherited = render({ ...props(), formattedAmounts: Object.create({ before: "USD 999.00" }) });
  expect(inherited.textContent).not.toContain("USD 999.00");
  const blank = render({ ...props(), formattedAmounts: { before: "  ", expense: null, projected: 1 } });
  expect(facts(blank)).toContainEqual(["Expense", "2000 USD minor units (raw)"]);
  expect(facts(blank)).toContainEqual(["Projected trust funds", "4000 USD minor units (raw)"]);
});

test("loading and unavailable replace all ready data without retaining a stale preview", () => {
  const ready = render(props());
  expect(descendants(ready, "DETAILS")).toHaveLength(2);
  for (const state of ["loading", "unavailable"]) {
    const root = render({ ...props(), state });
    expect(root.getAttribute("data-evidence-state")).toBe(state);
    expect(root.getAttribute("aria-busy")).toBe(state === "loading" ? "true" : "false");
    expect(root.textContent).not.toMatch(/Riverstone|6000|4000|2000|Repair the entrance|property-1|read-1|draft-1/);
    expect(descendants(root, "DETAILS")).toHaveLength(0);
  }
});

test("unknown malformed evidence fails closed rather than zero or partially valid preview", () => {
  const source = props();
  if (source.state !== "ready") throw Error("ready fixture");
  const invalid: unknown[] = [null, [], {}, { ...source, state: "stale" }, { ...source, readIdentity: "" }, { ...source, draftIdentity: null },
    { ...source, propertyNode: undefined }, { ...source, preview: null }, { ...source, formattedAmounts: [] },
    { ...source, draft: { ...source.draft, reason: " " } },
    ...[undefined, null, 0, "01", "-0", "1.5", "1e3", "NaN"].map(value => ({ ...source, preview: { ...source.preview, availableBalanceMinor: value } })),
    ...["0", "-1", "01", 1].map(value => ({ ...source, preview: { ...source.preview, amountMinor: value } })),
    { ...source, preview: { ...source.preview, approvalRequired: "false" } }, { ...source, preview: { ...source.preview, currency: "usd" } },
  ];
  for (const input of invalid) {
    const root = render(input);
    expect(root.getAttribute("data-evidence-state")).toBe("unavailable");
    expect(descendants(root, "DETAILS")).toHaveLength(0);
    expect(root.textContent).not.toMatch(/Riverstone|Owner ledger|6000|4000/);
  }
});

test("all used accessor fields are rejected without executing hostile getters", () => {
  const source = props();
  if (source.state !== "ready") throw Error("ready fixture");
  let calls = 0;
  const hostile = { get value(): never { calls++; throw Error("getter must not execute"); } };
  const descriptor = Object.getOwnPropertyDescriptor(hostile, "value")!;
  for (const name of ["state", "propertyNode", "preview", "draft", "formattedAmounts"]) {
    const malformed = { ...source }; Object.defineProperty(malformed, name, descriptor);
    expect(render(malformed).getAttribute("data-evidence-state")).toBe("unavailable");
  }
  for (const [key, original] of [["preview", source.preview], ["draft", source.draft], ["formattedAmounts", { before: "USD 60" }]] as const) {
    const copy = { ...original }; Object.defineProperty(copy, key === "preview" ? "ownerLabel" : key === "draft" ? "reason" : "before", descriptor);
    expect(render({ ...source, [key]: copy }).getAttribute("data-evidence-state")).toBe("unavailable");
  }
  expect(calls).toBe(0);
});

test("hostile strings stay inert, frozen inputs survive and even equal reads reset Details", () => {
  const text = '<img src=x onerror=window.hostile=1><script>danger()</script>' + "長".repeat(500);
  const input = props(preview({ accountLabel: text, ownerLabel: text }));
  const before = JSON.stringify(input);
  const root = render(input);
  expect(root.textContent).toContain(text);
  expect(descendants(root, "IMG")).toHaveLength(0);
  expect(descendants(root, "SCRIPT")).toHaveLength(0);
  descendants(root, "DETAILS")[0]!.setAttribute("open", "");
  for (const readIdentity of ["read-1", "read-2"]) {
    const fresh = render({ ...input, readIdentity });
    expect(fresh).not.toBe(root);
    expect(descendants(fresh, "DETAILS").every(detail => detail.getAttribute("open") === null)).toBe(true);
    expect(fresh.getAttribute("data-read-identity")).toBe(readIdentity);
  }
  expect(JSON.stringify(input)).toBe(before);
});

test("empty native labels and unknown currency stay explicit instead of invented names or values", () => {
  const root = render(props(preview({ accountLabel: "", ownerLabel: "", currency: "XXX" })));
  expect(root.textContent).toContain("Account label not supplied");
  expect(root.textContent).toContain("Owner label not supplied");
  expect(root.textContent).toContain("2000 XXX minor units (raw)");
});
