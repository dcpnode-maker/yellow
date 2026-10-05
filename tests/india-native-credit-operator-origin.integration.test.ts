import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { IssueIndiaNativeFiscalCreditNoteCommand } from "../src/commands/issue-india-native-fiscal-credit-note";
import { IndiaNativeFiscalSeriesConfigurationService } from "../src/contexts/tax-fiscal";
import { projectIssuedIndiaIrpWireCandidate } from "../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";
import { createAuditEnvelope, Database } from "../src/kernel";
import {
  assertCreditSubmissionTargets,
  creditSubmissionFinancialFingerprint,
  ownerCreditProjection,
  parseCreditSubmissionTargetMode,
  requestCreditSubmission,
} from "./fixtures/india-native-credit-submission-fixture";
import {
  createOperatorInvoiceFixture,
  discoverOperatorInvoice,
  issueConfirmedOperatorInvoice,
} from "./fixtures/order440-operator-invoices";
import type { FiscalSubmissionHttpScenario } from "./fixtures/order440-fiscal-submission-http";

const deployUrl = process.env.YELLOW_ORDER447_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER447_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER447_OPERATOR_ORIGIN === "1";

if (required && (!deployUrl || !runtimeUrl)) {
  throw new Error("Required Order447 operator-origin proof needs exact admitted credentials");
}
const targetMode = required || deployUrl || runtimeUrl
  ? parseCreditSubmissionTargetMode(process.env.YELLOW_ORDER447_TARGET_MODE) : undefined;
if (required || deployUrl || runtimeUrl) {
  if (!deployUrl || !runtimeUrl) throw new Error("Order447 operator-origin proof requires paired deploy/runtime credentials");
  assertCreditSubmissionTargets(deployUrl, runtimeUrl, "runtime", targetMode!,
    process.env.YELLOW_REQUIRE_ORDER447_CI_CANONICAL === "1", process.env.YELLOW_ORDER447_CI_DATABASE_ADDRESS);
}

const databaseProof = required ? describe.serial : describe.skip;

describe("Q222 operator-origin proof containment", () => {
  test("requires the exact retained Order447 runtime target without connecting", () => {
    const deploy = "postgres://yellow_deploy:synthetic@127.0.0.1:55503/yellow_order446_credit_upgrade_20260907";
    const runtime = deploy.replace("yellow_deploy", "yellow_runtime");
    expect(() => assertCreditSubmissionTargets(deploy, runtime, "runtime", "native-draft")).not.toThrow();
    expect(() => assertCreditSubmissionTargets(deploy, runtime, "rollback", "native-draft")).toThrow();
    expect(() => assertCreditSubmissionTargets(deploy, `${runtime}?options=-crole%3Dapp_role`, "runtime", "native-draft")).toThrow();
    expect(() => assertCreditSubmissionTargets(
      deploy.replace("credit_upgrade", "referee87"), runtime, "runtime",
      "native-draft",
    )).toThrow();
  });
});

interface OriginRow {
  readonly body: string;
  readonly documentId: string;
  readonly documentKind: string;
  readonly sourceKind: string;
  readonly sourceVersion: number;
  readonly nativeTimingId: string | null;
  readonly nativeAccountingBindingId: string | null;
  readonly nativeSourceBasisHash: string | null;
}

interface DocumentRow {
  readonly documentId: string;
  readonly content: string;
  readonly sha256: string;
}

databaseProof("Q222 genuine operator-v3 invoice to credit submission", () => {
  let deploy: SQL;
  let runtime: Database;

  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 3, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 4, prepare: false });
    const [state] = await deploy<Array<{
      frontier: number;
      creditProjectionInstalled: boolean;
      permissions: number;
      providerType: boolean;
    }>>`SELECT
      max(version)::int AS frontier,
      position('Order447 authenticated full-credit branch' in pg_get_functiondef(
        'public.india_fiscal_submission_project_wire(uuid,uuid,uuid)'::regprocedure
      )) > 0 AS "creditProjectionInstalled",
      (SELECT count(*)::int FROM public.permission
        WHERE code IN ('financials.adjustments:write','tax-fiscal.submissions:request')) AS permissions,
      EXISTS(SELECT 1 FROM public.extension_type WHERE type='fiscal_provider') AS "providerType"
      FROM public.schema_migration`;
    expect(state).toEqual({
      frontier: targetMode === "native-draft" ? 87 : 88,
      creditProjectionInstalled: true,
      permissions: 2,
      providerType: true,
    });
  });

  afterAll(async () => {
    await runtime?.close();
    await deploy?.close();
  });

  test("operator-v3 origin remains native-v2 through full credit projection and governed request", async () => {
    const candidate = await createOperatorInvoiceFixture(
      deploy,
      runtime,
      `q222-operator-origin-${crypto.randomUUID().slice(0, 8)}`,
      { statutoryOriginalConfiguration: "karnataka_supplier_karnataka_property" },
    );
    const readiness = await discoverOperatorInvoice(runtime, candidate) as Record<string, unknown>;
    expect(readiness.kind).toBe("ready");
    const invoice = await issueConfirmedOperatorInvoice(
      runtime,
      candidate,
      String(readiness.selectorHash),
      String(readiness.evidenceHash),
    );
    expect(invoice).toMatchObject({ status: "issued", replayed: false });

    const [role] = await deploy<Array<{ roleId: string }>>`SELECT role_id::text AS "roleId"
      FROM public.user_role
      WHERE tenant_id=${candidate.fixture.tenant}::uuid
        AND user_id=${candidate.fixture.actor}::uuid
      ORDER BY role_id LIMIT 1`;
    if (!role) throw new Error("Q222 synthetic actor role is unavailable");
    await deploy`INSERT INTO public.role_permission(role_id,permission_code)
      VALUES
        (${role.roleId}::uuid,'financials.adjustments:write'),
        (${role.roleId}::uuid,'tax-fiscal.submissions:request')
      ON CONFLICT DO NOTHING`;

    const financialYearSuffix = `${invoice.financialYearStart.slice(2, 4)}` +
      `${String(Number(invoice.financialYearStart.slice(0, 4)) + 1).slice(2)}`;
    const creditSeries = await runtime.withTenantTransaction(candidate.fixture.tenant, tx =>
      new IndiaNativeFiscalSeriesConfigurationService().configure(tx, {
        tenantId: candidate.fixture.tenant,
        propertyNode: candidate.fixture.property,
        supplierRegistrationId: candidate.statutory.seller.registrationId,
        documentKind: "credit_note",
        prefix: `C/${financialYearSuffix}/`,
        envelope: createAuditEnvelope({
          tenantId: candidate.fixture.tenant,
          propertyNode: candidate.fixture.property,
          actorId: candidate.fixture.actor,
          requestId: crypto.randomUUID(),
          operation: "document.series.configured",
        }),
      }));
    expect(creditSeries).toMatchObject({ documentKind: "credit_note", prefix: `C/${financialYearSuffix}/` });

    const issuedCredit = await new IssueIndiaNativeFiscalCreditNoteCommand(runtime).execute({
      tenantId: candidate.fixture.tenant,
      propertyNode: candidate.fixture.property,
      actorId: candidate.fixture.actor,
      originalDocumentId: invoice.documentId,
      reason: "Full credit of genuine operator-v3 invoice",
      idempotencyKey: `q222-credit-${invoice.documentId}`,
      envelope: createAuditEnvelope({
        tenantId: candidate.fixture.tenant,
        propertyNode: candidate.fixture.property,
        actorId: candidate.fixture.actor,
        requestId: crypto.randomUUID(),
        operation: "document.issued",
      }),
    });
    expect(issuedCredit.replayed).toBe(false);
    const credit = JSON.parse(issuedCredit.receiptJson) as Record<string, string>;
    expect(credit).toMatchObject({
      documentKind: "credit_note",
      originalDocumentId: invoice.documentId,
      seriesId: creditSeries.seriesId,
    });

    const [origin] = await deploy<OriginRow[]>`SELECT
      to_jsonb(origin)::text AS body,
      origin.document_id::text AS "documentId",
      origin.document_kind AS "documentKind",
      origin.source_kind AS "sourceKind",
      origin.source_version::int AS "sourceVersion",
      origin.native_timing_id::text AS "nativeTimingId",
      origin.native_accounting_binding_id::text AS "nativeAccountingBindingId",
      origin.native_source_basis_hash AS "nativeSourceBasisHash"
      FROM public.india_gst_native_fiscal_document_origin origin
      WHERE origin.tenant_id=${candidate.fixture.tenant}::uuid
        AND origin.document_id=${invoice.documentId}::uuid`;
    expect(origin).toMatchObject({
      documentId: invoice.documentId,
      documentKind: "invoice",
      sourceKind: "native_current_transaction_graph",
      sourceVersion: 2,
    });
    expect(origin?.nativeTimingId).toMatch(/^[0-9a-f-]{36}$/);
    expect(origin?.nativeAccountingBindingId).toMatch(/^[0-9a-f-]{36}$/);
    expect(origin?.nativeSourceBasisHash).toMatch(/^[0-9a-f]{64}$/);

    const provider = Object.freeze({
      providerKey: "india-irp",
      providerExtensionId: crypto.randomUUID(),
      providerExtensionVersion: 1,
    });
    await deploy`INSERT INTO public.extension(id,tenant_id,type,key,version,effective,content,status)
      VALUES(${provider.providerExtensionId}::uuid,${candidate.fixture.tenant}::uuid,'fiscal_provider',
        ${`q222-irp-${provider.providerExtensionId}`},1,tstzrange(NULL,NULL,'[)'),
        '{"jurisdiction":"IN","mode":"in_house_reporting","provider_key":"india-irp","document_formats":["irp_json_1_1"]}'::jsonb,
        'active')`;
    const scenario: FiscalSubmissionHttpScenario = Object.freeze({
      tenantId: candidate.fixture.tenant,
      propertyNode: candidate.fixture.property,
      actorId: candidate.fixture.actor,
      unauthorizedActorId: candidate.fixture.unauthorizedActor,
      roleId: role.roleId,
      documentId: credit.documentId!,
      provider,
    });

    const beforeReporting = await creditSubmissionFinancialFingerprint(deploy, scenario.tenantId);
    const documents = await deploy<DocumentRow[]>`SELECT id::text AS "documentId",content::text,sha256
      FROM public.document
      WHERE tenant_id=${scenario.tenantId}::uuid
        AND id IN (${invoice.documentId}::uuid,${scenario.documentId}::uuid)
      ORDER BY id`;
    expect(documents).toHaveLength(2);
    for (const document of documents) {
      const typed = projectIssuedIndiaIrpWireCandidate({
        documentId: document.documentId,
        documentSha256: document.sha256,
        contentJson: document.content,
      });
      expect(typed.ok).toBe(true);
      if (!typed.ok) throw new Error(typed.error.code);
      const sql = await ownerCreditProjection(
        deploy,
        scenario.tenantId,
        scenario.propertyNode,
        document.documentId,
      );
      expect(sql).toMatchObject({
        documentSha256: document.sha256,
        wireSha256: typed.value.wireSha256,
        wireText: typed.value.wireJson,
      });
      const wire = JSON.parse(sql.wireText) as Record<string, unknown>;
      const details = wire.DocDtls as Record<string, unknown>;
      if (document.documentId === invoice.documentId) {
        expect(details.Typ).toBe("INV");
        expect(wire).not.toHaveProperty("RefDtls");
      } else {
        expect(details.Typ).toBe("CRN");
        const content = JSON.parse(document.content) as {
          RefDtls?: { PrecDocDtls?: Array<{ InvDt?: unknown }> };
        };
        const originalDate = content.RefDtls?.PrecDocDtls?.[0]?.InvDt;
        expect(typeof originalDate).toBe("string");
        expect(wire.RefDtls).toEqual({ PrecDocDtls: [{
          InvNo: invoice.docNo,
          InvDt: originalDate,
        }] });
        expect(wire).not.toHaveProperty("YellowCredit");
      }
    }

    const requestKey = `q222-request-${crypto.randomUUID()}`;
    const first = await runtime.withTenantTransaction(scenario.tenantId,
      tx => requestCreditSubmission(tx, scenario, requestKey));
    const replay = await runtime.withTenantTransaction(scenario.tenantId,
      tx => requestCreditSubmission(tx, scenario, requestKey));
    expect(first).toMatchObject({ documentId: scenario.documentId, replayed: false });
    expect(replay).toMatchObject({ submissionId: first.submissionId, documentId: scenario.documentId, replayed: true });

    expect(await creditSubmissionFinancialFingerprint(deploy, scenario.tenantId)).toBe(beforeReporting);
    const [originAfter] = await deploy<Array<{ body: string }>>`SELECT to_jsonb(origin)::text AS body
      FROM public.india_gst_native_fiscal_document_origin origin
      WHERE origin.tenant_id=${scenario.tenantId}::uuid
        AND origin.document_id=${invoice.documentId}::uuid`;
    expect(originAfter?.body).toBe(origin?.body);
  }, 180_000);
});
