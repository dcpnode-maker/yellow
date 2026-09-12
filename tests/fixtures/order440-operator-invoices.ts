import { SQL } from "bun";

import {
  IndiaNativeFiscalInvoiceIssuanceService,
  type IndiaNativeFiscalInvoiceIssueNativeConfirmedInput,
  type IndiaNativeFiscalInvoiceOperatorIssueInput,
} from "../../src/contexts/tax-fiscal/india-native-fiscal-invoice";
import { Database } from "../../src/kernel";
import {
  createNativeIssuanceFixture,
  type NativeIssuanceFixtureOptions,
} from "./india-native-fiscal-source-completion-fixture";

export const OPERATOR_INVOICE_FIXTURE_TIMEZONES = Object.freeze({
  initial: "Pacific/Kiritimati",
  shifted: "Pacific/Pago_Pago",
  // These property zones are25hours apart; replay crosses a date at any UTC hour.
  replay: "Pacific/Kiritimati",
});

function statutoryHash(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function statutoryGstin(state: string, body: string): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const prefix = state + body;
  let factor = 2;
  let sum = 0;
  for (let index = prefix.length - 1; index >= 0; index--) {
    const addend = factor * alphabet.indexOf(prefix[index]!);
    sum += Math.floor(addend / 36) + addend % 36;
    factor = factor === 2 ? 1 : 2;
  }
  return prefix + alphabet[(36 - sum % 36) % 36];
}

export async function createOperatorInvoiceFixture(
  deploy: SQL,
  runtime: Database,
  label: string,
  options: NativeIssuanceFixtureOptions = {},
) {
  const candidate = await createNativeIssuanceFixture(deploy, runtime, { ...options, label });
  await deploy`INSERT INTO public.role_permission(role_id,permission_code)
    SELECT ur.role_id,permission.code FROM public.user_role ur CROSS JOIN public.permission permission
     WHERE ur.tenant_id=${candidate.fixture.tenant}::uuid
       AND ur.user_id=${candidate.fixture.actor}::uuid
       AND permission.code IN ('tax-fiscal.documents:read','tax-fiscal.submissions:read','tax-fiscal.submissions:request')
    ON CONFLICT DO NOTHING`;
  return candidate;
}

export async function discoverOperatorInvoice(
  runtime: Database,
  candidate: Awaited<ReturnType<typeof createOperatorInvoiceFixture>>,
  recipientId: string | null = candidate.statutory.recipient.registrationId,
) {
  const calendar = candidate.request.calendarEvidence;
  const calendarDates = `{${calendar?.days.map(day => day.date).join(",") ?? ""}}`;
  const calendarStates = `{${calendar?.days.map(day => day.state).join(",") ?? ""}}`;
  return runtime.withTenantTransaction(candidate.fixture.tenant, async tx => {
    const [row] = await tx<Array<{ readiness: unknown }>>`
      SELECT public.discover_india_native_fiscal_issue(
        ${candidate.fixture.tenant}::uuid,${candidate.fixture.property}::uuid,
        ${candidate.fixture.actor}::uuid,${candidate.fixture.reservation}::uuid,
        ${candidate.request.folioId}::uuid,${recipientId}::uuid,
        ${calendar?.authorityId ?? null},${calendar?.sourceDigestSha256 ?? null},
        ${calendar?.throughDate ?? null}::date,
        ${calendarDates}::date[],${calendarStates}::text[]) AS readiness`;
    if (!row) throw new Error("Q208 discovery returned no row");
    return row.readiness;
  });
}

export async function issueConfirmedOperatorInvoice(
  runtime: Database,
  candidate: Awaited<ReturnType<typeof createOperatorInvoiceFixture>>,
  selectorHash: string,
  confirmationHash: string,
) {
  const input: IndiaNativeFiscalInvoiceIssueNativeConfirmedInput = Object.freeze({
    ...candidate.request,
    expectedSelectorHash: selectorHash,
    expectedConfirmationHash: confirmationHash,
  });
  return runtime.withTenantTransaction(candidate.fixture.tenant,
    tx => new IndiaNativeFiscalInvoiceIssuanceService().issueNativeConfirmed(tx, input));
}

export async function issueOperatorInvoice(
  runtime: Database,
  candidate: Awaited<ReturnType<typeof createOperatorInvoiceFixture>>,
  selectorHash: string,
  confirmationHash: string,
  overrides: Partial<IndiaNativeFiscalInvoiceOperatorIssueInput> = {},
) {
  const input: IndiaNativeFiscalInvoiceOperatorIssueInput = Object.freeze({
    tenantId: candidate.fixture.tenant,
    propertyNode: candidate.fixture.property,
    actorId: candidate.fixture.actor,
    reservationId: candidate.fixture.reservation,
    folioId: candidate.request.folioId,
    recipientRegistrationId: candidate.statutory.recipient.registrationId,
    calendarEvidence: candidate.request.calendarEvidence,
    idempotencyKey: candidate.request.idempotencyKey,
    envelope: candidate.request.envelope,
    expectedSelectorHash: selectorHash,
    expectedConfirmationHash: confirmationHash,
    ...overrides,
  });
  return runtime.withTenantTransaction(candidate.fixture.tenant,
    tx => new IndiaNativeFiscalInvoiceIssuanceService().issueNativeForOperator(tx, input));
}

/** A second independently valid legal-buyer graph for the same valued party. */
export async function addOperatorInvoiceRecipient(
  deploy: SQL,
  candidate: Awaited<ReturnType<typeof createOperatorInvoiceFixture>>,
) {
  const registrationId = crypto.randomUUID();
  const recipient = {
    registrationId,
    partyId: candidate.fixture.party,
    scheme: "in-gstin" as const,
    gstin: statutoryGstin(candidate.statutory.recipient.stateCode, "QWERT9876P1Z"),
    stateCode: candidate.statutory.recipient.stateCode,
    legalName: "Synthetic Alternate Native Buyer",
    tradeName: "Alternate Buyer Trade",
    addressLine1: "4 Synthetic Road",
    locality: "Bengaluru",
    pin: "560004",
  };
  const evidenceHash = statutoryHash({
    registrationId,
    tenantId: candidate.fixture.tenant,
    partyId: recipient.partyId,
    scheme: recipient.scheme,
    gstin: recipient.gstin,
    stateCode: recipient.stateCode,
    legalName: recipient.legalName,
    tradeName: recipient.tradeName,
    addressLine1: recipient.addressLine1,
    locality: recipient.locality,
    pin: recipient.pin,
  });
  const dates = [...new Set([
    candidate.statutory.recipientSez.statusAsOf,
    candidate.statutory.serviceRecipient.statusAsOf,
  ])];
  await deploy.begin(async tx => {
    await tx`INSERT INTO public.party_fiscal_registration(
        tenant_id,id,party_id,scheme,registration_number,region_code,legal_name,trade_name,
        address_line1,locality,pin)
      VALUES(${candidate.fixture.tenant}::uuid,${registrationId}::uuid,
        ${candidate.fixture.party}::uuid,'in-gstin',${recipient.gstin},${recipient.stateCode},
        ${recipient.legalName},${recipient.tradeName},${recipient.addressLine1},
        ${recipient.locality},${recipient.pin})`;
    for (const statusAsOf of dates) {
      await tx`INSERT INTO public.india_gst_recipient_sez_status(
          tenant_id,id,recipient_registration_id,recipient_registration_evidence_hash,
          status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,
          gst_status_evidence_sha256,legal_rule)
        VALUES(${candidate.fixture.tenant}::uuid,${crypto.randomUUID()}::uuid,
          ${registrationId}::uuid,${evidenceHash},${statusAsOf}::date,'active','regular',
          'gst_common_portal',${candidate.statutory.recipientSez.gstRegistration.evidenceSha256},
          'IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS')`;
    }
  });
  return Object.freeze({ ...recipient, evidenceHash });
}

/** Full-row fingerprints of the eight immutable fiscal/accounting artifact tables. */
export async function operatorInvoiceArtifactSnapshot(
  deploy: SQL,
  tenantId: string,
): Promise<readonly string[]> {
  const snapshot: string[] = [];
  for (const table of ["fiscal_submission", "fiscal_submission_history", "fact_log", "outbox",
    "document", "document_series", "journal", "posting_line"] as const) {
    const rows = await deploy.unsafe<Array<{ body: string }>>(
      `SELECT to_jsonb(source)::text AS body FROM public.${table} source
       WHERE tenant_id=$1::uuid ORDER BY to_jsonb(source)::text`,
      [tenantId],
    );
    snapshot.push(...rows.map(row => `${table}:${row.body}`));
  }
  return Object.freeze(snapshot);
}

export async function moveOperatorFixtureIssueClock(
  deploy: SQL,
  candidate: Awaited<ReturnType<typeof createOperatorInvoiceFixture>>,
  timezone: string,
) {
  const [clock] = await deploy<Array<{ issue_date: string }>>`
    UPDATE public.org_node SET timezone=${timezone}
     WHERE tenant_id=${candidate.fixture.tenant}::uuid AND id=${candidate.fixture.property}::uuid
     RETURNING (transaction_timestamp() AT TIME ZONE timezone)::date::text AS issue_date`;
  if (!clock) throw new Error("Q208 synthetic issue clock could not be moved");
  await deploy`INSERT INTO public.business_day(tenant_id,property_node,business_date)
    VALUES(${candidate.fixture.tenant}::uuid,${candidate.fixture.property}::uuid,${clock.issue_date}::date)
    ON CONFLICT DO NOTHING`;
  return clock.issue_date;
}

export async function addOperatorIssueDateSupplierStatus(
  deploy: SQL,
  candidate: Awaited<ReturnType<typeof createOperatorInvoiceFixture>>,
  issueDate: string,
) {
  await deploy`INSERT INTO public.india_gst_supplier_registration_status_snapshot(
      tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,
      gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule)
    VALUES(${candidate.fixture.tenant}::uuid,${crypto.randomUUID()}::uuid,
      ${candidate.statutory.seller.registrationId}::uuid,${candidate.statutory.seller.evidenceHash},
      ${issueDate}::date,'active','regular','gst_common_portal',${candidate.statutory.gst.evidenceSha256},
      'CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS')
    ON CONFLICT DO NOTHING`;
}
