import { describe, expect, test } from "bun:test";
import {
  AvailabilityService,
  type AvailabilityOption,
} from "../src/contexts/inventory";
import {
  ReservationOfferSearchService,
  ReservationOfferSearchTooBroadError,
  type ReservationOfferSearchInput,
} from "../src/contexts/reservations";
import type { RatePlan, RateQuote, ResolveRateQuoteInput } from "../src/contexts/rates";

const PROPERTY = "00000000-0000-4000-8000-000000009001";
const PLAN_ID = "00000000-0000-4000-8000-000000009002";
const TYPE_STD = "00000000-0000-4000-8000-000000009010";
const TYPE_DLX = "00000000-0000-4000-8000-000000009020";
const expectedPhysicalQuotes = [
  { room: "101", id: "00000000-0000-4000-8000-000000000001", release: "00000000-0000-4000-8000-000000000051", hash: `${"b".repeat(63)}1`, state: "bookable", amount: 25_000n },
  { room: "102", id: "00000000-0000-4000-8000-000000000002", release: "00000000-0000-4000-8000-000000000052", hash: `${"b".repeat(63)}2`, state: "bookable", amount: 25_000n },
  { room: "103", id: "00000000-0000-4000-8000-000000000003", release: "00000000-0000-4000-8000-000000000053", hash: `${"b".repeat(63)}3`, state: "bookable", amount: 25_000n },
  { room: "201", id: "00000000-0000-4000-8000-000000000004", release: "00000000-0000-4000-8000-000000000054", hash: `${"b".repeat(63)}4`, state: "blocked", amount: null },
  { room: "202", id: "00000000-0000-4000-8000-000000000005", release: "00000000-0000-4000-8000-000000000055", hash: `${"b".repeat(63)}5`, state: "bookable", amount: 25_000n },
  { room: "203", id: "00000000-0000-4000-8000-000000000006", release: "00000000-0000-4000-8000-000000000056", hash: `${"b".repeat(63)}6`, state: "conflict", amount: null },
] as const;

const inventory: readonly AvailabilityOption[] = Object.freeze([
  ...["101", "102", "103"].map((room, index) => option(room, index + 1, TYPE_STD, "STD")),
  ...["201", "202", "203"].map((room, index) => option(room, index + 4, TYPE_DLX, "DLX")),
]);

function option(room: string, suffix: number, typeId: string, code: string): AvailabilityOption {
  return Object.freeze({
    sellableUnitId: `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`,
    sellableUnitName: `Room ${room}`,
    unitTypeId: typeId,
    unitTypeCode: code,
    unitTypeName: code === "STD" ? "Standard" : "Deluxe",
    profileKey: "hotel",
    maxOccupancy: 3,
    availableCount: 1,
    bookable: true,
    restrictionsApplied: Object.freeze([]),
    operationalBlocksApplied: Object.freeze([]),
  });
}

const plan: RatePlan = Object.freeze({
  id: PLAN_ID,
  tenantId: PROPERTY,
  propertyNode: PROPERTY,
  code: "FLEX",
  name: "Flexible",
  currency: "USD",
  taxInclusive: false,
  cancellationPolicyId: null,
  guaranteePolicyId: null,
  depositPolicyId: null,
  parentPlanId: null,
  derivation: null,
  marketCode: null,
  sourceCode: null,
  status: "active",
});

const searchInput: ReservationOfferSearchInput = Object.freeze({
  propertyNode: PROPERTY,
  stayStart: new Date("2030-01-10T15:00:00.000Z"),
  stayEnd: new Date("2030-01-12T11:00:00.000Z"),
  guests: Object.freeze({ adults: 2, childAges: Object.freeze([]) }),
  channelCode: "direct",
});

function quoteFor(input: ResolveRateQuoteInput, state: "quoted" | "blocked" | "conflict"): RateQuote {
  const exact = inventory.find(({ sellableUnitId }) => sellableUnitId === input.sellableUnitId);
  if (!exact) throw new Error("test quote received an unknown physical sellable");
  const bookable = state === "quoted";
  const result = {
    state,
    reason: state === "blocked" ? "room_blocked" : state === "conflict" ? "quote_conflict" : null,
    currency: "USD",
    roomAmountMinor: bookable ? 25_000n : null,
    includedAllocationMinor: 0n,
    packageExtraMinor: 0n,
    promotionDiscountMinor: 0n,
    preTaxSubtotalMinor: bookable ? 25_000n : null,
    selectedPromotionCodes: [],
    appliedPromotionCodes: [],
    conflictingPromotionCodes: [],
    conflictStage: null,
    guests: input.guests,
    packageEvidence: null,
    policyEvidence: [],
    mandatoryPolicyEvidence: [],
    refundTreatment: "policy",
    restrictionEvidence: [],
    operationalBlockEvidence: [],
    availabilityEvidence: {
      sellableUnitId: exact.sellableUnitId,
      availableCount: bookable ? 1 : 0,
      bookable,
      restrictionEvidence: [],
      operationalBlockEvidence: [],
      evidenceRef: `availability:${exact.sellableUnitId}`,
    },
    distributionEvidence: { channelCode: "direct", mappingEvidenceRef: null },
    rateEvaluations: bookable ? [{
      nightDate: "2030-01-10",
      evaluationContext: {} as never,
      evaluationResult: { amountMinor: 25_000n } as never,
    }] : [],
    workUnits: 1,
  };
  return {
    tenantId: PROPERTY,
    propertyNode: PROPERTY,
    ratePlanId: PLAN_ID,
    releaseId: `00000000-0000-4000-8000-${String(50 + Number(exact.sellableUnitId.slice(-1))).padStart(12, "0")}`,
    releaseVersion: 1,
    releaseContentHash: "a".repeat(64),
    modelDraftId: PLAN_ID,
    modelDraftVersion: 1,
    targetDraftId: PLAN_ID,
    targetDraftVersion: 1,
    sellableUnitId: exact.sellableUnitId,
    unitTypeId: exact.unitTypeId,
    bookingInstant: "2030-01-01T00:00:00.000Z",
    propertyTimeZone: "UTC",
    stayStartDate: "2030-01-10",
    stayEndDate: "2030-01-12",
    availabilityOption: exact,
    occupancyEvidence: [],
    taxAssignmentState: "none",
    taxAssignments: [],
    taxPreview: { state: "unavailable", reason: "unassigned", assignments: [] },
    result: result as unknown as RateQuote["result"],
    quoteHash: `${"b".repeat(63)}${exact.sellableUnitId.slice(-1)}`,
  };
}

describe("physical reservation offer pairs", () => {
  test("keeps each sibling's identity and exact quote state, including both blocker orderings", async () => {
    const requested: string[] = [];
    const quotes = {
      async resolve(_tx: never, value: ResolveRateQuoteInput) {
        requested.push(value.sellableUnitId);
        const room = inventory.find(({ sellableUnitId }) => sellableUnitId === value.sellableUnitId);
        const state = room?.sellableUnitName === "Room 201" ? "blocked"
          : room?.sellableUnitName === "Room 203" ? "conflict" : "quoted";
        return quoteFor(value, state);
      },
    };
    const service = new ReservationOfferSearchService(
      { async listRatePlans() { return [plan]; } } as never,
      quotes as never,
      { async search() { return inventory; } } as Pick<AvailabilityService, "search">,
    );

    const result = await service.search({} as never, searchInput);
    expect(result.summary).toMatchObject({ inventoryOptions: 6, candidatePairs: 6, evaluatedPairs: 6, bookable: 4, blocked: 1, conflicted: 1 });
    expect(result.options.map(({ sellableUnit }) => sellableUnit.name)).toEqual([
      "Room 201", "Room 202", "Room 203", "Room 101", "Room 102", "Room 103",
    ]);
    expect(result.options.find(({ sellableUnit }) => sellableUnit.name === "Room 201"))
      .toMatchObject({ state: "blocked", total: null, perNight: [] });
    expect(result.options.find(({ sellableUnit }) => sellableUnit.name === "Room 202"))
      .toMatchObject({ state: "bookable", total: { amountMinor: 25_000n, currency: "USD" } });
    expect(result.options.find(({ sellableUnit }) => sellableUnit.name === "Room 203"))
      .toMatchObject({ state: "conflict", total: null, perNight: [] });
    expect(requested).toHaveLength(6);
    expect(new Set(requested)).toEqual(new Set(inventory.map(({ sellableUnitId }) => sellableUnitId)));
    expect(result.options).toHaveLength(expectedPhysicalQuotes.length);
    for (const expected of expectedPhysicalQuotes) {
      const offer = result.options.find(({ sellableUnit }) => sellableUnit.id === expected.id);
      expect(offer).toBeDefined();
      expect(offer).toMatchObject({
        sellableUnit: { id: expected.id, name: `Room ${expected.room}` },
        state: expected.state,
        optionRef: `offer:${expected.hash}`,
        release: { id: expected.release, version: 1, contentHash: "a".repeat(64) },
        evidence: {
          quoteHash: expected.hash,
          availabilityRef: `availability:${expected.id}`,
        },
        total: expected.amount === null ? null : { amountMinor: expected.amount, currency: "USD", kind: "pre_tax" },
      });
    }
  });

  test("rejects a physical-pair count above the configured cap before resolving any quote", async () => {
    let calls = 0;
    const service = new ReservationOfferSearchService(
      { async listRatePlans() { return [plan]; } } as never,
      { async resolve() { calls += 1; return quoteFor({ sellableUnitId: inventory[0]!.sellableUnitId } as ResolveRateQuoteInput, "quoted"); } } as never,
      { async search() { return inventory; } } as Pick<AvailabilityService, "search">,
      { maxCandidatePairs: 5 },
    );
    await expect(service.search({} as never, searchInput)).rejects.toBeInstanceOf(ReservationOfferSearchTooBroadError);
    expect(calls).toBe(0);
  });
});
