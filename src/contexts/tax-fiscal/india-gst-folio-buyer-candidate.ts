import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";
import {
  IndiaGstRecipientRegistrationService,
  type IndiaGstRecipientRegistrationResult,
} from "./india-gst-recipient-registration";
import {
  buildIndiaIrpBuyerDetails,
  type IndiaIrpBuyerDetailsResultV1,
} from "./india-irp-buyer-details";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CURRENCY = /^[A-Z]{3}$/;
const INPUT_KEYS = [
  "tenantId",
  "propertyNode",
  "folioId",
  "recipientPartyId",
  "registrationId",
] as const;
const ROW_KEYS = [
  "folio_id",
  "tenant_id",
  "account_id",
  "reservation_id",
  "window_no",
  "folio_status",
  "account_property_node",
  "account_role",
  "account_status",
  "account_currency",
  "reservation_property_node",
  "reservation_status",
  "reservation_currency",
] as const;
const FOLIO_STATUSES = new Set(["open", "settled", "closed"]);
const ACCOUNT_ROLES = new Set([
  "guest", "company", "group_master", "house", "outlet", "event", "trust",
  "ar_control", "cash", "bank", "card_clearing", "upi_clearing", "revenue",
  "tax_payable", "deposit_liability", "payable", "fx",
]);
const ACCOUNT_STATUSES = new Set(["open", "frozen", "closed"]);
const RESERVATION_STATUSES = new Set([
  "quote", "reserved", "waitlist", "due_in", "in_house", "due_out",
  "checked_out", "cancelled", "no_show",
]);

export interface IndiaGstFolioBuyerCandidateInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly folioId: string;
  readonly recipientPartyId: string;
  readonly registrationId: string;
}

export interface IndiaGstFolioBuyerCandidateResult {
  readonly folio: Readonly<{
    folioId: string;
    accountId: string;
    reservationId: string;
    windowNo: number;
    folioStatus: string;
    accountRole: string;
    accountStatus: string;
    reservationStatus: string;
    currency: string;
    propertyNode: string;
  }>;
  readonly recipient: Readonly<{
    partyId: string;
    registrationId: string;
    evidenceHash: string;
  }>;
  readonly buyer: Readonly<{
    format: "irp_json_1_1";
    payload: IndiaIrpBuyerDetailsResultV1["payload"];
    payloadJson: string;
    payloadHash: string;
  }>;
  readonly associationJson: string;
  readonly associationHash: string;
}

interface FolioAnchorRow {
  readonly folio_id: string;
  readonly tenant_id: string;
  readonly account_id: string;
  readonly reservation_id: string;
  readonly window_no: number;
  readonly folio_status: string;
  readonly account_property_node: string;
  readonly account_role: string;
  readonly account_status: string;
  readonly account_currency: string;
  readonly reservation_property_node: string;
  readonly reservation_status: string;
  readonly reservation_currency: string;
}

export class IndiaGstFolioBuyerCandidateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstFolioBuyerCandidateValidationError";
  }
}

export class IndiaGstFolioBuyerCandidateNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstFolioBuyerCandidateNotFoundError";
  }
}

export class IndiaGstFolioBuyerCandidateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstFolioBuyerCandidateConflictError";
  }
}

function exactPlainInput(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 ||
      (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null)) {
    throw new IndiaGstFolioBuyerCandidateValidationError(
      "folio buyer candidate input must be an exact plain object",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...INPUT_KEYS].sort();
  if (keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) =>
        descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || !("value" in descriptor))) {
    throw new IndiaGstFolioBuyerCandidateValidationError(
      "folio buyer candidate input shape is invalid",
    );
  }
  return value as Record<string, unknown>;
}

function inputUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaGstFolioBuyerCandidateValidationError(
      `${subject} must be a canonical UUID`,
    );
  }
  return value;
}

function normalizeInput(value: unknown): IndiaGstFolioBuyerCandidateInput {
  const input = exactPlainInput(value);
  return Object.freeze({
    tenantId: inputUuid(input.tenantId, "tenantId"),
    propertyNode: inputUuid(input.propertyNode, "propertyNode"),
    folioId: inputUuid(input.folioId, "folioId"),
    recipientPartyId: inputUuid(input.recipientPartyId, "recipientPartyId"),
    registrationId: inputUuid(input.registrationId, "registrationId"),
  });
}

function exactStoredRow(value: unknown): FolioAnchorRow {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 ||
      (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null)) {
    throw new IndiaGstFolioBuyerCandidateConflictError(
      "stored folio buyer candidate anchor is invalid",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...ROW_KEYS].sort();
  if (keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) =>
        descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || !("value" in descriptor))) {
    throw new IndiaGstFolioBuyerCandidateConflictError(
      "stored folio buyer candidate anchor shape is invalid",
    );
  }
  return value as FolioAnchorRow;
}

function storedUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaGstFolioBuyerCandidateConflictError(`${subject} is invalid`);
  }
  return value;
}

function storedMember(
  value: unknown,
  allowed: ReadonlySet<string>,
  subject: string,
): string {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new IndiaGstFolioBuyerCandidateConflictError(`${subject} is invalid`);
  }
  return value;
}

function canonicalFolio(
  candidate: unknown,
  input: IndiaGstFolioBuyerCandidateInput,
): IndiaGstFolioBuyerCandidateResult["folio"] {
  const row = exactStoredRow(candidate);
  const folioId = storedUuid(row.folio_id, "stored folio id");
  const tenantId = storedUuid(row.tenant_id, "stored folio tenant id");
  const accountId = storedUuid(row.account_id, "stored folio account id");
  const reservationId = storedUuid(
    row.reservation_id,
    "stored folio reservation id",
  );
  const accountPropertyNode = storedUuid(
    row.account_property_node,
    "stored account property node",
  );
  const reservationPropertyNode = storedUuid(
    row.reservation_property_node,
    "stored reservation property node",
  );
  if (folioId !== input.folioId || tenantId !== input.tenantId ||
      accountPropertyNode !== input.propertyNode ||
      reservationPropertyNode !== input.propertyNode) {
    throw new IndiaGstFolioBuyerCandidateConflictError(
      "stored folio buyer candidate anchor conflicts with the selected identity",
    );
  }
  if (!Number.isSafeInteger(row.window_no) || row.window_no < 1 || row.window_no > 20) {
    throw new IndiaGstFolioBuyerCandidateConflictError("stored folio window is invalid");
  }
  const folioStatus = storedMember(
    row.folio_status,
    FOLIO_STATUSES,
    "stored folio status",
  );
  const accountRole = storedMember(
    row.account_role,
    ACCOUNT_ROLES,
    "stored account role",
  );
  const accountStatus = storedMember(
    row.account_status,
    ACCOUNT_STATUSES,
    "stored account status",
  );
  const reservationStatus = storedMember(
    row.reservation_status,
    RESERVATION_STATUSES,
    "stored reservation status",
  );
  if (typeof row.account_currency !== "string" ||
      !CURRENCY.test(row.account_currency) ||
      row.reservation_currency !== row.account_currency) {
    throw new IndiaGstFolioBuyerCandidateConflictError(
      "stored folio buyer candidate currency is inconsistent",
    );
  }
  return Object.freeze({
    folioId,
    accountId,
    reservationId,
    windowNo: row.window_no,
    folioStatus,
    accountRole,
    accountStatus,
    reservationStatus,
    currency: row.account_currency,
    propertyNode: input.propertyNode,
  });
}

async function readExactFolio(
  tx: Tx,
  input: IndiaGstFolioBuyerCandidateInput,
): Promise<IndiaGstFolioBuyerCandidateResult["folio"]> {
  const rows = await tx<FolioAnchorRow[]>`
    SELECT folio.id::text AS folio_id,
           folio.tenant_id::text AS tenant_id,
           folio.account_id::text AS account_id,
           folio.reservation_id::text AS reservation_id,
           folio.window_no::int AS window_no,
           folio.status AS folio_status,
           account.property_node::text AS account_property_node,
           account.role AS account_role,
           account.status AS account_status,
           account.currency::text AS account_currency,
           reservation.property_node::text AS reservation_property_node,
           reservation.status AS reservation_status,
           reservation.currency::text AS reservation_currency
      FROM public.folio AS folio
      JOIN public.account AS account
        ON account.tenant_id = folio.tenant_id
       AND account.id = folio.account_id
       AND account.property_node = ${input.propertyNode}::uuid
      JOIN public.reservation AS reservation
        ON reservation.tenant_id = folio.tenant_id
       AND reservation.id = folio.reservation_id
       AND reservation.property_node = account.property_node
     WHERE folio.tenant_id = ${input.tenantId}::uuid
       AND folio.tenant_id = current_setting('app.tenant_id', true)::uuid
       AND folio.id = ${input.folioId}::uuid
       AND account.property_node = ${input.propertyNode}::uuid
     ORDER BY folio.id, account.id, reservation.id
  `;
  if (rows.length === 0) {
    throw new IndiaGstFolioBuyerCandidateNotFoundError(
      "selected folio buyer candidate anchor is unavailable",
    );
  }
  if (rows.length !== 1 || rows[0] === undefined) {
    throw new IndiaGstFolioBuyerCandidateConflictError(
      "selected folio buyer candidate anchor is ambiguous",
    );
  }
  return canonicalFolio(rows[0], input);
}

function recipientLineage(
  recipient: IndiaGstRecipientRegistrationResult,
): IndiaGstFolioBuyerCandidateResult["recipient"] {
  return Object.freeze({
    partyId: recipient.partyId,
    registrationId: recipient.registrationId,
    evidenceHash: recipient.evidenceHash,
  });
}

function buyerEvidence(
  buyer: IndiaIrpBuyerDetailsResultV1,
): IndiaGstFolioBuyerCandidateResult["buyer"] {
  return Object.freeze({
    format: buyer.format,
    payload: buyer.payload,
    payloadJson: buyer.payloadJson,
    payloadHash: buyer.payloadHash,
  });
}

export class IndiaGstFolioBuyerCandidateService {
  async resolve(
    tx: Tx,
    input: IndiaGstFolioBuyerCandidateInput,
  ): Promise<IndiaGstFolioBuyerCandidateResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstFolioBuyerCandidateValidationError(
        "tenant transaction is unavailable",
      );
    }
    const exact = normalizeInput(input);
    const folio = await readExactFolio(tx, exact);
    const recipientEvidence = await new IndiaGstRecipientRegistrationService().resolve(tx, {
      tenantId: exact.tenantId,
      recipientPartyId: exact.recipientPartyId,
      registrationId: exact.registrationId,
    });
    const buyerDetails = buildIndiaIrpBuyerDetails(recipientEvidence);
    const recipient = recipientLineage(recipientEvidence);
    const buyer = buyerEvidence(buyerDetails);
    const associationJson = JSON.stringify({ folio, recipient, buyer });
    const associationHash = new Bun.CryptoHasher("sha256")
      .update(associationJson)
      .digest("hex");
    return Object.freeze({
      folio,
      recipient,
      buyer,
      associationJson,
      associationHash,
    });
  }
}
