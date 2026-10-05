const HASH = /^[0-9a-f]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface CreatePositiveTaxAttributionSnapshotInput {
  readonly origin: Readonly<{ readonly kind: "rate_quote"; readonly quoteHash: string }>;
  readonly currency: string;
  readonly line: Readonly<{
    readonly lineId: string;
    readonly revenueGroup: string;
    readonly amountMinor: bigint;
    readonly nights: number;
    readonly personNights: number;
    readonly roomNights: readonly Readonly<{ readonly businessDate: string; readonly amountMinor: bigint }>[];
  }>;
  readonly assignments: readonly Readonly<{
    readonly businessDate: string;
    readonly jurisdictionKey: string;
    readonly evidenceRef: string;
  }>[];
  readonly jurisdiction: Readonly<{
    readonly extensionId: string;
    readonly ownerTenantId: string;
    readonly key: string;
    readonly version: number;
    readonly contentHash: string;
    readonly evidenceRef: string;
  }>;
  readonly evaluation: Readonly<{
    readonly schemaVersion: 1;
    readonly jurisdictionKey: string;
    readonly country: string;
    readonly priceDisplay: string;
    readonly rounding: string;
    readonly inputTotalMinor: bigint;
    readonly baseTotalMinor: bigint;
    readonly taxTotalMinor: bigint;
    readonly grandTotalMinor: bigint;
    readonly taxes: readonly Readonly<{
      readonly code: string;
      readonly name: string;
      readonly taxMinor: bigint;
      readonly components: readonly Readonly<{
        readonly lineId: string;
        readonly revenueGroup: string;
        readonly baseMinor: bigint;
        readonly taxMinor: bigint;
        readonly rateBasisPoints: number;
      }>[];
    }>[];
  }>;
}

export interface PositiveTaxAttributionSnapshot {
  readonly origin: Readonly<{ readonly kind: "rate_quote"; readonly quoteHash: string }>;
  readonly currency: string;
  readonly revenueLine: Readonly<{
    readonly lineId: string;
    readonly revenueGroup: string;
    readonly amountMinor: string;
    readonly nights: number;
    readonly personNights: number;
    readonly roomNights: readonly Readonly<{ readonly businessDate: string; readonly amountMinor: string }>[];
  }>;
  readonly assignments: readonly CreatePositiveTaxAttributionSnapshotInput["assignments"][number][];
  readonly jurisdiction: CreatePositiveTaxAttributionSnapshotInput["jurisdiction"];
  readonly evaluation: Readonly<{
    readonly schemaVersion: 1;
    readonly jurisdictionKey: string;
    readonly country: string;
    readonly priceDisplay: string;
    readonly rounding: string;
    readonly inputTotalMinor: string;
    readonly baseTotalMinor: string;
    readonly taxTotalMinor: string;
    readonly grandTotalMinor: string;
    readonly taxes: readonly Readonly<{
      readonly code: string;
      readonly name: string;
      readonly taxMinor: string;
      readonly components: readonly Readonly<{
        readonly lineId: string;
        readonly revenueGroup: string;
        readonly baseMinor: string;
        readonly taxMinor: string;
        readonly rateBasisPoints: number;
      }>[];
    }>[];
  }>;
  readonly snapshotHash: string;
}

type MutableRecord = Record<PropertyKey, unknown>;

function assertPlainObject(value: unknown, label: string): asserts value is MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertHash(value: unknown, label: string): string {
  if (typeof value !== "string" || !HASH.test(value)) throw new Error(`${label} must be a sha256 hex digest`);
  return value;
}

function assertDate(value: unknown, label: string): string {
  if (typeof value !== "string" || !DATE.test(value)) throw new Error(`${label} must be an ISO date`);
  return value;
}

function assertPositiveBigint(value: unknown, label: string): bigint {
  if (typeof value !== "bigint" || value <= 0n) throw new Error(`${label} must be a positive bigint`);
  return value;
}

function stringifyBigints(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(stringifyBigints);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) out[key] = stringifyBigints((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

function freezeDeep<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) freezeDeep((value as MutableRecord)[key], seen);
  return Object.freeze(value);
}

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createPositiveTaxAttributionSnapshot(
  input: CreatePositiveTaxAttributionSnapshotInput,
): PositiveTaxAttributionSnapshot {
  assertPlainObject(input, "tax attribution input");
  assertHash(input.origin.quoteHash, "quote hash");
  assertHash(input.jurisdiction.contentHash, "jurisdiction content hash");
  const amountMinor = assertPositiveBigint(input.line.amountMinor, "line amount");
  if (!input.line.roomNights.length) throw new Error("room-night attribution is required");
  const roomNights = input.line.roomNights.map((night) => ({
    businessDate: assertDate(night.businessDate, "room-night business date"),
    amountMinor: assertPositiveBigint(night.amountMinor, "room-night amount").toString(),
  }));
  const evaluation = {
    ...input.evaluation,
    inputTotalMinor: assertPositiveBigint(input.evaluation.inputTotalMinor, "input total").toString(),
    baseTotalMinor: assertPositiveBigint(input.evaluation.baseTotalMinor, "base total").toString(),
    taxTotalMinor: input.evaluation.taxTotalMinor.toString(),
    grandTotalMinor: assertPositiveBigint(input.evaluation.grandTotalMinor, "grand total").toString(),
    taxes: input.evaluation.taxes.map((tax) => ({
      ...tax,
      taxMinor: tax.taxMinor.toString(),
      components: tax.components.map((component) => ({
        ...component,
        baseMinor: component.baseMinor.toString(),
        taxMinor: component.taxMinor.toString(),
      })),
    })),
  } as const;
  const snapshotWithoutHash = {
    origin: { kind: input.origin.kind, quoteHash: input.origin.quoteHash },
    currency: input.currency,
    revenueLine: {
      lineId: input.line.lineId,
      revenueGroup: input.line.revenueGroup,
      amountMinor: amountMinor.toString(),
      nights: input.line.nights,
      personNights: input.line.personNights,
      roomNights,
    },
    assignments: input.assignments.map((assignment) => ({
      businessDate: assertDate(assignment.businessDate, "assignment business date"),
      jurisdictionKey: assignment.jurisdictionKey,
      evidenceRef: assignment.evidenceRef,
    })),
    jurisdiction: { ...input.jurisdiction },
    evaluation,
  };
  return freezeDeep({ ...snapshotWithoutHash, snapshotHash: digest(stringifyBigints(snapshotWithoutHash)) });
}

export function parsePositiveTaxAttributionSnapshot(value: unknown): PositiveTaxAttributionSnapshot {
  assertPlainObject(value, "tax attribution snapshot");
  const snapshot = value as Partial<PositiveTaxAttributionSnapshot>;
  if (snapshot.origin?.kind !== "rate_quote") throw new Error("unsupported attribution origin");
  assertHash(snapshot.origin.quoteHash, "quote hash");
  if (typeof snapshot.currency !== "string" || snapshot.currency.length !== 3) throw new Error("currency is invalid");
  if (typeof snapshot.revenueLine?.lineId !== "string" || typeof snapshot.revenueLine.revenueGroup !== "string") {
    throw new Error("revenue line is invalid");
  }
  if (typeof snapshot.evaluation?.grandTotalMinor !== "string") throw new Error("evaluation is invalid");
  assertHash(snapshot.snapshotHash, "snapshot hash");
  return freezeDeep(snapshot as PositiveTaxAttributionSnapshot);
}
