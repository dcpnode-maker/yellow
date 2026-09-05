import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";
import {
  PositiveTaxFolioEligibilityService,
  type PositiveTaxFolioEligibilityInput,
  type PositiveTaxFolioEligibilityResult,
} from "./folio-eligibility";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const JURISDICTION_KEY = /^[a-z0-9][a-z0-9_.:-]{0,127}$/;
const ACCOMMODATION_SAC = new Set([
  "996311", "996312", "996313", "996321", "996322", "996329",
]);
const INPUT_KEYS = ["tenantId", "propertyNode", "reservationId", "classificationId"] as const;
const ROW_KEYS = [
  "tenant_id",
  "id",
  "property_node",
  "jurisdiction_extension_id",
  "jurisdiction_owner_tenant_id",
  "jurisdiction_key",
  "jurisdiction_version",
  "jurisdiction_content_hash",
  "country_code",
  "line_id",
  "revenue_group",
  "classification_system",
  "classification_code",
  "is_service_code",
] as const;

interface EligibilityResolver {
  resolve(
    tx: Tx,
    input: PositiveTaxFolioEligibilityInput,
  ): Promise<PositiveTaxFolioEligibilityResult>;
}

interface ClassificationRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly property_node: string;
  readonly jurisdiction_extension_id: string;
  readonly jurisdiction_owner_tenant_id: string | null;
  readonly jurisdiction_key: string;
  readonly jurisdiction_version: number;
  readonly jurisdiction_content_hash: string;
  readonly country_code: string;
  readonly line_id: string;
  readonly revenue_group: string;
  readonly classification_system: string;
  readonly classification_code: string;
  readonly is_service_code: string;
}

export interface IndiaGstAccommodationClassificationInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly classificationId: string;
}

export interface IndiaGstAccommodationClassificationResult {
  readonly classificationId: string;
  readonly propertyNode: string;
  readonly jurisdiction: Readonly<{
    extensionId: string;
    ownerTenantId: string | null;
    key: string;
    version: string;
    contentHash: string;
  }>;
  readonly lineId: "room";
  readonly revenueGroup: "room_revenue";
  readonly classificationSystem: "SAC";
  readonly classificationCode: string;
  readonly isServiceCode: "Y";
  readonly evidenceHash: string;
}

export class IndiaGstAccommodationClassificationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationClassificationValidationError";
  }
}

export class IndiaGstAccommodationClassificationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationClassificationNotFoundError";
  }
}

export class IndiaGstAccommodationClassificationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationClassificationConflictError";
  }
}

function exactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
  subject: string,
  error: (message: string) => Error,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 ||
      (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null)) {
    throw error(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) =>
        descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || !("value" in descriptor))) {
    throw error(`${subject} shape is invalid`);
  }
  return value as Record<string, unknown>;
}

function inputUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaGstAccommodationClassificationValidationError(
      `${subject} must be a canonical UUID`,
    );
  }
  return value;
}

function normalizeInput(value: unknown): IndiaGstAccommodationClassificationInput {
  const source = exactPlainRecord(
    value,
    INPUT_KEYS,
    "India GST accommodation-classification input",
    (message) => new IndiaGstAccommodationClassificationValidationError(message),
  );
  return Object.freeze({
    tenantId: inputUuid(source.tenantId, "tenantId"),
    propertyNode: inputUuid(source.propertyNode, "propertyNode"),
    reservationId: inputUuid(source.reservationId, "reservationId"),
    classificationId: inputUuid(source.classificationId, "classificationId"),
  });
}

function exactStoredRow(value: unknown): ClassificationRow {
  return exactPlainRecord(
    value,
    ROW_KEYS,
    "stored India GST accommodation-classification row",
    (message) => new IndiaGstAccommodationClassificationConflictError(message),
  ) as unknown as ClassificationRow;
}

function storedUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaGstAccommodationClassificationConflictError(`${subject} is invalid`);
  }
  return value;
}

function exactIndiaEligibility(eligibility: PositiveTaxFolioEligibilityResult): void {
  if (eligibility.currency !== "INR" || eligibility.snapshot.currency !== "INR" ||
      eligibility.snapshot.evaluation.country !== "IN" ||
      eligibility.snapshot.evaluation.jurisdictionKey !== eligibility.snapshot.jurisdiction.key ||
      eligibility.snapshot.revenueLine.lineId !== "room" ||
      eligibility.snapshot.revenueLine.revenueGroup !== "room_revenue") {
    throw new IndiaGstAccommodationClassificationConflictError(
      "frozen positive-tax eligibility is not exact India accommodation evidence",
    );
  }
}

function canonicalResult(
  candidate: unknown,
  input: IndiaGstAccommodationClassificationInput,
  eligibility: PositiveTaxFolioEligibilityResult,
): IndiaGstAccommodationClassificationResult {
  const row = exactStoredRow(candidate);
  const tenantId = storedUuid(row.tenant_id, "stored classification tenant id");
  const classificationId = storedUuid(row.id, "stored classification id");
  const propertyNode = storedUuid(row.property_node, "stored classification property id");
  const extensionId = storedUuid(
    row.jurisdiction_extension_id,
    "stored classification jurisdiction extension id",
  );
  const ownerTenantId = row.jurisdiction_owner_tenant_id === null
    ? null
    : storedUuid(
      row.jurisdiction_owner_tenant_id,
      "stored classification jurisdiction owner tenant id",
    );
  const jurisdiction = eligibility.snapshot.jurisdiction;
  const version = Number(jurisdiction.version);
  if (!Number.isSafeInteger(version) || version <= 0 ||
      tenantId !== input.tenantId || classificationId !== input.classificationId ||
      propertyNode !== input.propertyNode || eligibility.propertyNode !== input.propertyNode ||
      eligibility.reservationId !== input.reservationId ||
      extensionId !== jurisdiction.extensionId || ownerTenantId !== jurisdiction.ownerTenantId ||
      row.jurisdiction_key !== jurisdiction.key || !JURISDICTION_KEY.test(row.jurisdiction_key) ||
      row.jurisdiction_version !== version ||
      row.jurisdiction_content_hash !== jurisdiction.contentHash ||
      !SHA256.test(row.jurisdiction_content_hash) || row.country_code !== "IN" ||
      row.line_id !== "room" || row.revenue_group !== "room_revenue" ||
      row.classification_system !== "SAC" ||
      !ACCOMMODATION_SAC.has(row.classification_code) || row.is_service_code !== "Y") {
    throw new IndiaGstAccommodationClassificationConflictError(
      "selected classification conflicts with frozen jurisdiction evidence",
    );
  }

  const frozenJurisdiction = Object.freeze({
    extensionId,
    ownerTenantId,
    key: row.jurisdiction_key,
    version: jurisdiction.version,
    contentHash: row.jurisdiction_content_hash,
  });
  const evidence = Object.freeze({
    tenantId,
    classificationId,
    propertyNode,
    jurisdiction: frozenJurisdiction,
    lineId: "room" as const,
    revenueGroup: "room_revenue" as const,
    classificationSystem: "SAC" as const,
    classificationCode: row.classification_code,
    isServiceCode: "Y" as const,
  });
  return Object.freeze({
    classificationId,
    propertyNode,
    jurisdiction: frozenJurisdiction,
    lineId: evidence.lineId,
    revenueGroup: evidence.revenueGroup,
    classificationSystem: evidence.classificationSystem,
    classificationCode: row.classification_code,
    isServiceCode: evidence.isServiceCode,
    evidenceHash: new Bun.CryptoHasher("sha256")
      .update(JSON.stringify(evidence))
      .digest("hex"),
  });
}

async function readExactClassification(
  tx: Tx,
  input: IndiaGstAccommodationClassificationInput,
  eligibility: PositiveTaxFolioEligibilityResult,
): Promise<IndiaGstAccommodationClassificationResult> {
  exactIndiaEligibility(eligibility);
  const jurisdiction = eligibility.snapshot.jurisdiction;
  const jurisdictionVersion = Number(jurisdiction.version);
  if (!Number.isSafeInteger(jurisdictionVersion) || jurisdictionVersion <= 0) {
    throw new IndiaGstAccommodationClassificationConflictError(
      "frozen tax-jurisdiction version is invalid",
    );
  }
  const rows = await tx<ClassificationRow[]>`
    SELECT classification.tenant_id::text AS tenant_id,
           classification.id::text AS id,
           classification.property_node::text AS property_node,
           classification.jurisdiction_extension_id::text AS jurisdiction_extension_id,
           classification.jurisdiction_owner_tenant_id::text AS jurisdiction_owner_tenant_id,
           classification.jurisdiction_key,
           classification.jurisdiction_version::int AS jurisdiction_version,
           classification.jurisdiction_content_hash,
           classification.country_code::text AS country_code,
           classification.line_id,
           classification.revenue_group,
           classification.classification_system,
           classification.classification_code,
           classification.is_service_code::text AS is_service_code
      FROM public.india_gst_item_classification AS classification
      JOIN public.org_node AS property
        ON property.tenant_id = classification.tenant_id
       AND property.id = classification.property_node
       AND property.kind = 'property'
     WHERE classification.tenant_id = ${input.tenantId}::uuid
       AND classification.tenant_id = current_setting('app.tenant_id', true)::uuid
       AND classification.id = ${input.classificationId}::uuid
       AND classification.property_node = ${input.propertyNode}::uuid
       AND classification.jurisdiction_extension_id = ${jurisdiction.extensionId}::uuid
       AND classification.jurisdiction_owner_tenant_id IS NOT DISTINCT FROM
           ${jurisdiction.ownerTenantId}::uuid
       AND classification.jurisdiction_key = ${jurisdiction.key}
       AND classification.jurisdiction_version = ${jurisdictionVersion}::integer
       AND classification.jurisdiction_content_hash = ${jurisdiction.contentHash}
       AND classification.country_code = 'IN'::char(2)
       AND classification.line_id = 'room'
       AND classification.revenue_group = 'room_revenue'
       AND classification.classification_system = 'SAC'
       AND classification.classification_code IN (
         '996311', '996312', '996313', '996321', '996322', '996329'
       )
       AND classification.is_service_code = 'Y'::char(1)
     ORDER BY classification.id
  `;
  if (rows.length === 0) {
    throw new IndiaGstAccommodationClassificationNotFoundError(
      "selected India GST accommodation classification is unavailable",
    );
  }
  if (rows.length !== 1 || rows[0] === undefined) {
    throw new IndiaGstAccommodationClassificationConflictError(
      "selected India GST accommodation classification is ambiguous",
    );
  }
  return canonicalResult(rows[0], input, eligibility);
}

export class IndiaGstAccommodationClassificationService {
  constructor(
    private readonly eligibility: EligibilityResolver =
      new PositiveTaxFolioEligibilityService(),
  ) {}

  async resolve(
    tx: Tx,
    input: IndiaGstAccommodationClassificationInput,
  ): Promise<IndiaGstAccommodationClassificationResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstAccommodationClassificationValidationError(
        "tenant transaction is unavailable",
      );
    }
    const normalized = normalizeInput(input);
    const eligibilityInput = Object.freeze({
      tenantId: normalized.tenantId,
      propertyNode: normalized.propertyNode,
      reservationId: normalized.reservationId,
    });
    const eligibility = await this.eligibility.resolve(tx, eligibilityInput);
    return readExactClassification(tx, normalized, eligibility);
  }
}
