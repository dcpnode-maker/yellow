import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { location: { pathname: "/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today", search: "" } },
});
const { previewMatchesFolioTransferDraft, submitFolioTransfer, validateFolioTransferReceipt } =
  // @ts-expect-error The root checker intentionally excludes JSX; Bun executes this focused runtime import.
  await import("../frontend/yellow/src/App.tsx");

const sourceFolioId = "11111111-1111-4111-8111-111111111111";
const destinationFolioId = "22222222-2222-4222-8222-222222222222";
const transferGroupId = "33333333-3333-4333-8333-333333333333";
const rootLineId = "44444444-4444-4444-8444-444444444444";
const journalId = "55555555-5555-4555-8555-555555555555";

function canonicalReceipt(): Record<string, unknown> {
  return {
    businessDate: "2026-09-21",
    currency: "INR",
    destinationAfterMinor: "4800",
    destinationBeforeMinor: "0",
    destinationFolioId,
    destinationName: "Colleague folio",
    destinationWindowNo: 2,
    generation: "generation-1",
    journalId,
    memberEffects: [{
      amountMinor: "4800",
      description: "Dinner",
      destinationEffectMinor: "4800",
      groupId: transferGroupId,
      quantity: "1.000",
      rootLineId,
      sourceEffectMinor: "-4800",
      txCode: "FNB",
    }],
    previewRevision: "preview-1",
    replayed: false,
    sourceAfterMinor: "0",
    sourceBeforeMinor: "4800",
    sourceFolioId,
    stayTotalMinor: "4800",
    unchangedStayTotalMinor: "4800",
  };
}

function canonicalDraft(destinationId: string | null = destinationFolioId, newWindowName: string | null = null) {
  return {
    sourceFolioId,
    destinationFolioId: destinationId,
    newWindowName,
    groupIds: [transferGroupId],
    reason: "Separate colleague expense",
    generation: "generation-1",
    previewRevision: "preview-1",
  };
}

function sourceBetween(start: string, end: string): string {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Missing source boundary: ${start}`);
  return app.slice(from, to);
}

test("bill-window routing accepts complete server groups rather than partial money or quantities", () => {
  const draft = sourceBetween("const allocationDraftFor", "const previewBillWindowAllocation");
  expect(draft).toContain("sourceFolioId");
  expect(draft).toContain("destinationFolioId");
  expect(draft).toContain("newWindowName");
  expect(draft).toContain("groupIds");
  expect(draft).toContain("reason");
  expect(draft).toContain("generation");
  expect(draft).toContain("previewRevision");
  expect(draft).not.toContain("amountMinor");
  expect(draft).not.toContain("quantity");
  expect(app).toContain("group.eligible && group.currentWindowId === folio.data?.folio.id");
  expect(app).toContain("Already routed to Window");
  expect(app).toContain("Ineligible for transfer");
});

test("preview and commit reuse only the canonical transfer endpoints and exact draft body", () => {
  const preview = sourceBetween("async function requestFolioTransferPreview", "async function submitFolioTransfer");
  const commit = sourceBetween("async function submitFolioTransfer", "function wakeReply");
  expect(preview).toContain("/transfers:preview");
  expect(preview).toContain("body: JSON.stringify(draft)");
  expect(preview).not.toContain('"idempotency-key"');
  expect(commit).toContain("/transfers");
  expect(commit).toContain('"idempotency-key": idempotencyKey');
  expect(commit).toContain("body: JSON.stringify(draft)");
  expect(commit).not.toContain("amountMinor");
});

test("first commit refreshes and re-previews, while any drift clears confirmation", () => {
  const reconcile = sourceBetween("const reconcileBillWindowAllocation", "const toggleAllocationGroup");
  const sourceRead = reconcile.indexOf("const freshSource = await loadFolioStatement");
  const freshPreview = reconcile.indexOf("const freshPreview = await requestFolioTransferPreview");
  const submit = reconcile.indexOf("const receipt = await submitFolioTransfer");
  expect(sourceRead).toBeGreaterThanOrEqual(0);
  expect(freshPreview).toBeGreaterThan(sourceRead);
  expect(submit).toBeGreaterThan(freshPreview);
  expect(reconcile).toContain("if (!sameTransferPreview(freshPreview, originalPreview))");
  expect(reconcile).toContain("setAllocationConfirmed(false)");
  expect(reconcile).toContain("The bill-window preview drifted before submission. Nothing was transferred.");
});

test("uncertain attempts retain the same key and reconcile both authoritative statements", () => {
  const reconcile = sourceBetween("const reconcileBillWindowAllocation", "const toggleAllocationGroup");
  expect(reconcile).toContain("retryingRetainedAttempt = allocationUncertainAttempt !== null");
  expect(reconcile).toContain("attempt = allocationUncertainAttempt");
  expect(reconcile).toContain("setAllocationUncertainAttempt(attempt)");
  expect(reconcile).toContain("loadFolioStatement(receipt.sourceFolioId)");
  expect(reconcile).toContain("loadFolioStatement(destinationFolioId)");
  expect(reconcile).toContain("sourceStatement.balanceMinor === receipt.sourceAfterMinor");
  expect(reconcile).toContain("destinationStatement.balanceMinor === receipt.destinationAfterMinor");
  expect(reconcile).toContain("sourceStatement.stayTotalMinor === receipt.stayTotalMinor");
  expect(reconcile).toContain("destinationStatement.stayTotalMinor === receipt.stayTotalMinor");
  expect(reconcile).toContain("rows.some((row) => row.journalId === receipt.journalId)");
});

test("receipt parsing and mobile controls are exact and safe", () => {
  expect(app).toContain("const FOLIO_TRANSFER_RECEIPT_KEYS");
  expect(app).toContain("function validateFolioTransferReceipt");
  expect(app).toContain("Yellow retained this exact operation for same-key reconciliation.");
  expect(app).toContain('data-lifecycle-recovery={allocationUncertainAttempt ? "true" : undefined}');
  expect(app).toContain('aria-label="Transfer destination"');
  expect(css).toContain(".cashier-allocation-group-list label,.cashier-allocation-destination-list label { display: flex; align-items: start; gap: 9px; min-width: 0; min-height: 44px;");
  expect(css).toContain(".cashier-allocation-actions button,.cashier-allocation-commit { min-height: 44px;");
  expect(css).toContain(".cashier-allocation-preview { grid-template-columns: 1fr; }");
});

test("the actual receipt helper accepts the canonical sorted receipt key set", () => {
  const receipt = validateFolioTransferReceipt(canonicalReceipt());
  expect(receipt.journalId).toBe(journalId);
  expect(receipt.destinationFolioId).toBe(destinationFolioId);
});

test("preview matching uses the selected sibling name and keeps exact new-window naming", () => {
  const receipt = validateFolioTransferReceipt(canonicalReceipt());
  const existingDraft = canonicalDraft();
  expect(previewMatchesFolioTransferDraft(receipt, existingDraft, "INR", "Colleague folio")).toBe(true);
  expect(previewMatchesFolioTransferDraft(receipt, existingDraft, "INR", null)).toBe(false);

  const newWindowReceipt = { ...canonicalReceipt(), destinationFolioId: null, destinationName: "Meals" };
  const newWindowPreview = validateFolioTransferReceipt(newWindowReceipt);
  const newWindowDraft = canonicalDraft(null, "Meals");
  expect(previewMatchesFolioTransferDraft(newWindowPreview, newWindowDraft, "INR", null)).toBe(true);
  expect(previewMatchesFolioTransferDraft(newWindowPreview, newWindowDraft, "INR", "Wrong authoritative sibling")).toBe(true);
  expect(previewMatchesFolioTransferDraft(
    validateFolioTransferReceipt({ ...newWindowReceipt, destinationName: "Meals copied" }),
    newWindowDraft,
    "INR",
    null,
  )).toBe(false);
});

test("every malformed HTTP 2xx transfer receipt retains same-key recovery", async () => {
  const originalFetch = globalThis.fetch;
  const draft = canonicalDraft();
  const attempts: Array<Readonly<{ url: string; init: RequestInit | undefined }>> = [];
  const malformedReceipts = [
    { ...canonicalReceipt(), memberEffects: [] },
    { ...canonicalReceipt(), unexpected: "hostile field" },
    { ...canonicalReceipt(), destinationFolioId: "not-a-folio-id" },
  ];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    attempts.push({ url, init });
    if (url === "/api/v1/auth/demo:enter") {
      return new Response(JSON.stringify({ accessToken: "test-token" }), { status: 200 });
    }
    if (url.endsWith("/transfers")) {
      return new Response(JSON.stringify(malformedReceipts.shift()), { status: 201 });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
  try {
    for (const key of ["yellow-folio-transfer-r1-same-key-1", "yellow-folio-transfer-r1-same-key-2", "yellow-folio-transfer-r1-same-key-3"]) {
      try {
        await submitFolioTransfer(draft, key);
        throw new Error("Expected malformed 2xx receipt to be uncertain.");
      } catch (error) {
        expect((error as { uncertain?: unknown }).uncertain).toBe(true);
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  const transfers = attempts.filter((attempt) => attempt.url.endsWith("/transfers"));
  expect(transfers).toHaveLength(3);
  for (const [index, transfer] of transfers.entries()) {
    expect(transfer.init?.body).toBe(JSON.stringify(draft));
    expect(new Headers(transfer.init?.headers).get("idempotency-key")).toBe(`yellow-folio-transfer-r1-same-key-${index + 1}`);
  }
});
