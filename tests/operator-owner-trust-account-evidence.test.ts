import { expect, test } from "bun:test";
import type { OwnerTrustAccountView } from "../src/contexts/financials";
import { renderOwnerTrustAccountEvidence, type OwnerTrustAccountEvidenceProps } from "../src/http/operator/owner-trust-account-evidence.mjs";

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
const propertyNode = "00000000-0000-4000-8000-000000000001";
function account(index = 1, overrides: Partial<OwnerTrustAccountView> = {}): OwnerTrustAccountView {
  return Object.freeze({ accountReference: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    accountLabel: "Owner ledger", ownerLabel: "Riverstone Holdings", currency: "USD",
    availableBalanceMinor: "6000", canPost: true, ...overrides });
}
function props(accounts: readonly OwnerTrustAccountView[] = [account()], nextCursor: string | null = null): OwnerTrustAccountEvidenceProps {
  return Object.freeze({ state: "ready", propertyNode, propertyLabel: "Original Yellow property",
    readIdentity: "accepted-read-1", page: Object.freeze({ accounts: Object.freeze([...accounts]), nextCursor }) });
}
function render(input: unknown): ElementFixture {
  return renderOwnerTrustAccountEvidence(documentFixture as unknown as Document, input as OwnerTrustAccountEvidenceProps) as unknown as ElementFixture;
}
function descendants(root: ElementFixture, tag: string): ElementFixture[] {
  return root.children.flatMap(child => [...(child.tagName === tag ? [child] : []), ...descendants(child, tag)]);
}
const cards = (root: ElementFixture) => descendants(root, "ARTICLE");

test("renders the minimized native account evidence and literal route hint without granting actions", () => {
  const root = render({ ...props(), formattedBalances: { [account().accountReference]: "USD 60.00" } });
  expect(cards(root)).toHaveLength(1);
  expect(root.textContent).toContain("Riverstone Holdings");
  expect(root.textContent).toContain("Owner ledger");
  expect(root.textContent).toContain("Available trust funds");
  expect(root.textContent).toContain("USD 60.00");
  expect(root.textContent).toContain("Expense route available");
  for (const tag of ["BUTTON", "FORM", "INPUT", "A", "SCRIPT"]) expect(descendants(root, tag)).toHaveLength(0);
  expect(root.textContent).not.toMatch(/ready to pay|approved funds|profit|payout complete|bank balance/i);
});

test("every row and input order survive duplicate labels and even repeated references", () => {
  const rows = Object.freeze(Array.from({ length: 100 }, (_, i) => account(i + 1, {
    accountLabel: "Duplicate label", ownerLabel: "Same owner", canPost: i % 2 === 0,
  })));
  const root = render(props(rows, "100"));
  expect(cards(root)).toHaveLength(100);
  expect(cards(root).map(row => row.getAttribute("data-account-reference"))).toEqual(rows.map(row => row.accountReference));
  expect(root.textContent).toContain("100 account rows in this returned page");
  expect(root.textContent).toContain("More rows are available");
  const repeated = render(props([rows[0]!, rows[0]!], null));
  expect(cards(repeated)).toHaveLength(2);
  expect(repeated.textContent).toContain("2 account rows");
});

test("missing formatting preserves exact raw positive zero negative and arbitrarily large integer strings", () => {
  const amounts = ["123", "0", "-250", "9223372036854775807", "-9223372036854775808", "123456789012345678901234567890"];
  for (const amount of amounts) {
    const root = render(props([account(1, { availableBalanceMinor: amount })]));
    expect(root.textContent).toContain(`${amount} USD minor units (raw)`);
    expect(root.textContent).not.toContain("USD 0.00");
  }
});

test("caller formatting is used verbatim with currency-specific precision and no mixed-currency sum", () => {
  const rows = [account(1, { currency: "JPY", availableBalanceMinor: "120" }), account(2, { currency: "KWD", availableBalanceMinor: "-1250" }), account(3, { currency: "CLF", availableBalanceMinor: "12345" })];
  const formats = Object.freeze({ [rows[0]!.accountReference]: "JPY 120", [rows[1]!.accountReference]: "KWD -1.250", [rows[2]!.accountReference]: "CLF 1.2345" });
  const root = render({ ...props(rows), formattedBalances: formats });
  for (const value of Object.values(formats)) expect(root.textContent).toContain(value);
  expect(root.textContent).not.toMatch(/portfolio total|total funds|combined balance/i);
});

test("false canPost and negative funds remain independent truthful evidence", () => {
  const root = render(props([account(1, { canPost: false, availableBalanceMinor: "10000" }), account(2, { canPost: true, availableBalanceMinor: "-1000" })]));
  expect(cards(root)[0]!.textContent).toContain("Expense route unavailable");
  expect(cards(root)[1]!.textContent).toContain("Expense route available");
  expect(cards(root)[1]!.textContent).toContain("-1000 USD minor units (raw)");
  expect(root.textContent).not.toMatch(/sufficient funds|approved|post now/i);
});

test("empty admitted page is distinguished from unavailable and loading without retaining prior evidence", () => {
  const empty = render(props([], "50"));
  expect(empty.textContent).toContain("No account rows were returned in this page");
  expect(empty.textContent).toContain("More rows are available");
  const emptyFinal = render(props([], null));
  expect(emptyFinal.textContent).toContain("No further page cursor returned");
  for (const state of ["loading", "unavailable"] as const) {
    const root = render({ ...props(), state });
    expect(cards(root)).toHaveLength(0);
    expect(root.textContent).not.toMatch(/Riverstone|Owner ledger|6000|00000000|accepted-read/);
    expect(root.getAttribute("data-evidence-state")).toBe(state);
  }
});

test("malformed evidence fails unavailable atomically rather than showing an empty or partly valid page", () => {
  const good = account();
  const cases: unknown[] = [null, [], {}, { ...props(), state: "stale" }, { ...props(), propertyNode: undefined },
    { ...props(), readIdentity: "" }, { ...props(), page: { accounts: [], nextCursor: undefined } },
    ...[undefined, null, 0, "NaN", "01", "-0", "1.5", "1e3"].map(amount => ({ ...props(), page: { accounts: [good, { ...good, availableBalanceMinor: amount }], nextCursor: null } })),
    { ...props(), page: { accounts: [{ ...good, canPost: "false" }], nextCursor: null } },
    { ...props(), page: { accounts: [{ ...good, currency: null }], nextCursor: null } },
    { ...props(), page: { accounts: new Array(2), nextCursor: null } },
  ];
  for (const input of cases) {
    const root = render(input);
    expect(root.getAttribute("data-evidence-state")).toBe("unavailable");
    expect(cards(root)).toHaveLength(0);
    expect(root.textContent).not.toContain("Riverstone");
    expect(root.textContent).not.toContain("6000");
  }
});

test("unknown native labels are literal and absent formatting does not inherit or fabricate an amount", () => {
  const row = account(1, { ownerLabel: "Unknown", accountLabel: "", currency: "XXX" });
  const root = render({ ...props([row]), formattedBalances: Object.create({ [row.accountReference]: "USD 99999.00" }) });
  expect(root.textContent).toContain("Unknown");
  expect(root.textContent).toContain("Account label not supplied");
  expect(root.textContent).toContain("6000 XXX minor units (raw)");
  expect(root.textContent).not.toContain("USD 99999.00");
  for (const format of [undefined, null, "", "   ", 0]) {
    const raw = render({ ...props(), formattedBalances: { [account().accountReference]: format } });
    expect(raw.textContent).toContain("6000 USD minor units (raw)");
  }
});

test("selected row is marked without filtering; missing selection is explicit; references live in Details", () => {
  const rows = [account(1), account(2)];
  const root = render({ ...props(rows, "50"), selectedAccountReference: rows[1]!.accountReference });
  expect(cards(root)).toHaveLength(2);
  expect(cards(root)[0]!.getAttribute("data-selected")).toBe("false");
  expect(cards(root)[1]!.getAttribute("data-selected")).toBe("true");
  expect(cards(root)[1]!.textContent).toContain("Selected account");
  const outside = render({ ...props(rows), selectedAccountReference: "not-in-page" });
  expect(outside.textContent).toContain("Selected account is not in this returned page");
  expect(descendants(root, "DETAILS")).toHaveLength(3);
  expect(descendants(root, "DETAILS").every(detail => detail.getAttribute("open") === null)).toBe(true);
});

test("long and hostile strings are text only; immutable inputs are unchanged and disclosure is fresh each render", () => {
  const hostile = '<img src=x onerror="globalThis.changed=true">' + "A".repeat(800);
  const row = account(1, { ownerLabel: hostile, accountLabel: "<script>danger()</script>" });
  const frozen = props([row]);
  const snapshot = JSON.stringify(frozen);
  const root = render(frozen);
  expect(root.textContent).toContain(hostile);
  expect(descendants(root, "IMG")).toHaveLength(0);
  expect(descendants(root, "SCRIPT")).toHaveLength(0);
  expect(JSON.stringify(frozen)).toBe(snapshot);
  descendants(root, "DETAILS")[0]!.setAttribute("open", "");
  const fresh = render({ ...frozen, readIdentity: "accepted-read-2" });
  expect(fresh).not.toBe(root);
  expect(descendants(fresh, "DETAILS").every(detail => detail.getAttribute("open") === null)).toBe(true);
  expect(fresh.getAttribute("data-read-identity")).toBe("accepted-read-2");
});

test("throwing malformed accessors do not escape or leave previously admitted account evidence", () => {
  const malformed = { ...props(), get page(): never { throw new Error("untrusted shape"); } };
  expect(() => render(malformed)).not.toThrow();
  expect(render(malformed).getAttribute("data-evidence-state")).toBe("unavailable");
});
