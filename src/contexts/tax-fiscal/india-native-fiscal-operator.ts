import { types as utilTypes } from "node:util";
import type { Tx } from "../../kernel";
import { snapshotFiscalSubmissionDeliveryReceipt, type FiscalSubmissionDeliveryReceipt } from "./fiscal-submission-receipt";
import { snapshotIndiaNativeFiscalInvoiceCalendarEvidence } from "./india-native-fiscal-invoice";
import { FiscalSubmissionAdapterAvailabilityService, type FiscalSubmissionAdapterPresentation } from "./fiscal-submission-adapter-availability";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Row = Record<string, unknown>;
type ErrorCode = "invalid_input" | "invalid_receipt" | "invalid_readiness" | "invalid_providers" | "permission_denied" | "unsupported_jurisdiction" | "database_error";
export type IndiaFiscalProviderOption = Readonly<FiscalSubmissionAdapterPresentation & { label: string }>;
export type IndiaFiscalProviderOptionsResult = Readonly<{ ok: true; value: readonly IndiaFiscalProviderOption[] }> | OperatorFailure;
type OperatorFailure = Readonly<{ ok: false; error: Readonly<{ code: ErrorCode; message: string }> }>;
type Party = Readonly<{ legalName: string; gstin: string; stateCode: string; addressLine: string; locality: string; postalCode: string }>;
type RoomNight = Readonly<{ ordinal: number; businessDate: string; taxableMinor: string; taxMinor: string;
  aggregateRateBasisPoints: number; components: readonly Readonly<{ identity: string; rateBasisPoints: number; taxMinor: string }>[] }>;
export type IndiaNativeFiscalOperatorReadiness = Readonly<
  | { kind: "issued"; documentId: string }
  | { kind: "blocked"; blocker: string }
  | { kind: "selection_required"; recipients: readonly Readonly<{ recipientRegistrationId: string; legalName: string; gstin: string; stateCode: string }>[] }
  | { kind: "ready"; selectorHash: string; evidenceHash: string; confirmation: Readonly<{
      buyer: Party & Readonly<{ recipientRegistrationId: string }>; seller: Party; placeOfSupplyStateCode: string;
      issueDate: string; timeOfSupplyDate: string; serviceProvisionDate: string; paymentReceiptDate: string;
      seriesPrefix: string; financialYearStart: string; currency: "INR"; taxableMinor: string; taxMinor: string; totalMinor: string;
      configuration: Readonly<{ extensionId: string; version: number; contentHash: string }>; roomNights: readonly RoomNight[];
    }> }
>;
export type IndiaNativeFiscalOperatorReadinessResult =
  Readonly<{ ok: true; value: IndiaNativeFiscalOperatorReadiness }> | OperatorFailure;

export type IndiaNativeFiscalDocumentDelivery = Readonly<
  | { kind: "not_requested" | "ambiguous"; documentId: string }
  | { kind: "legacy_unsupported"; documentId: string; submissionId: string }
  | { kind: "receipt"; documentId: string; receipt: FiscalSubmissionDeliveryReceipt }
>;
export type IndiaNativeFiscalDocumentDeliveryResult = Readonly<
  | { ok: true; value: IndiaNativeFiscalDocumentDelivery | null }
  | { ok: false; error: Readonly<{ code: ErrorCode; message: string }> }
>;

function failure(code: ErrorCode): OperatorFailure {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message: "Invoice registration information is unavailable" }) });
}
function record(value: unknown): Row | null {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value) || (prototype !== Object.prototype && prototype !== null)
      || Object.getOwnPropertySymbols(value).length) return null;
    const result: Row = Object.create(null);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!("value" in descriptor) || !descriptor.enumerable) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch { return null; }
}
function exact(row: Row, keys: readonly string[]): boolean {
  return Object.keys(row).length === keys.length && keys.every(key => Object.hasOwn(row, key));
}
function uuid(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }
function databaseFailure(error: unknown): OperatorFailure {
  if (typeof error === "object" && error !== null && !utilTypes.isProxy(error)) {
    for (const key of ["code", "errno", "sqlState"]) {
      const descriptor = Object.getOwnPropertyDescriptor(error, key);
      if (descriptor && "value" in descriptor) {
        if (descriptor.value === "42501") return failure("permission_denied");
        if (descriptor.value === "P2082") return failure("unsupported_jurisdiction");
      }
    }
  }
  return failure("database_error");
}

/** Query only: current receipt permission is enforced independently from document access. */
export class IndiaNativeFiscalOperatorReadService {
  async providers(tx: Tx, raw: unknown, adapters: FiscalSubmissionAdapterAvailabilityService): Promise<IndiaFiscalProviderOptionsResult> {
    const input = record(raw);
    if (!input || !exact(input, ["tenantId", "propertyNode", "actorId"]) || !Object.values(input).every(uuid)
        || typeof tx !== "function" || !(adapters instanceof FiscalSubmissionAdapterAvailabilityService)) return failure("invalid_input");
    const configured = adapters.configured();
    const ids = "{" + configured.map(entry => entry.providerExtensionId).join(",") + "}";
    let rows: unknown;
    try {
      // Even the empty configured set invokes the owner-mediated authorization/
      // jurisdiction preflight. The browser never selects tenant, actor or environment.
      rows = await tx`SELECT extension_id, extension_version, provider_key, label
        FROM public.list_india_fiscal_submission_provider_options(
          ${input.tenantId}::uuid, ${input.propertyNode}::uuid, ${input.actorId}::uuid)
        WHERE extension_id = ANY(${ids}::uuid[])`;
    } catch (error) { return databaseFailure(error); }
    try {
      if (typeof rows !== "object" || rows === null || utilTypes.isProxy(rows) || !Array.isArray(rows)) throw new Error();
      const length = Object.getOwnPropertyDescriptor(rows, "length");
      if (!length || !("value" in length) || !Number.isInteger(length.value) || length.value < 0 || length.value > 16) throw new Error();
      const seen = new Set<string>(), result: IndiaFiscalProviderOption[] = [];
      for (let i = 0; i < length.value; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(rows, String(i));
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error();
        const row = requireRecord(descriptor.value, ["extension_id", "extension_version", "provider_key", "label"]);
        const id = text(row.extension_id, 36, UUID), version = integer(row.extension_version, 1, 2147483647);
        const key = text(row.provider_key, 128, /^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$/);
        const label = text(row.label, 256);
        if (seen.has(id)) throw new Error(); seen.add(id);
        const match = configured.find(entry => entry.providerExtensionId === id
          && entry.providerExtensionVersion === version && entry.providerKey === key);
        if (match) result.push(Object.freeze({ ...match, label }));
      }
      return Object.freeze({ ok: true, value: Object.freeze(result) });
    } catch { return failure("invalid_providers"); }
  }

  async discover(tx: Tx, raw: unknown): Promise<IndiaNativeFiscalOperatorReadinessResult> {
    const input = record(raw);
    if (!input || !exact(input, ["tenantId", "propertyNode", "actorId", "reservationId", "folioId", "recipientRegistrationId", "calendarEvidence"])
      || !["tenantId", "propertyNode", "actorId", "reservationId", "folioId"].every(key => uuid(input[key]))
      || (input.recipientRegistrationId !== null && !uuid(input.recipientRegistrationId))
      || typeof tx !== "function") return failure("invalid_input");
    let calendar;
    try { calendar = snapshotIndiaNativeFiscalInvoiceCalendarEvidence(input.calendarEvidence); }
    catch { return failure("invalid_input"); }
    // Snapshot route and governed calendar before the first await. SQL, never this projection, computes readiness.
    const dates = "{" + (calendar?.days.map(day => day.date).join(",") ?? "") + "}";
    const states = "{" + (calendar?.days.map(day => day.state).join(",") ?? "") + "}";
    let rows: unknown;
    try {
      rows = await tx`SELECT public.discover_india_native_fiscal_issue(
        ${input.tenantId}::uuid, ${input.propertyNode}::uuid, ${input.actorId}::uuid,
        ${input.reservationId}::uuid, ${input.folioId}::uuid, ${input.recipientRegistrationId}::uuid,
        ${calendar?.authorityId ?? null}, ${calendar?.sourceDigestSha256 ?? null},
        ${calendar?.throughDate ?? null}::date, ${dates}::date[], ${states}::text[]
      ) AS readiness`;
    } catch (error) { return databaseFailure(error); }
    try {
      const wrapper = requireRecord(singleResultRow(rows), ["readiness"]);
      return Object.freeze({ ok: true, value: projectReadiness(wrapper.readiness, input) });
    } catch { return failure("invalid_readiness"); }
  }

  async readDelivery(tx: Tx, raw: unknown): Promise<IndiaNativeFiscalDocumentDeliveryResult> {
    const input = record(raw);
    if (!input || !exact(input, ["tenantId", "propertyNode", "actorId", "documentId"])
      || !Object.values(input).every(uuid) || typeof tx !== "function") return failure("invalid_input");
    // Detach before waiting. No caller-selected submission or provider can steer this lookup.
    const tenantId = input.tenantId as string, propertyNode = input.propertyNode as string;
    const actorId = input.actorId as string, documentId = input.documentId as string;
    try {
      const rows: unknown = await tx`
        SELECT public.read_india_fiscal_submission_delivery_receipt_by_document(
          ${tenantId}::uuid, ${propertyNode}::uuid, ${documentId}::uuid, ${actorId}::uuid
        ) AS delivery
      `;
      if (typeof rows !== "object" || rows === null || utilTypes.isProxy(rows) || !Array.isArray(rows)) return failure("invalid_receipt");
      const length = Object.getOwnPropertyDescriptor(rows, "length"), first = Object.getOwnPropertyDescriptor(rows, "0");
      if (!length || !("value" in length) || length.value !== 1 || !first || !("value" in first)) return failure("invalid_receipt");
      const wrapper = record(first.value);
      if (!wrapper || !exact(wrapper, ["delivery"])) return failure("invalid_receipt");
      if (wrapper.delivery === null) return Object.freeze({ ok: true, value: null });
      const delivery = record(wrapper.delivery);
      if (!delivery || delivery.documentId !== documentId) return failure("invalid_receipt");
      if ((delivery.kind === "not_requested" || delivery.kind === "ambiguous") && exact(delivery, ["kind", "documentId"])) {
        return Object.freeze({ ok: true, value: Object.freeze({ kind: delivery.kind, documentId }) });
      }
      if (delivery.kind === "legacy_unsupported" && exact(delivery, ["kind", "documentId", "submissionId"]) && uuid(delivery.submissionId)) {
        return Object.freeze({ ok: true, value: Object.freeze({ kind: delivery.kind, documentId, submissionId: delivery.submissionId }) });
      }
      if (delivery.kind !== "receipt" || !exact(delivery, ["kind", "documentId", "receipt"])) return failure("invalid_receipt");
      const receipt = snapshotFiscalSubmissionDeliveryReceipt(delivery.receipt);
      if (!receipt || receipt.tenantId !== tenantId || receipt.propertyNode !== propertyNode || receipt.documentId !== documentId) {
        return failure("invalid_receipt");
      }
      return Object.freeze({ ok: true, value: Object.freeze({ kind: "receipt", documentId, receipt }) });
    } catch (error) { return databaseFailure(error); }
  }
}

const HASH = /^[0-9a-f]{64}$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const BLOCKERS = new Set(["valuation_unavailable", "intake_unavailable", "recipient_registration_unavailable",
  "working_day_calendar_required", "supplier_registration_unavailable", "supplier_location_unavailable",
  "supplier_status_unavailable", "recipient_status_unavailable", "classification_unavailable",
  "business_day_unavailable", "supplier_issue_status_unavailable", "recipient_selection_too_broad"]);

function requireRecord(value: unknown, keys?: readonly string[]): Row {
  const row = record(value);
  if (!row || (keys && !exact(row, keys))) throw new Error();
  return row;
}
/** SQL result arrays carry driver metadata. Consume only the one own data row,
 * without touching metadata accessors; nested JSON arrays remain strict below. */
function singleResultRow(value: unknown): unknown {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value) || !Array.isArray(value)) throw new Error();
  const length = Object.getOwnPropertyDescriptor(value, "length");
  const first = Object.getOwnPropertyDescriptor(value, "0");
  if (!length || !("value" in length) || length.value !== 1
    || !first || !("value" in first) || !first.enumerable) throw new Error();
  return first.value;
}
function dataArray(value: unknown, maximum: number): unknown[] {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value) || !Array.isArray(value)
    || Object.getOwnPropertySymbols(value).length) throw new Error();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (!length || !("value" in length) || !Number.isInteger(length.value) || length.value < 0 || length.value > maximum
    || Object.keys(descriptors).length !== length.value + 1) throw new Error();
  const result: unknown[] = [];
  for (let i = 0; i < length.value; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error();
    result.push(descriptor.value);
  }
  return result;
}
function text(value: unknown, maximum: number, pattern?: RegExp): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum * 2 || !value.isWellFormed()
    || Array.from(value).length > maximum || value.trim() !== value || /[\u0000-\u001f\u007f-\u009f]/u.test(value)
    || (pattern && !pattern.test(value))) throw new Error();
  return value;
}
function civilDate(value: unknown): string {
  const result = text(value, 10, /^(?!0000)\d{4}-\d{2}-\d{2}$/);
  const date = new Date(result + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== result) throw new Error();
  return result;
}
function minor(value: unknown): string {
  const result = text(value, 19, /^(0|[1-9][0-9]*)$/);
  if (BigInt(result) > 9223372036854775807n) throw new Error();
  return result;
}
function integer(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error();
  return value;
}
function party(value: unknown, buyer: boolean): Party {
  const row = requireRecord(value);
  const gstin = text(row.gstin, 15, GSTIN), stateCode = text(row.stateCode, 2, /^[0-9]{2}$/);
  if (!gstin.startsWith(stateCode)) throw new Error();
  return Object.freeze({ legalName: text(row.legalName, 100), gstin, stateCode,
    addressLine: text(buyer ? row.addressLine1 : row.addressLine, 100), locality: text(row.locality, 50),
    postalCode: text(buyer ? row.pin : row.postalCode, 6, /^[1-9][0-9]{5}$/) });
}
function projectReadiness(value: unknown, input: Row): IndiaNativeFiscalOperatorReadiness {
  const row = requireRecord(value);
  if (row.kind === "issued" && exact(row, ["kind", "documentId"]) && uuid(row.documentId)) {
    return Object.freeze({ kind: "issued", documentId: row.documentId });
  }
  if (row.kind === "blocked" && exact(row, ["kind", "blocker"]) && typeof row.blocker === "string" && BLOCKERS.has(row.blocker)) {
    return Object.freeze({ kind: "blocked", blocker: row.blocker });
  }
  if (row.kind === "selection_required" && exact(row, ["kind", "recipients"]) && input.recipientRegistrationId === null) {
    const seen = new Set<string>();
    const recipients = dataArray(row.recipients, 500).map(value => {
      const item = requireRecord(value, ["recipientRegistrationId", "legalName", "gstin", "stateCode"]);
      const recipientRegistrationId = text(item.recipientRegistrationId, 36, UUID);
      const gstin = text(item.gstin, 15, GSTIN), stateCode = text(item.stateCode, 2, /^[0-9]{2}$/);
      if (seen.has(recipientRegistrationId) || !gstin.startsWith(stateCode)) throw new Error();
      seen.add(recipientRegistrationId);
      return Object.freeze({ recipientRegistrationId, legalName: text(item.legalName, 100), gstin, stateCode });
    });
    return Object.freeze({ kind: "selection_required", recipients: Object.freeze(recipients) });
  }
  if (row.kind !== "ready" || !exact(row, ["kind", "selectorHash", "evidenceHash", "confirmation", "internalSelectors"])
    || !uuid(input.recipientRegistrationId)) throw new Error();
  const selectorHash = text(row.selectorHash, 64, HASH), evidenceHash = text(row.evidenceHash, 64, HASH);
  const source = requireRecord(row.confirmation, ["version", "kind", "tenantId", "propertyNode", "reservationId", "folioId",
    "recipientRegistrationId", "selectorHash", "buyer", "seller", "placeOfSupply", "classification", "serviceSupplyNature",
    "timing", "valuationEvidence", "quotedTaxComposition", "recordingRoots", "configuration", "issue"]);
  const selectors = requireRecord(row.internalSelectors, ["valuationId", "serviceProvisionSnapshotId", "paymentReceiptSnapshotId",
    "ordinaryRegimeEvidenceId", "supplierServiceLocationId", "supplierRegistrationStatusId", "supplierSezStatusId",
    "recipientRegistrationId", "recipientSezStatusId", "classificationId"]);
  if (!Object.values(selectors).every(uuid) || selectors.recipientRegistrationId !== input.recipientRegistrationId
    || source.kind !== "india_native_operator_confirmation_v1" || source.version !== 1 || source.selectorHash !== selectorHash
    || !["tenantId", "propertyNode", "reservationId", "folioId", "recipientRegistrationId"].every(key => source[key] === input[key])) throw new Error();
  const buyerSource = requireRecord(source.buyer), sellerSource = requireRecord(source.seller);
  if (buyerSource.registrationId !== input.recipientRegistrationId || sellerSource.propertyNode !== input.propertyNode
    || sellerSource.currency !== "INR" || !uuid(sellerSource.registrationId)) throw new Error();
  const buyer = Object.freeze({ ...party(buyerSource, true), recipientRegistrationId: input.recipientRegistrationId });
  const seller = party(sellerSource, false);
  const place = requireRecord(source.placeOfSupply);
  if (!["propertyNode", "reservationId", "folioId"].every(key => place[key] === input[key])) throw new Error();
  const placeOfSupplyStateCode = text(place.pos, 2, /^[0-9]{2}$/);
  const timing = requireRecord(source.timing), issue = requireRecord(source.issue);
  if (issue.businessDayOpen !== true || issue.supplierRegistrationId !== sellerSource.registrationId
    || timing.propertyNode !== input.propertyNode || timing.reservationId !== input.reservationId || timing.currency !== "INR") throw new Error();
  const issueDate = civilDate(issue.issueDate), timeOfSupplyDate = civilDate(timing.timeOfSupplyDate);
  if (timing.invoiceIssueDate !== issueDate) throw new Error();
  const financialYearStart = civilDate(issue.financialYearStart);
  const year = Number(issueDate.slice(0, 4)) - (issueDate.slice(5) < "04-01" ? 1 : 0);
  if (financialYearStart !== String(year).padStart(4, "0") + "-04-01") throw new Error();
  const configuration = requireRecord(source.configuration, ["selectedExtensionId", "selectedExtensionVersion", "selectedExtensionContentHash"]);
  const quoted = requireRecord(source.quotedTaxComposition);
  const preview = requireRecord(quoted.taxPreview);
  const config = Object.freeze({ extensionId: text(configuration.selectedExtensionId, 36, UUID),
    version: integer(configuration.selectedExtensionVersion, 1, 2147483647),
    contentHash: text(configuration.selectedExtensionContentHash, 64, HASH) });
  if (preview.selectedExtensionId !== config.extensionId || preview.selectedExtensionVersion !== config.version
    || preview.selectedContentHash !== config.contentHash || preview.valuationId !== selectors.valuationId) throw new Error();
  const taxableMinor = minor(preview.transactionValueMinor), taxMinor = minor(preview.taxMinor), totalMinor = minor(preview.grandTotalMinor);
  if (BigInt(taxableMinor) + BigInt(taxMinor) !== BigInt(totalMinor)) throw new Error();
  const nights = dataArray(preview.persistenceRoomNights, 366);
  if (!nights.length) throw new Error();
  let taxableSum = 0n, taxSum = 0n;
  const roomNights = nights.map((value, index) => {
    const night = requireRecord(value, ["ordinal", "businessDate", "finalValueMinor", "slabUptoMinor",
      "aggregateRateBasisPoints", "itcEligible", "taxMinor", "components"]);
    const ordinal = integer(night.ordinal, 0, 365), businessDate = civilDate(night.businessDate);
    if (ordinal !== index || typeof night.itcEligible !== "boolean") throw new Error();
    if (night.slabUptoMinor !== null) integer(night.slabUptoMinor, 0, Number.MAX_SAFE_INTEGER);
    const taxable = minor(night.finalValueMinor), tax = minor(night.taxMinor);
    const components = dataArray(night.components, 4).map(value => {
      const component = requireRecord(value, ["identity", "rateBasisPoints", "taxMinor"]);
      return Object.freeze({ identity: text(component.identity, 5, /^(igst|cgst|sgst|utgst)$/),
        rateBasisPoints: integer(component.rateBasisPoints, 0, 10000), taxMinor: minor(component.taxMinor) });
    });
    const aggregateRateBasisPoints = integer(night.aggregateRateBasisPoints, 0, 10000);
    if (!components.length || new Set(components.map(c => c.identity)).size !== components.length
      || components.reduce((sum, c) => sum + c.rateBasisPoints, 0) !== aggregateRateBasisPoints
      || components.reduce((sum, c) => sum + BigInt(c.taxMinor), 0n) !== BigInt(tax)) throw new Error();
    taxableSum += BigInt(taxable); taxSum += BigInt(tax);
    return Object.freeze({ ordinal, businessDate, taxableMinor: taxable, taxMinor: tax,
      aggregateRateBasisPoints, components: Object.freeze(components) });
  });
  if (taxableSum !== BigInt(taxableMinor) || taxSum !== BigInt(taxMinor)) throw new Error();
  return Object.freeze({ kind: "ready", selectorHash, evidenceHash, confirmation: Object.freeze({
    buyer, seller, placeOfSupplyStateCode, issueDate, timeOfSupplyDate,
    serviceProvisionDate: civilDate(timing.serviceProvisionDate), paymentReceiptDate: civilDate(timing.paymentReceiptDate),
    seriesPrefix: text(issue.prefix, 12, /^[A-Za-z0-9/-]+$/), financialYearStart, currency: "INR",
    taxableMinor, taxMinor, totalMinor, configuration: config, roomNights: Object.freeze(roomNights),
  }) });
}
