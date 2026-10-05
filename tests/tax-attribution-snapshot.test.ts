import { describe, expect, test } from "bun:test";
import {
  TaxAttributionSnapshotError,
  createPositiveTaxAttributionSnapshot,
  parsePositiveTaxAttributionSnapshot,
  type CreatePositiveTaxAttributionSnapshotInput,
  type PositiveTaxAttributionSnapshotV1,
} from "../src/contexts/tax-fiscal";

const HASH = "a".repeat(64);
const CONTENT_HASH = "b".repeat(64);
const ASSIGNMENT_HASHES = ["c".repeat(64), "d".repeat(64)] as const;
const EXTENSION_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";

function input(
  priceDisplay: "tax_exclusive" | "tax_inclusive" = "tax_exclusive",
  rounding: "line" | "document" = "line",
): CreatePositiveTaxAttributionSnapshotInput {
  const inputAmount = priceDisplay === "tax_exclusive" ? 20_000n : 23_600n;
  const base = 20_000n;
  const tax = 3_600n;
  return {
    origin: { kind: "rate_quote", quoteHash: HASH },
    currency: "INR",
    line: {
      lineId: "room",
      revenueGroup: "room_revenue",
      amountMinor: inputAmount,
      nights: 2,
      personNights: 4,
      roomNights: [
        { businessDate: "2026-08-28", amountMinor: inputAmount / 2n },
        { businessDate: "2026-08-29", amountMinor: inputAmount / 2n },
      ],
    },
    assignments: [
      {
        businessDate: "2026-08-28",
        jurisdictionKey: "in.gst.hotel",
        evidenceRef: `tax-assignment:${ASSIGNMENT_HASHES[0]}`,
      },
      {
        businessDate: "2026-08-29",
        jurisdictionKey: "in.gst.hotel",
        evidenceRef: `tax-assignment:${ASSIGNMENT_HASHES[1]}`,
      },
    ],
    jurisdiction: {
      extensionId: EXTENSION_ID,
      ownerTenantId: TENANT_ID,
      key: "in.gst.hotel",
      version: 3,
      contentHash: CONTENT_HASH,
      evidenceRef: `tax-jurisdiction:${"e".repeat(64)}`,
    },
    evaluation: {
      schemaVersion: 1,
      jurisdictionKey: "in.gst.hotel",
      country: "IN",
      priceDisplay,
      rounding,
      inputTotalMinor: inputAmount,
      baseTotalMinor: base,
      taxTotalMinor: tax,
      grandTotalMinor: 23_600n,
      taxes: [{
        code: "GST_ROOM",
        name: "Room GST",
        taxMinor: tax,
        components: [{
          lineId: "room",
          revenueGroup: "room_revenue",
          baseMinor: base,
          taxMinor: rounding === "line" ? tax : null,
          rateBasisPoints: 1_800,
        }],
      }],
    },
  };
}

function jsonCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectRecursivelyFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectRecursivelyFrozen(child, seen);
}

function expectNoBigInt(value: unknown, seen = new Set<object>()): void {
  expect(typeof value).not.toBe("bigint");
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const child of Object.values(value)) expectNoBigInt(child, seen);
}

function expectSnapshotError(operation: () => unknown): void {
  expect(operation).toThrow(TaxAttributionSnapshotError);
}

describe("Order 240 canonical positive tax-attribution snapshot", () => {
  test("exclusive evidence round-trips as deeply frozen canonical JSON without bigint", () => {
    const source = input();
    const before = structuredClone(source);
    const snapshot = createPositiveTaxAttributionSnapshot(source);
    const encoded = JSON.stringify(snapshot);
    const parsed = parsePositiveTaxAttributionSnapshot(JSON.parse(encoded));

    expect(source).toEqual(before);
    expect(parsed).toEqual(snapshot);
    expect(parsed).not.toBe(snapshot);
    expectNoBigInt(snapshot);
    expect(snapshot.revenueLine.inputAmountMinor).toBe("20000");
    expect(snapshot.evaluation.taxTotalMinor).toBe("3600");
    expect(snapshot.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
    expectRecursivelyFrozen(snapshot);
    expectRecursivelyFrozen(parsed);
  });

  test("inclusive and document-rounded evidence preserve exact totals and null components", () => {
    const snapshot = createPositiveTaxAttributionSnapshot(input("tax_inclusive", "document"));
    expect(snapshot.revenueLine.inputAmountMinor).toBe("23600");
    expect(snapshot.evaluation).toMatchObject({
      inputTotalMinor: "23600",
      baseTotalMinor: "20000",
      taxTotalMinor: "3600",
      grandTotalMinor: "23600",
      rounding: "document",
    });
    expect(snapshot.evaluation.taxes[0]!.components[0]!.taxMinor).toBeNull();
    expect(parsePositiveTaxAttributionSnapshot(jsonCopy(snapshot))).toEqual(snapshot);
  });

  test("hash binds quote, assignment and jurisdiction lineage deterministically", () => {
    const first = createPositiveTaxAttributionSnapshot(input());
    const replay = createPositiveTaxAttributionSnapshot(input());
    const quoteChanged = structuredClone(input());
    (quoteChanged.origin as { quoteHash: string }).quoteHash = "f".repeat(64);
    const assignmentChanged = structuredClone(input());
    (assignmentChanged.assignments[1] as { evidenceRef: string }).evidenceRef = `tax-assignment:${"0".repeat(64)}`;

    expect(replay.snapshotHash).toBe(first.snapshotHash);
    expect(createPositiveTaxAttributionSnapshot(quoteChanged).snapshotHash).not.toBe(first.snapshotHash);
    expect(createPositiveTaxAttributionSnapshot(assignmentChanged).snapshotHash).not.toBe(first.snapshotHash);
    const tampered = jsonCopy(first);
    (tampered.jurisdiction as { contentHash: string }).contentHash = "1".repeat(64);
    expectSnapshotError(() => parsePositiveTaxAttributionSnapshot(tampered));
  });

  test("creation rejects incoherent monetary and quantity reconciliation", () => {
    const roomMismatch = structuredClone(input());
    (roomMismatch.line.roomNights[1] as { amountMinor: bigint }).amountMinor = 9_999n;
    expectSnapshotError(() => createPositiveTaxAttributionSnapshot(roomMismatch));

    const taxMismatch = structuredClone(input());
    (taxMismatch.evaluation.taxes[0] as { taxMinor: bigint }).taxMinor = 3_599n;
    expectSnapshotError(() => createPositiveTaxAttributionSnapshot(taxMismatch));

    const peopleMismatch = structuredClone(input());
    (peopleMismatch.line as { personNights: number }).personNights = 3;
    expectSnapshotError(() => createPositiveTaxAttributionSnapshot(peopleMismatch));

    const inclusionMismatch = structuredClone(input("tax_inclusive"));
    (inclusionMismatch.evaluation as { grandTotalMinor: bigint }).grandTotalMinor = 23_601n;
    expectSnapshotError(() => createPositiveTaxAttributionSnapshot(inclusionMismatch));
  });

  test("parser rejects unknown, non-enumerable, accessor and cyclic data shapes", () => {
    const canonical = jsonCopy(createPositiveTaxAttributionSnapshot(input())) as unknown as Record<string, unknown>;
    expectSnapshotError(() => parsePositiveTaxAttributionSnapshot({ ...canonical, extra: true }));

    const hidden = jsonCopy(canonical);
    Object.defineProperty(hidden, "hidden", { value: true, enumerable: false });
    expectSnapshotError(() => parsePositiveTaxAttributionSnapshot(hidden));

    const accessor = jsonCopy(canonical);
    Object.defineProperty(accessor, "currency", { enumerable: true, get: () => "INR" });
    expectSnapshotError(() => parsePositiveTaxAttributionSnapshot(accessor));

    const cyclic = jsonCopy(canonical) as Record<string, unknown>;
    cyclic.origin = cyclic;
    expectSnapshotError(() => parsePositiveTaxAttributionSnapshot(cyclic));
  });

  test("parser rejects noncanonical decimals, ordering, duplicates and malformed identity", () => {
    const canonical = createPositiveTaxAttributionSnapshot(input());

    const decimal = jsonCopy(canonical);
    (decimal.revenueLine as { nights: string }).nights = "02";
    expectSnapshotError(() => parsePositiveTaxAttributionSnapshot(decimal));

    const ordered = jsonCopy(canonical);
    const nights = ordered.revenueLine.roomNights as unknown as Array<{ index: string }>;
    [nights[0], nights[1]] = [nights[1]!, nights[0]!];
    expectSnapshotError(() => parsePositiveTaxAttributionSnapshot(ordered));

    const duplicate = jsonCopy(canonical);
    (duplicate.assignments[1] as { evidenceRef: string }).evidenceRef = duplicate.assignments[0]!.evidenceRef;
    expectSnapshotError(() => parsePositiveTaxAttributionSnapshot(duplicate));

    const uuid = jsonCopy(canonical);
    (uuid.jurisdiction as { extensionId: string }).extensionId = "AAAAAAAA-1111-4111-8111-111111111111";
    expectSnapshotError(() => parsePositiveTaxAttributionSnapshot(uuid));

    const hash = jsonCopy(canonical);
    (hash.origin as { quoteHash: string }).quoteHash = "g".repeat(64);
    expectSnapshotError(() => parsePositiveTaxAttributionSnapshot(hash));
  });

  test("line/document component allocation shapes cannot be interchanged", () => {
    const line = structuredClone(input("tax_exclusive", "line"));
    (line.evaluation.taxes[0]!.components[0] as { taxMinor: bigint | null }).taxMinor = null;
    expectSnapshotError(() => createPositiveTaxAttributionSnapshot(line));

    const document = structuredClone(input("tax_exclusive", "document"));
    (document.evaluation.taxes[0]!.components[0] as { taxMinor: bigint | null }).taxMinor = 3_600n;
    expectSnapshotError(() => createPositiveTaxAttributionSnapshot(document));
  });

  test("creation rejects caller-supplied fields and unsafe signed-range values", () => {
    const unknown = structuredClone(input()) as CreatePositiveTaxAttributionSnapshotInput & { taxPayableAccount?: string };
    unknown.taxPayableAccount = "invented";
    expectSnapshotError(() => createPositiveTaxAttributionSnapshot(unknown));

    const unsafe = structuredClone(input());
    (unsafe.line as { amountMinor: bigint }).amountMinor = 9_223_372_036_854_775_808n;
    expectSnapshotError(() => createPositiveTaxAttributionSnapshot(unsafe));

    const unsafePeople = structuredClone(input());
    (unsafePeople.line as { personNights: number }).personNights = 260;
    expectSnapshotError(() => createPositiveTaxAttributionSnapshot(unsafePeople));

    const unsafeVersion = structuredClone(input());
    (unsafeVersion.jurisdiction as { version: number }).version = Number.MAX_SAFE_INTEGER + 1;
    expectSnapshotError(() => createPositiveTaxAttributionSnapshot(unsafeVersion));
  });
});
