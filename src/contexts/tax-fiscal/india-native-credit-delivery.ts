import { types as utilTypes } from "node:util";
import type { Tx } from "../../kernel";
import {
  snapshotFiscalSubmissionDeliveryReceipt,
  type FiscalSubmissionDeliveryReceipt,
} from "./fiscal-submission-receipt";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const INPUT_KEYS = ["tenantId", "propertyNode", "actorId", "creditDocumentId"] as const;

export interface IndiaNativeCreditDeliveryInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly actorId: string;
  readonly creditDocumentId: string;
}

export type IndiaNativeCreditDelivery = Readonly<
  | { readonly kind: "not_requested" | "ambiguous"; readonly documentId: string }
  | { readonly kind: "legacy_unsupported"; readonly documentId: string; readonly submissionId: string }
  | { readonly kind: "receipt"; readonly documentId: string; readonly receipt: FiscalSubmissionDeliveryReceipt }
>;

export class IndiaNativeCreditDeliveryValidationError extends Error {
  constructor(message = "India native credit delivery input is invalid") {
    super(message);
    this.name = "IndiaNativeCreditDeliveryValidationError";
  }
}

export class IndiaNativeCreditDeliveryAuthorizationError extends Error {
  constructor(message = "India native credit delivery authority is unavailable") {
    super(message);
    this.name = "IndiaNativeCreditDeliveryAuthorizationError";
  }
}

export class IndiaNativeCreditDeliveryDatabaseError extends Error {
  constructor(message = "India native credit delivery is unavailable") {
    super(message);
    this.name = "IndiaNativeCreditDeliveryDatabaseError";
  }
}

type PlainRecord = Record<string, unknown>;

function record(value: unknown, keys: readonly string[]): PlainRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const names = Reflect.ownKeys(value);
    if (names.length !== keys.length || names.some(name => typeof name !== "string")
      || keys.some(key => !names.includes(key))) return null;
    const result: PlainRecord = Object.create(null) as PlainRecord;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true
        || descriptor.get !== undefined || descriptor.set !== undefined) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch { return null; }
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function snapshotIndiaNativeCreditDeliveryInput(
  value: unknown,
): Readonly<IndiaNativeCreditDeliveryInput> | null {
  const row = record(value, INPUT_KEYS);
  if (!row || !INPUT_KEYS.every(key => uuid(row[key]))) return null;
  return Object.freeze({
    tenantId: row.tenantId as string,
    propertyNode: row.propertyNode as string,
    actorId: row.actorId as string,
    creditDocumentId: row.creditDocumentId as string,
  });
}

function sqlState(error: unknown): string | null {
  if (typeof error !== "object" || error === null || utilTypes.isProxy(error)) return null;
  try {
    let first: string | null = null;
    for (const key of ["code", "errno", "sqlState"] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(error, key);
      if (descriptor && "value" in descriptor && typeof descriptor.value === "string") {
        if (descriptor.value === "42501") return descriptor.value;
        first ??= descriptor.value;
      }
    }
    return first;
  } catch { return null; }
}

function resultRow(value: unknown): PlainRecord {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value) || !Array.isArray(value)) throw new Error();
  const length = Object.getOwnPropertyDescriptor(value, "length");
  const first = Object.getOwnPropertyDescriptor(value, "0");
  if (!length || !("value" in length) || length.value !== 1 || !first || !("value" in first) || !first.enumerable) throw new Error();
  const row = record(first.value, ["delivery"]);
  if (!row) throw new Error();
  return row;
}

function projectDelivery(value: unknown, input: IndiaNativeCreditDeliveryInput): IndiaNativeCreditDelivery {
  if (value === null) throw new IndiaNativeCreditDeliveryDatabaseError();
  const row = record(value, ["kind", "documentId"]);
  if (row && row.documentId === input.creditDocumentId && (row.kind === "not_requested" || row.kind === "ambiguous")) {
    return Object.freeze({ kind: row.kind, documentId: input.creditDocumentId });
  }
  const legacy = record(value, ["kind", "documentId", "submissionId"]);
  if (legacy && legacy.kind === "legacy_unsupported" && legacy.documentId === input.creditDocumentId
    && uuid(legacy.submissionId)) {
    return Object.freeze({ kind: "legacy_unsupported", documentId: input.creditDocumentId, submissionId: legacy.submissionId });
  }
  const receiptRow = record(value, ["kind", "documentId", "receipt"]);
  if (!receiptRow || receiptRow.kind !== "receipt" || receiptRow.documentId !== input.creditDocumentId) {
    throw new IndiaNativeCreditDeliveryDatabaseError();
  }
  const receipt = snapshotFiscalSubmissionDeliveryReceipt(receiptRow.receipt);
  if (!receipt || receipt.tenantId !== input.tenantId || receipt.propertyNode !== input.propertyNode
    || receipt.documentId !== input.creditDocumentId) throw new IndiaNativeCreditDeliveryDatabaseError();
  return Object.freeze({ kind: "receipt", documentId: input.creditDocumentId, receipt });
}

export class IndiaNativeCreditDeliveryService {
  async read(tx: Tx, value: unknown): Promise<Readonly<IndiaNativeCreditDelivery> | null> {
    const input = snapshotIndiaNativeCreditDeliveryInput(value);
    if (!input || typeof tx !== "function") throw new IndiaNativeCreditDeliveryValidationError();
    try {
      const rows = await tx<Array<{ readonly delivery: unknown }>>`
        SELECT public.read_india_native_credit_delivery_by_document(
          ${input.tenantId}::uuid, ${input.propertyNode}::uuid,
          ${input.actorId}::uuid, ${input.creditDocumentId}::uuid
        ) AS delivery
      `;
      const row = resultRow(rows);
      if (row.delivery === null) return null;
      return projectDelivery(row.delivery, input);
    } catch (error) {
      if (error instanceof IndiaNativeCreditDeliveryValidationError
        || error instanceof IndiaNativeCreditDeliveryDatabaseError) throw error;
      if (sqlState(error) === "42501") throw new IndiaNativeCreditDeliveryAuthorizationError();
      throw new IndiaNativeCreditDeliveryDatabaseError();
    }
  }
}
