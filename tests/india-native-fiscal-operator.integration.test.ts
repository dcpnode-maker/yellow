import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  IndiaNativeFiscalInvoiceIssuanceService,
  IndiaNativeFiscalInvoiceStaleEvidenceError,
} from "../src/contexts/tax-fiscal/india-native-fiscal-invoice";
import { IndiaNativeFiscalOperatorReadService } from
  "../src/contexts/tax-fiscal/india-native-fiscal-operator";
import { Database } from "../src/kernel";
import {
  addOperatorInvoiceRecipient,
  addOperatorIssueDateSupplierStatus,
  createOperatorInvoiceFixture,
  discoverOperatorInvoice,
  issueConfirmedOperatorInvoice,
  issueOperatorInvoice,
  moveOperatorFixtureIssueClock,
  operatorInvoiceArtifactSnapshot,
} from "./fixtures/order440-operator-invoices";

const deployUrl = process.env.YELLOW_ORDER440_Q208_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER440_Q208_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER440_Q208_DATABASE === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Order440 Q208 proof requires explicit deploy and runtime URLs");
}
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;

function sqlState(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as { readonly errno?: unknown; readonly code?: unknown };
  return typeof record.errno === "string" ? record.errno
    : typeof record.code === "string" ? record.code : undefined;
}

async function expectState(operation: () => Promise<unknown>, state: string) {
  try { await operation(); } catch (error) { expect(sqlState(error)).toBe(state); return; }
  throw new Error(`Expected PostgreSQL SQLSTATE ${state}`);
}

databaseDescribe("Order440 Q208 governed operator invoice workflow", () => {
  let deploy: SQL;
  let runtime: Database;

  beforeAll(() => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false, connectionTimeout: 5, idleTimeout: 5 });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 8, prepare: false });
  });
  afterAll(async () => { await runtime?.close();await deploy?.close(); });

  test("installs exact owner/app capabilities while keeping new permission unassigned", async () => {
    const signatures = [
      "list_india_native_fiscal_documents(uuid,uuid,uuid,date,date,uuid,uuid,text,date,timestamp with time zone,uuid,integer)",
      "read_india_native_fiscal_document(uuid,uuid,uuid,uuid)",
      "discover_india_native_fiscal_issue(uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[])",
      "read_india_fiscal_submission_delivery_receipt_by_document(uuid,uuid,uuid,uuid)",
      "list_india_fiscal_submission_provider_options(uuid,uuid,uuid)",
      "prepare_india_native_fiscal_invoice_v3(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid,text,text)",
      "prepare_india_native_fiscal_invoice_v4(uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid,text,text)",
    ];
    const rows = await deploy<Array<{ signature: string; owner: string; app: boolean; runtime: boolean; public: boolean; config: string[] }>>`
      SELECT p.oid::regprocedure::text signature,owner.rolname owner,
        has_function_privilege('app_role',p.oid,'EXECUTE') app,
        has_function_privilege('yellow_runtime',p.oid,'EXECUTE') runtime,
        has_function_privilege('public',p.oid,'EXECUTE') public,
        p.proconfig config
      FROM pg_proc p JOIN pg_roles owner ON owner.oid=p.proowner
      WHERE p.pronamespace='public'::regnamespace AND p.proname IN (
        'list_india_native_fiscal_documents','read_india_native_fiscal_document',
        'discover_india_native_fiscal_issue','read_india_fiscal_submission_delivery_receipt_by_document',
        'list_india_fiscal_submission_provider_options','prepare_india_native_fiscal_invoice_v3',
        'prepare_india_native_fiscal_invoice_v4') ORDER BY 1`;
    expect(rows).toHaveLength(signatures.length);
    expect(rows.map(row => row.signature).sort()).toEqual([...signatures].sort());
    expect(rows.every(row => row.owner === "yellow_owner" && row.app && !row.runtime && !row.public)).toBe(true);
    expect(rows.every(row => row.config.some(value => value === "search_path=pg_catalog, public"
        || value === "search_path=pg_catalog, public, pg_temp")
      && row.config.includes("TimeZone=UTC"))).toBe(true);
    const [permission] = await deploy<Array<{ assigned: string }>>`
      SELECT count(rp.role_id)::text assigned FROM permission permission
      LEFT JOIN role_permission rp ON rp.permission_code=permission.code
      WHERE permission.code='tax-fiscal.documents:read' GROUP BY permission.code`;
    expect(permission?.assigned).toBe("0");
  });

  test("reproduces D1314 through v2 and proves the same shifted clock with dated status", async () => {
    for (const [label, withStatus] of [["q208-gap", false], ["q208-control", true]] as const) {
      const candidate = await createOperatorInvoiceFixture(deploy, runtime, label, {
        timezone: "Pacific/Kiritimati",serviceProvisionDate: "2025-09-23",
        supplierBooksEntryDate: "2025-09-24",supplierBankCreditDate: "2025-09-24",
        calendarEvidence: null,
      });
      const originalDate = (await deploy<Array<{ value: string }>>`
        SELECT (transaction_timestamp() AT TIME ZONE timezone)::date::text value FROM org_node
         WHERE tenant_id=${candidate.fixture.tenant}::uuid AND id=${candidate.fixture.property}::uuid`)[0]!.value;
      const shiftedDate = await moveOperatorFixtureIssueClock(deploy, candidate, "Pacific/Pago_Pago");
      expect(shiftedDate).not.toBe(originalDate);
      if (withStatus) await addOperatorIssueDateSupplierStatus(deploy, candidate, shiftedDate);
      const [status] = await deploy<Array<{ count: string }>>`
        SELECT count(*)::text count FROM india_gst_supplier_registration_status_snapshot
         WHERE tenant_id=${candidate.fixture.tenant}::uuid
           AND supplier_registration_id=${candidate.statutory.seller.registrationId}::uuid
           AND status_as_of=${shiftedDate}::date`;
      expect(status?.count).toBe(withStatus ? "1" : "0");
      const issue = () => runtime.withTenantTransaction(candidate.fixture.tenant,
        tx => new IndiaNativeFiscalInvoiceIssuanceService().issueNative(tx, candidate.request));
      if (!withStatus) {
        await expectState(issue, "55000");
        const [empty] = await deploy<Array<{ documents: string; timings: string }>>`
          SELECT (SELECT count(*)::text FROM document WHERE tenant_id=${candidate.fixture.tenant}::uuid) documents,
            (SELECT count(*)::text FROM india_gst_native_invoice_timing
              WHERE tenant_id=${candidate.fixture.tenant}::uuid) timings`;
        expect(empty).toEqual({ documents: "0", timings: "0" });
      } else {
        const receipt = await issue();
        expect(receipt.status).toBe("issued");
        const replayDate = await moveOperatorFixtureIssueClock(deploy, candidate, "UTC");
        expect(replayDate).not.toBe(shiftedDate);
        const replay = await issue();
        expect(replay.documentId).toBe(receipt.documentId);
        expect(replay.replayed).toBe(true);
      }
    }
  }, 120_000);

  test("v3 rejects missing issue-date status, then issues and replays the locked confirmation", async () => {
    const candidate = await createOperatorInvoiceFixture(deploy, runtime, "q208-v3-status", {
      timezone: "Pacific/Kiritimati",serviceProvisionDate: "2025-09-23",
      supplierBooksEntryDate: "2025-09-24",supplierBankCreditDate: "2025-09-24",calendarEvidence: null,
    });
    const initial = await discoverOperatorInvoice(runtime, candidate) as Record<string, unknown>;
    expect(initial.kind).toBe("ready");
    const shiftedDate = await moveOperatorFixtureIssueClock(deploy, candidate, "Pacific/Pago_Pago");
    await expectState(() => issueConfirmedOperatorInvoice(runtime, candidate,
      String(initial.selectorHash),String(initial.evidenceHash)), "55000");
    await addOperatorIssueDateSupplierStatus(deploy, candidate, shiftedDate);
    const ready = await discoverOperatorInvoice(runtime, candidate) as Record<string, unknown>;
    expect(ready.kind).toBe("ready");
    const issued = await issueConfirmedOperatorInvoice(runtime, candidate,
      String(ready.selectorHash),String(ready.evidenceHash));
    expect(issued.status).toBe("issued");
    await moveOperatorFixtureIssueClock(deploy, candidate, "UTC");
    const replay = await issueConfirmedOperatorInvoice(runtime, candidate,
      String(ready.selectorHash),String(ready.evidenceHash));
    expect(replay.documentId).toBe(issued.documentId);
    expect(replay.replayed).toBe(true);
  }, 120_000);

  test("lists and reads immutable issued content with coherent empty-page totals", async () => {
    const candidate = await createOperatorInvoiceFixture(deploy, runtime, "q208-read");
    const receipt = await runtime.withTenantTransaction(candidate.fixture.tenant,
      tx => new IndiaNativeFiscalInvoiceIssuanceService().issueNative(tx, candidate.request));
    await runtime.withTenantTransaction(candidate.fixture.tenant, async tx => {
      const [range] = await tx<Array<{ business_date: string; issued_at: string }>>`
        SELECT business_date::text AS business_date,issued_at::text AS issued_at FROM document
        WHERE tenant_id=${candidate.fixture.tenant}::uuid AND id=${receipt.documentId}::uuid`;
      const rows = await tx<Array<{ document_id: string | null; issued_at: string | null; summary: Record<string, unknown> | null; matching_count: string }>>`
        SELECT document_id::text,to_char(issued_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') issued_at,
          summary,matching_count::text FROM list_india_native_fiscal_documents(
            ${candidate.fixture.tenant}::uuid,${candidate.fixture.property}::uuid,${candidate.fixture.actor}::uuid,
            ${range!.business_date}::date,(${range!.business_date}::date+1),NULL,NULL,NULL,NULL,NULL,NULL,2)`;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.document_id).toBe(receipt.documentId);
      expect(rows[0]?.matching_count).toBe("1");
      expect(rows[0]?.issued_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
      expect(rows[0]?.summary).toMatchObject({ documentId: receipt.documentId, currency: "INR" });
      const empty = await tx<Array<{
        document_id: string | null; business_date: string | null; issued_at: string | null;
        summary: Record<string, unknown> | null; matching_count: string;
      }>>`
        SELECT document_id::text,business_date::text,issued_at::text,summary,matching_count::text
        FROM list_india_native_fiscal_documents(
          ${candidate.fixture.tenant}::uuid,${candidate.fixture.property}::uuid,${candidate.fixture.actor}::uuid,
          ${range!.business_date}::date,(${range!.business_date}::date+1),NULL,NULL,NULL,
          ${range!.business_date}::date,${range!.issued_at}::timestamptz,${receipt.documentId}::uuid,2)`;
      expect(empty).toEqual([{
        document_id: null,business_date: null,issued_at: null,summary: null,matching_count: "1",
      }]);
      const [detail] = await tx<Array<{ document: Record<string, unknown> | null }>>`
        SELECT read_india_native_fiscal_document(${candidate.fixture.tenant}::uuid,
          ${candidate.fixture.property}::uuid,${receipt.documentId}::uuid,${candidate.fixture.actor}::uuid) document`;
      expect(detail?.document).toMatchObject({ kind: "india_native_invoice_v1", documentId: receipt.documentId,
        documentSha256: receipt.sha256, sourceEvidenceHash: receipt.sourceEvidenceHash });
    });
  }, 90_000);

  test("requires explicit buyer selection and preserves the calendar-free ordinary path", async () => {
    const candidate = await createOperatorInvoiceFixture(deploy, runtime, "q208-discovery");
    expect(await discoverOperatorInvoice(runtime, candidate, null)).toMatchObject({ kind: "selection_required" });
    const first = await discoverOperatorInvoice(runtime, candidate) as Record<string, unknown>;
    const second = await discoverOperatorInvoice(runtime, candidate) as Record<string, unknown>;
    expect(first).toMatchObject({ kind: "ready" });
    expect(second).toEqual(first);
    const confirmation = first.confirmation as {
      buyer: Record<string, unknown> & { legalName: string; gstin: string; stateCode: string };
      placeOfSupply: { pos: string };
      timing: { timeOfSupplyDate: string; serviceProvisionDate: string; paymentReceiptDate: string };
      issue: { issueDate: string };
      configuration: {
        selectedExtensionId: string;selectedExtensionVersion: number;selectedExtensionContentHash: string;
      };
      quotedTaxComposition: { taxPreview: {
        selectedContentHash: string;transactionValueMinor: string;taxMinor: string;grandTotalMinor: string;
        persistenceRoomNights: readonly Readonly<{
          ordinal: number;businessDate: string;finalValueMinor: string;taxMinor: string;
          aggregateRateBasisPoints: number;components: readonly Readonly<{
            identity: string;rateBasisPoints: number;taxMinor: string;
          }>[];
        }>[];
      } };
    };
    expect(confirmation.buyer).toEqual({
      registrationId: candidate.statutory.recipient.registrationId,
      partyId: candidate.statutory.recipient.partyId,
      scheme: "in-gstin",
      gstin: candidate.statutory.recipient.gstin,
      stateCode: candidate.statutory.recipient.stateCode,
      legalName: candidate.statutory.recipient.legalName,
      tradeName: candidate.statutory.recipient.tradeName,
      addressLine1: candidate.statutory.recipient.addressLine1,
      locality: candidate.statutory.recipient.locality,
      pin: candidate.statutory.recipient.pin,
      evidenceHash: candidate.statutory.recipient.evidenceHash,
    });
    expect(confirmation.configuration.selectedExtensionContentHash)
      .toBe(confirmation.quotedTaxComposition.taxPreview.selectedContentHash);
    const projected = await runtime.withTenantTransaction(candidate.fixture.tenant,
      tx => new IndiaNativeFiscalOperatorReadService().discover(tx, {
        tenantId: candidate.fixture.tenant,
        propertyNode: candidate.fixture.property,
        actorId: candidate.fixture.actor,
        reservationId: candidate.fixture.reservation,
        folioId: candidate.request.folioId,
        recipientRegistrationId: candidate.statutory.recipient.registrationId,
        calendarEvidence: candidate.request.calendarEvidence,
      }));
    if (!projected.ok) {
      throw new Error(`Q208 genuine operator readiness projection failed: ${projected.error.code}`);
    }
    expect(projected.ok).toBe(true);
    if (projected.value.kind !== "ready") {
      throw new Error(`Q208 genuine operator readiness projection was ${projected.value.kind}`);
    }
    expect(projected.value.selectorHash).toBe(String(first.selectorHash));
    expect(projected.value.evidenceHash).toBe(String(first.evidenceHash));
    expect(projected.value.confirmation).toMatchObject({
      buyer: {
        recipientRegistrationId: candidate.statutory.recipient.registrationId,
        legalName: confirmation.buyer.legalName,gstin: confirmation.buyer.gstin,
        stateCode: confirmation.buyer.stateCode,
      },
      placeOfSupplyStateCode: confirmation.placeOfSupply.pos,
      issueDate: confirmation.issue.issueDate,
      timeOfSupplyDate: confirmation.timing.timeOfSupplyDate,
      serviceProvisionDate: confirmation.timing.serviceProvisionDate,
      paymentReceiptDate: confirmation.timing.paymentReceiptDate,
      taxableMinor: confirmation.quotedTaxComposition.taxPreview.transactionValueMinor,
      taxMinor: confirmation.quotedTaxComposition.taxPreview.taxMinor,
      totalMinor: confirmation.quotedTaxComposition.taxPreview.grandTotalMinor,
      configuration: {
        extensionId: confirmation.configuration.selectedExtensionId,
        version: confirmation.configuration.selectedExtensionVersion,
        contentHash: confirmation.configuration.selectedExtensionContentHash,
      },
    });
    expect(projected.value.confirmation.roomNights).toEqual(
      confirmation.quotedTaxComposition.taxPreview.persistenceRoomNights.map(night => ({
        ordinal: night.ordinal,businessDate: night.businessDate,
        taxableMinor: night.finalValueMinor,taxMinor: night.taxMinor,
        aggregateRateBasisPoints: night.aggregateRateBasisPoints,components: night.components,
      })),
    );
    expect(JSON.stringify(projected)).not.toContain("internalSelectors");
    expect(JSON.stringify(projected)).not.toContain("valuationId");
    expect(JSON.stringify(projected)).not.toContain("recordingRoots");
    const issued = await issueConfirmedOperatorInvoice(runtime, candidate,
      String(first.selectorHash),String(first.evidenceHash));
    expect(issued.status).toBe("issued");
    expect(issued.replayed).toBe(false);
  }, 90_000);

  test("serializes the public v4 command and replays its durable private selectors", async () => {
    const candidate = await createOperatorInvoiceFixture(deploy, runtime, "q208-v4-command");
    const ready = await discoverOperatorInvoice(runtime, candidate) as Record<string, unknown>;
    expect(ready.kind).toBe("ready");
    const selectorHash = String(ready.selectorHash);
    const confirmationHash = String(ready.evidenceHash);
    const alternateRecipient = await addOperatorInvoiceRecipient(deploy, candidate);
    const alternateReady = await discoverOperatorInvoice(runtime, candidate,
      alternateRecipient.registrationId) as Record<string, unknown>;
    expect(alternateReady.kind).toBe("ready");
    expect((alternateReady.confirmation as { buyer: { registrationId: string } }).buyer.registrationId)
      .toBe(alternateRecipient.registrationId);
    const receipts = await Promise.all([
      issueOperatorInvoice(runtime, candidate, selectorHash, confirmationHash),
      issueOperatorInvoice(runtime, candidate, selectorHash, confirmationHash),
    ]);
    expect(receipts[0]?.documentId).toBe(receipts[1]?.documentId);
    expect(receipts.map(receipt => receipt.replayed).sort()).toEqual([false, true]);

    const expired = await deploy<Array<{ key_hash: string }>>`DELETE FROM api_idempotency
      WHERE tenant_id=${candidate.fixture.tenant}::uuid AND operation='document.issued'
        AND key_hash=encode(digest(${candidate.request.idempotencyKey},'sha256'),'hex')
      RETURNING key_hash::text`;
    expect(expired).toHaveLength(1);

    const confirmation = ready.confirmation as { issue: { seriesId: string } };
    await deploy`UPDATE document_series SET prefix='POST-COMMIT/'
      WHERE tenant_id=${candidate.fixture.tenant}::uuid
        AND id=${confirmation.issue.seriesId}::uuid`;
    const replay = await issueOperatorInvoice(runtime, candidate, selectorHash, confirmationHash);
    expect(replay.documentId).toBe(receipts[0]?.documentId);
    expect(replay.replayed).toBe(true);

    const alternateAccount = crypto.randomUUID();
    const alternateFolio = crypto.randomUUID();
    await deploy.begin(async tx => {
      await tx`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
        SELECT tenant_id,${candidate.fixture.unauthorizedActor}::uuid,role_id,scope_node
          FROM user_role WHERE tenant_id=${candidate.fixture.tenant}::uuid
           AND user_id=${candidate.fixture.actor}::uuid`;
      await tx`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status)
        VALUES(${alternateAccount}::uuid,${candidate.fixture.tenant}::uuid,
          ${candidate.fixture.property}::uuid,'guest',${candidate.fixture.party}::uuid,
          'Q208 alternate command account','INR','open')`;
      await tx`INSERT INTO folio(id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status)
        VALUES(${alternateFolio}::uuid,${candidate.fixture.tenant}::uuid,
          ${alternateAccount}::uuid,${candidate.fixture.reservation}::uuid,
          ${`Q208-${alternateFolio.slice(0, 12)}`},2,'Q208 alternate command folio','open')`;
    });
    const beforeRejected = await operatorInvoiceArtifactSnapshot(deploy, candidate.fixture.tenant);
    await expectState(() => issueOperatorInvoice(runtime, candidate, selectorHash,
      confirmationHash, {
        actorId: candidate.fixture.unauthorizedActor,
        envelope: Object.freeze({ ...candidate.request.envelope,
          actorId: candidate.fixture.unauthorizedActor }),
      }), "23505");
    await expectState(() => issueOperatorInvoice(runtime, candidate, selectorHash,
      confirmationHash, { folioId: alternateFolio }), "23505");
    await expectState(() => issueOperatorInvoice(runtime, candidate, selectorHash,
      confirmationHash, { recipientRegistrationId: alternateRecipient.registrationId }), "23505");
    await expect(issueOperatorInvoice(runtime, candidate, selectorHash, confirmationHash, {
        calendarEvidence: Object.freeze({
          authorityId: "ORDER440_CHANGED_CALENDAR",
          sourceDigestSha256: "a".repeat(64),
          throughDate: "2025-01-04",
          days: Object.freeze([
            Object.freeze({ date: "2025-01-01", state: "working" as const }),
            Object.freeze({ date: "2025-01-02", state: "working" as const }),
            Object.freeze({ date: "2025-01-03", state: "non_working" as const }),
            Object.freeze({ date: "2025-01-04", state: "working" as const }),
          ]),
        }),
      })).rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceStaleEvidenceError);
    await expectState(() => issueOperatorInvoice(runtime, candidate, selectorHash,
      confirmationHash, {
        idempotencyKey: `${candidate.request.idempotencyKey}-changed`,
        envelope: Object.freeze({ ...candidate.request.envelope,requestId: crypto.randomUUID() }),
      }), "23505");
    const afterRejected = await operatorInvoiceArtifactSnapshot(deploy, candidate.fixture.tenant);
    expect(afterRejected).toEqual(beforeRejected);
  }, 120_000);

  test("returns every recipient at 500 and blocks the 501 sentinel without truncation", async () => {
    const candidate = await createOperatorInvoiceFixture(deploy, runtime, "q208-recipient-bound");
    await deploy`INSERT INTO party_fiscal_registration(
        tenant_id,id,party_id,scheme,registration_number,region_code,legal_name,trade_name,
        address_line1,locality,pin)
      SELECT ${candidate.fixture.tenant}::uuid,gen_random_uuid(),${candidate.fixture.party}::uuid,
        'in-gstin',${candidate.statutory.recipient.stateCode}||'ABCDE'||lpad(option_no::text,4,'0')||'F1Z5',
        ${candidate.statutory.recipient.stateCode},'Synthetic bounded buyer '||lpad(option_no::text,4,'0'),
        NULL,'2 Synthetic Road','Bengaluru','560002'
      FROM generate_series(0,498) option_no`;
    const boundary = await discoverOperatorInvoice(runtime, candidate, null) as {
      kind: string; recipients?: readonly unknown[];
    };
    expect(boundary.kind).toBe("selection_required");
    expect(boundary.recipients).toHaveLength(500);
    await deploy`INSERT INTO party_fiscal_registration(
        tenant_id,id,party_id,scheme,registration_number,region_code,legal_name,trade_name,
        address_line1,locality,pin)
      VALUES(${candidate.fixture.tenant}::uuid,gen_random_uuid(),${candidate.fixture.party}::uuid,
        'in-gstin',${candidate.statutory.recipient.stateCode}||'ABCDE0499F1Z5',
        ${candidate.statutory.recipient.stateCode},'Synthetic bounded buyer 0499',NULL,
        '2 Synthetic Road','Bengaluru','560002')`;
    expect(await discoverOperatorInvoice(runtime, candidate, null)).toEqual({
      kind: "blocked",blocker: "recipient_selection_too_broad",
    });
  }, 90_000);

  test("rejects nullable bounds, foreign roles, revoked grants and unsupported property fiscal mode", async () => {
    const local = await createOperatorInvoiceFixture(deploy, runtime, "q208-authority-local");
    const foreign = await createOperatorInvoiceFixture(deploy, runtime, "q208-authority-foreign");
    const issued = await runtime.withTenantTransaction(local.fixture.tenant,
      tx => new IndiaNativeFiscalInvoiceIssuanceService().issueNative(tx, local.request));
    const [document] = await deploy<Array<{ business_date: string }>>`
      SELECT business_date::text AS business_date FROM document
       WHERE tenant_id=${local.fixture.tenant}::uuid AND id=${issued.documentId}::uuid`;
    const [foreignRole] = await deploy<Array<{ role_id: string }>>`
      SELECT ur.role_id::text AS role_id FROM user_role ur
       WHERE ur.tenant_id=${foreign.fixture.tenant}::uuid AND ur.user_id=${foreign.fixture.actor}::uuid
       ORDER BY ur.role_id LIMIT 1`;
    expect(document).toBeDefined();
    expect(foreignRole).toBeDefined();
    await deploy`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
      VALUES(${local.fixture.tenant}::uuid,${local.fixture.unauthorizedActor}::uuid,
        ${foreignRole!.role_id}::uuid,${local.fixture.property}::uuid)`;

    await expectState(() => runtime.withTenantTransaction(local.fixture.tenant,
      tx => tx`SELECT document_id FROM list_india_native_fiscal_documents(
        ${local.fixture.tenant}::uuid,${local.fixture.property}::uuid,${local.fixture.actor}::uuid,
        ${document!.business_date}::date,(${document!.business_date}::date+1),
        NULL,NULL,NULL,NULL,NULL,NULL,NULL::integer)`), "22023");
    await expectState(() => runtime.withTenantTransaction(local.fixture.tenant,
      tx => tx`SELECT document_id FROM list_india_native_fiscal_documents(
        ${local.fixture.tenant}::uuid,${local.fixture.property}::uuid,${local.fixture.unauthorizedActor}::uuid,
        ${document!.business_date}::date,(${document!.business_date}::date+1),
        NULL,NULL,NULL,NULL,NULL,NULL,2)`), "42501");
    await runtime.withTenantTransaction(local.fixture.tenant, async tx => {
      const [detail] = await tx<Array<{ value: unknown }>>`SELECT read_india_native_fiscal_document(
        ${local.fixture.tenant}::uuid,${local.fixture.property}::uuid,
        ${issued.documentId}::uuid,${local.fixture.unauthorizedActor}::uuid) AS value`;
      const [receipt] = await tx<Array<{ value: unknown }>>`
        SELECT read_india_fiscal_submission_delivery_receipt_by_document(
          ${local.fixture.tenant}::uuid,${local.fixture.property}::uuid,
          ${issued.documentId}::uuid,${local.fixture.unauthorizedActor}::uuid) AS value`;
      expect(detail?.value).toBeNull();
      expect(receipt?.value).toBeNull();
    });
    await expectState(() => runtime.withTenantTransaction(local.fixture.tenant,
      tx => tx`SELECT * FROM list_india_fiscal_submission_provider_options(
        ${local.fixture.tenant}::uuid,${local.fixture.property}::uuid,
        ${local.fixture.unauthorizedActor}::uuid)`), "42501");

    const unsupported = {
      tenant: crypto.randomUUID(), property: crypto.randomUUID(), actor: crypto.randomUUID(),
      role: crypto.randomUUID(), marker: crypto.randomUUID().replaceAll("-", "").slice(0, 16),
    };
    await deploy.begin(async tx => {
      await tx`INSERT INTO tenant(id,slug,name,tier,status) VALUES(
        ${unsupported.tenant}::uuid,${`q208-${unsupported.marker}`} ,'Q208 unsupported property','shared','active')`;
      await tx`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES(
        ${unsupported.property}::uuid,${unsupported.tenant}::uuid,
        ${`q208${unsupported.marker}.property`}::ltree,'property','Q208 unsupported property','UTC','AED')`;
      await tx`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(
        ${unsupported.actor}::uuid,${unsupported.tenant}::uuid,
        ${`q208-${unsupported.marker}@example.invalid`},'Q208 unsupported actor','active')`;
      await tx`INSERT INTO role(id,tenant_id,name) VALUES(
        ${unsupported.role}::uuid,${unsupported.tenant}::uuid,'Q208 unsupported reader')`;
      await tx`INSERT INTO role_permission(role_id,permission_code)
        VALUES(${unsupported.role}::uuid,'tax-fiscal.documents:read')`;
      await tx`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(
        ${unsupported.tenant}::uuid,${unsupported.actor}::uuid,
        ${unsupported.role}::uuid,${unsupported.property}::uuid)`;
    });
    await expectState(() => runtime.withTenantTransaction(unsupported.tenant,
      tx => tx`SELECT document_id FROM list_india_native_fiscal_documents(
        ${unsupported.tenant}::uuid,${unsupported.property}::uuid,${unsupported.actor}::uuid,
        '2026-01-01'::date,'2026-01-02'::date,NULL,NULL,NULL,NULL,NULL,NULL,2)`), "P2082");

    const [localRole] = await deploy<Array<{ role_id: string }>>`
      SELECT ur.role_id::text AS role_id FROM user_role ur
       WHERE ur.tenant_id=${local.fixture.tenant}::uuid AND ur.user_id=${local.fixture.actor}::uuid
       ORDER BY ur.role_id LIMIT 1`;
    const permissions = ["tax-fiscal.documents:read", "tax-fiscal.submissions:read",
      "tax-fiscal.submissions:request"] as const;
    await deploy`DELETE FROM role_permission WHERE role_id=${localRole!.role_id}::uuid
      AND permission_code IN ${deploy(permissions)}`;
    try {
      await expectState(() => runtime.withTenantTransaction(local.fixture.tenant,
        tx => tx`SELECT document_id FROM list_india_native_fiscal_documents(
          ${local.fixture.tenant}::uuid,${local.fixture.property}::uuid,${local.fixture.actor}::uuid,
          ${document!.business_date}::date,(${document!.business_date}::date+1),
          NULL,NULL,NULL,NULL,NULL,NULL,2)`), "42501");
      await runtime.withTenantTransaction(local.fixture.tenant, async tx => {
        expect((await tx<Array<{ value: unknown }>>`SELECT read_india_native_fiscal_document(
          ${local.fixture.tenant}::uuid,${local.fixture.property}::uuid,
          ${issued.documentId}::uuid,${local.fixture.actor}::uuid) AS value`)[0]?.value).toBeNull();
        expect((await tx<Array<{ value: unknown }>>`
          SELECT read_india_fiscal_submission_delivery_receipt_by_document(
            ${local.fixture.tenant}::uuid,${local.fixture.property}::uuid,
            ${issued.documentId}::uuid,${local.fixture.actor}::uuid) AS value`)[0]?.value).toBeNull();
      });
      await expectState(() => runtime.withTenantTransaction(local.fixture.tenant,
        tx => tx`SELECT * FROM list_india_fiscal_submission_provider_options(
          ${local.fixture.tenant}::uuid,${local.fixture.property}::uuid,
          ${local.fixture.actor}::uuid)`), "42501");
    } finally {
      await deploy`INSERT INTO role_permission(role_id,permission_code)
        SELECT ${localRole!.role_id}::uuid,permission FROM unnest(${`{${permissions.join(",")}}`}::text[]) permission
        ON CONFLICT DO NOTHING`;
    }
    await deploy`DELETE FROM tax_assignment
      WHERE tenant_id=${local.fixture.tenant}::uuid
        AND property_node=${local.fixture.property}::uuid
        AND jurisdiction_key='in-gst-lodging'`;
    await expectState(() => discoverOperatorInvoice(runtime, local), "P2082");
    await expectState(() => runtime.withTenantTransaction(local.fixture.tenant,
      tx => tx`SELECT * FROM list_india_fiscal_submission_provider_options(
        ${local.fixture.tenant}::uuid,${local.fixture.property}::uuid,
        ${local.fixture.actor}::uuid)`), "P2082");
  }, 120_000);

  test("v3 rejects changed stable configuration after discovery before every durable write", async () => {
    const candidate = await createOperatorInvoiceFixture(deploy, runtime, "q208-stale");
    const ready = await discoverOperatorInvoice(runtime, candidate) as Record<string, unknown>;
    expect(ready.kind).toBe("ready");
    const confirmation = ready.confirmation as { issue: { seriesId: string } };
    const before = await deploy<Array<{ documents: string; timings: string; events: string }>>`
      SELECT (SELECT count(*)::text FROM document WHERE tenant_id=${candidate.fixture.tenant}::uuid) documents,
        (SELECT count(*)::text FROM india_gst_native_invoice_timing WHERE tenant_id=${candidate.fixture.tenant}::uuid) timings,
        (SELECT count(*)::text FROM outbox WHERE tenant_id=${candidate.fixture.tenant}::uuid) events`;
    await deploy`UPDATE document_series SET prefix='STALE/'
      WHERE tenant_id=${candidate.fixture.tenant}::uuid AND id=${confirmation.issue.seriesId}::uuid`;
    await expect(runtime.withTenantTransaction(candidate.fixture.tenant,
      tx => new IndiaNativeFiscalInvoiceIssuanceService().issueNativeConfirmed(tx, {
        ...candidate.request,expectedSelectorHash: String(ready.selectorHash),
        expectedConfirmationHash: String(ready.evidenceHash),
      }))).rejects.toBeInstanceOf(IndiaNativeFiscalInvoiceStaleEvidenceError);
    const after = await deploy<Array<{ documents: string; timings: string; events: string }>>`
      SELECT (SELECT count(*)::text FROM document WHERE tenant_id=${candidate.fixture.tenant}::uuid) documents,
        (SELECT count(*)::text FROM india_gst_native_invoice_timing WHERE tenant_id=${candidate.fixture.tenant}::uuid) timings,
        (SELECT count(*)::text FROM outbox WHERE tenant_id=${candidate.fixture.tenant}::uuid) events`;
    expect(after).toEqual(before);
  }, 90_000);

  test("v3 rejects a changed authenticated buyer after discovery before every durable write", async () => {
    const candidate = await createOperatorInvoiceFixture(deploy, runtime, "q208-stale-buyer");
    const ready = await discoverOperatorInvoice(runtime, candidate) as Record<string, unknown>;
    expect(ready.kind).toBe("ready");
    const before = await deploy<Array<{ documents: string; timings: string; events: string }>>`
      SELECT (SELECT count(*)::text FROM document WHERE tenant_id=${candidate.fixture.tenant}::uuid) documents,
        (SELECT count(*)::text FROM india_gst_native_invoice_timing WHERE tenant_id=${candidate.fixture.tenant}::uuid) timings,
        (SELECT count(*)::text FROM outbox WHERE tenant_id=${candidate.fixture.tenant}::uuid) events`;
    await deploy`UPDATE party_fiscal_registration SET legal_name=legal_name||' altered'
      WHERE tenant_id=${candidate.fixture.tenant}::uuid
        AND id=${candidate.statutory.recipient.registrationId}::uuid`;
    await expect(runtime.withTenantTransaction(candidate.fixture.tenant,
      tx => new IndiaNativeFiscalInvoiceIssuanceService().issueNativeConfirmed(tx, {
        ...candidate.request,expectedSelectorHash: String(ready.selectorHash),
        expectedConfirmationHash: String(ready.evidenceHash),
      }))).rejects.toThrow();
    const after = await deploy<Array<{ documents: string; timings: string; events: string }>>`
      SELECT (SELECT count(*)::text FROM document WHERE tenant_id=${candidate.fixture.tenant}::uuid) documents,
        (SELECT count(*)::text FROM india_gst_native_invoice_timing WHERE tenant_id=${candidate.fixture.tenant}::uuid) timings,
        (SELECT count(*)::text FROM outbox WHERE tenant_id=${candidate.fixture.tenant}::uuid) events`;
    expect(after).toEqual(before);
  }, 90_000);
});
