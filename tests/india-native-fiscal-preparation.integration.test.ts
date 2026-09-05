import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

const draft = new URL("../handoff/drafts/order434/0076-native-preparation.sql", import.meta.url);
const deployUrl = process.env.YELLOW_ORDER434_NATIVE_ACCOUNTING_DEPLOY_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER434_NATIVE_ACCOUNTING_DATABASE === "1" && !deployUrl) {
  throw new Error("Order434 preparation proof requires the explicit synthetic deploy database URL");
}
const databaseDescribe = deployUrl ? describe.serial : describe.skip;
type ObjectValue = Record<string, unknown>;
type BasisParts = {
  context: ObjectValue;
  nativeInput: ObjectValue;
  nativeResult: ObjectValue;
  valuation: ObjectValue;
  prepared: ObjectValue;
  nature: ObjectValue;
  composition: ObjectValue;
  series: ObjectValue;
};
const id = (suffix: number): string => `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const hash = "a".repeat(64);

// Serialization-only inputs, never inserted as hotel/fiscal evidence. Real
// persisted producer parity is exercised by the accounting writer suite.
function parts(): BasisParts {
  const context: ObjectValue = {
    tenantId: id(1), propertyNode: id(2), reservationId: id(3), folioId: id(4), actorId: id(5),
    valuationId: id(6), nativeTimingId: id(7), prospectiveDocumentId: id(8), seriesId: id(9),
    applicabilityId: id(10), taxId: id(11), accountingBindingId: id(12), requestId: id(13),
    requestKeyHash: hash, requestHash: "b".repeat(64), requestEventId: id(14),
    issuingTransactionId: "429", transactionTimestamp: "2026-03-31T20:00:00.000001Z",
    propertyTimezone: "Asia/Kolkata", invoiceIssueDate: "2026-04-01",
  };
  const scope = { tenantId: id(1), propertyNode: id(2), reservationId: id(3), folioId: id(4) };
  const timing = { nativeTimingId: id(7), prospectiveDocumentId: id(8), invoiceIssueDate: "2026-04-01" };
  const valuation: ObjectValue = {
    valuationId: id(6), generation: 0, actorId: id(5), requestId: id(13),
    recordedAt: "2026-03-30T10:00:00.000000Z", evidenceHash: hash, nativeConsiderationBasisHash: hash,
    basis: { ...scope, buyerPartyId: id(15) }, sourceClosure: {}, intake: {},
  };
  return {
    context,
    nativeInput: {
      kind: "native_current_transaction", tenantId: id(1), propertyNode: id(2), reservationId: id(3),
      serviceProvision: {}, paymentReceipt: {}, ordinaryRegime: {}, nativeTiming: timing,
      rateVersionPair: {}, rateChangeDateEvidence: {}, historicalResolutions: {}, section14PaymentEvidence: null,
    },
    nativeResult: { kind: "native_current_transaction", timing, rateSource: {}, evidenceHash: hash },
    valuation,
    prepared: {
      tenantId: id(1), legalBuyerPartyId: id(15), sellerRegistration: { registrationId: id(16) },
      recipientRegistration: {}, placeOfSupply: {}, classification: {}, supplyNatureAtTimeOfSupplyInput: {},
      supplyNatureAtTimeOfSupplyResult: scope,
    },
    nature: scope,
    composition: {
      componentFamilyCanonicalJson: "{}", levyInputBundleCanonicalJson: "{}", levyComponentIdentityCanonicalJson: "{}",
      quotedApplicabilityCanonicalJson: JSON.stringify({ kind: "native_current_transaction", nativeTiming: timing }),
      finalTaxCanonicalJson: JSON.stringify({ kind: "native_current_transaction", nativeTimingId: id(7), valuationId: id(6) }),
      taxPreview: { valuationId: id(6) },
    },
    series: { tenantId: id(1), propertyNode: id(2), seriesId: id(9), supplierRegistrationId: id(16),
      kind: "invoice", fiscal: true, financialYearStart: "2026-04-01", prefix: "I/2627/" },
  };
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as ObjectValue;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

function domain(input: BasisParts): ObjectValue {
  return {
    kind: "india-native-fiscal-preparation-source-v1", context: input.context,
    nativeInvoiceSourceInputCanonicalJson: JSON.stringify(input.nativeInput),
    nativeInvoiceSourceResultCanonicalJson: JSON.stringify(input.nativeResult),
    valuationEvidence: input.valuation, preparedSourceCanonicalJson: JSON.stringify(input.prepared),
    serviceSupplyNatureCanonicalJson: JSON.stringify(input.nature), quotedTaxComposition: input.composition,
    seriesIdentity: input.series,
  };
}

describe("Order434 preparation source basis contract", () => {
  test("stays private, pure and separate from the real source authenticator", async () => {
    const complete = await Bun.file(draft).text();
    const start = complete.indexOf("CREATE OR REPLACE FUNCTION public.india_native_preparation_source_basis(");
    expect(start).toBeGreaterThan(0);
    const end = complete.indexOf("FROM PUBLIC,app_role,yellow_runtime;", start);
    const source = complete.slice(start, end + "FROM PUBLIC,app_role,yellow_runtime;".length);
    expect(source).toContain("RETURNS jsonb LANGUAGE plpgsql IMMUTABLE");
    expect(source).toContain("OWNER TO yellow_owner");
    expect(source).toContain("REVOKE ALL ON FUNCTION public.india_native_preparation_source_basis");
    expect(source).toContain("FROM PUBLIC,app_role,yellow_runtime");
    expect(source).not.toMatch(/(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|pg_advisory_xact_lock|nextval\s*\()/i);
    expect(source).not.toContain("SECURITY DEFINER");
  });

  test("current-transaction authenticator reconstructs records before comparing the persisted projection", async () => {
    const complete = await Bun.file(draft).text();
    const start = complete.indexOf("CREATE OR REPLACE FUNCTION public.assert_india_native_preparation_authenticity(");
    expect(start).toBeGreaterThan(0);
    const end = complete.indexOf("FROM PUBLIC,app_role,yellow_runtime;", start);
    const source = complete.slice(start, end + "FROM PUBLIC,app_role,yellow_runtime;".length);
    for (const reader of [
      "read_india_native_issue_authority", "read_india_native_invoice_timing_source",
      "read_india_native_valuation_evidence", "read_india_native_rate_history_day",
      "read_india_native_statutory_root_graph", "compose_india_native_quoted_tax_source",
      "india_native_preparation_source_basis", "assert_india_native_persisted_tax_projection",
      "assert_india_native_accounting_request",
    ]) expect(source).toContain(`public.${reader}(`);
    expect(source).toContain("n.issuing_transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()");
    expect(source).toContain("n.transaction_timestamp IS DISTINCT FROM pg_catalog.transaction_timestamp()");
    expect(source).toContain("public.india_native_source_hash(v_request) IS DISTINCT FROM n.request_hash");
    expect(source).toContain("v_basis->>'sourceBasisHash' IS DISTINCT FROM n.native_source_basis_hash");
    expect(source.indexOf("public.india_native_preparation_source_basis(")).toBeLessThan(
      source.indexOf("public.assert_india_native_persisted_tax_projection("),
    );
    expect(source).not.toMatch(/(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|pg_advisory_xact_lock|nextval\s*\()/i);
    expect(source).not.toContain("SECURITY DEFINER");
    // Static dependency/contract proof only; no claim of governed positive issue.
  });
});

databaseDescribe("Order434 source-basis pure SQL integration (not invoice issuance)", () => {
  let deploy: SQL;
  beforeAll(() => { deploy = new SQL(deployUrl!, { max: 2, prepare: false }); });
  afterAll(async () => { await deploy?.close(); });

  async function evaluate(input: BasisParts, nativeInputText = JSON.stringify(input.nativeInput)) {
    return deploy.begin(async tx => {
      await tx`SET TRANSACTION READ ONLY`;
      await tx`SET LOCAL ROLE yellow_owner`;
      const [result] = await tx`
        SELECT public.india_native_preparation_source_basis(
          ${JSON.stringify(input.context)}::jsonb,${nativeInputText}::text,
          ${JSON.stringify(input.nativeResult)}::text,${JSON.stringify(input.valuation)}::jsonb,
          ${JSON.stringify(input.prepared)}::text,${JSON.stringify(input.nature)}::text,
          ${JSON.stringify(input.composition)}::jsonb,${JSON.stringify(input.series)}::jsonb) AS basis`;
      if (!result) throw new Error("source-basis query returned no row");
      return result.basis as { preimageCanonicalJson: string; sourceBasisHash: string };
    });
  }

  async function expectConflict(operation: Promise<unknown>): Promise<void> {
    let caught: unknown;
    try { await operation; } catch (error) { caught = error; }
    expect(caught).toBeDefined();
    const error = caught as { errno?: unknown; sqlState?: unknown; code?: unknown };
    expect(String(error.errno ?? error.sqlState ?? error.code)).toBe("55000");
  }

  test("matches independent exact canonical preimage and SHA256 in a read-only transaction", async () => {
    const input = parts();
    const expected = canonical(domain(input));
    const actual = await evaluate(input);
    expect(Object.keys(actual).sort()).toEqual(["preimageCanonicalJson", "sourceBasisHash"]);
    expect(actual.preimageCanonicalJson).toBe(expected);
    expect(actual.sourceBasisHash).toBe(new Bun.CryptoHasher("sha256").update(expected).digest("hex"));
    expect(await evaluate(input)).toEqual(actual);
  });

  test("ignores JSONB object insertion order while binding original artifact bytes", async () => {
    const input = parts();
    const initial = await evaluate(input);
    input.context = Object.fromEntries(Object.entries(input.context).reverse());
    input.series = Object.fromEntries(Object.entries(input.series).reverse());
    input.valuation = Object.fromEntries(Object.entries(input.valuation).reverse());
    expect(await evaluate(input)).toEqual(initial);
    input.nativeInput = Object.fromEntries(Object.entries(input.nativeInput).reverse());
    const reorderedArtifact = await evaluate(input);
    expect(reorderedArtifact.sourceBasisHash).not.toBe(initial.sourceBasisHash);
    expect(reorderedArtifact.preimageCanonicalJson).toBe(canonical(domain(input)));
  });

  test("binds each generated downstream identity without an accounting/document hash cycle", async () => {
    const initial = await evaluate(parts());
    for (const key of ["applicabilityId", "taxId", "accountingBindingId", "requestId", "requestEventId"]) {
      const input = parts();
      input.context[key] = id(100);
      expect((await evaluate(input)).sourceBasisHash).not.toBe(initial.sourceBasisHash);
    }
    const object = JSON.parse(initial.preimageCanonicalJson) as ObjectValue;
    expect(Object.keys(object)).toHaveLength(9);
    expect(Object.keys(object.context as ObjectValue)).toHaveLength(20);
    expect(Object.keys(object.seriesIdentity as ObjectValue)).toHaveLength(8);
  });

  test("validates the property-local April1 boundary, not the UTC date", async () => {
    expect((await evaluate(parts())).sourceBasisHash).toMatch(/^[0-9a-f]{64}$/);
    const incorrect = parts();
    incorrect.context.invoiceIssueDate = "2026-03-31";
    await expectConflict(evaluate(incorrect));
    const previousYear = parts();
    previousYear.series.financialYearStart = "2025-04-01";
    await expectConflict(evaluate(previousYear));
  });

  test("rejects missing, extra and incorrectly typed envelope fields", async () => {
    const inputs = [parts(), parts(), parts(), parts()];
    delete inputs[0]!.context.requestEventId;
    inputs[1]!.context.requestEventSeq = "100";
    inputs[2]!.series.nextNo = "1";
    inputs[3]!.context.issuingTransactionId = 429;
    for (const input of inputs) await expectConflict(evaluate(input));
  });

  test("rejects mismatched scope, valuation and configured series identity", async () => {
    const inputs = [parts(), parts(), parts()];
    inputs[0]!.nativeInput.tenantId = id(100);
    inputs[1]!.valuation.valuationId = id(100);
    inputs[2]!.series.supplierRegistrationId = id(100);
    for (const input of inputs) await expectConflict(evaluate(input));
  });

  test("requires compact insertion-canonical JSON objects and six-fraction UTC timestamps", async () => {
    const input = parts();
    await expectConflict(evaluate(input, JSON.stringify(input.nativeInput, null, 2)));
    await expectConflict(evaluate(input, "[]"));
    input.context.transactionTimestamp = "2026-03-31T20:00:00Z";
    await expectConflict(evaluate(input));
  });

  test("has only owner execution and does not introduce a runtime authority", async () => {
    const [metadata] = await deploy`
      SELECT p.provolatile,p.prosecdef,pg_get_userbyid(p.proowner) AS owner,
        has_function_privilege('app_role',p.oid,'EXECUTE') AS app_execute,
        has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS runtime_execute
      FROM pg_proc p WHERE p.oid=
        'public.india_native_preparation_source_basis(jsonb,text,text,jsonb,text,text,jsonb,jsonb)'::regprocedure`;
    expect(metadata).toMatchObject({ provolatile: "i", prosecdef: false, owner: "yellow_owner", app_execute: false, runtime_execute: false });
  });

  test("keeps the prospective authenticator invoker-private pending full governed integration", async () => {
    const [metadata] = await deploy`
      SELECT p.provolatile,p.prosecdef,pg_get_userbyid(p.proowner) AS owner,
        has_function_privilege('app_role',p.oid,'EXECUTE') AS app_execute,
        has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS runtime_execute
      FROM pg_proc p WHERE p.oid='public.assert_india_native_preparation_authenticity(uuid,uuid)'::regprocedure`;
    expect(metadata).toMatchObject({ provolatile: "v", prosecdef: false, owner: "yellow_owner", app_execute: false, runtime_execute: false });
  });
});
