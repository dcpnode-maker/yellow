import {
  AvailabilityProjectionService,
  AvailabilityService,
  type AvailabilityOccupancySignal,
  type AvailabilityOption,
} from "../inventory";
import type { Tx } from "../../kernel";
import {
  composeRateStayQuote,
  deriveRateStayCompositionContext,
  type RateAvailabilityEvidence,
  type RateMandatoryPolicyEvidence,
  type RatePolicyEvidence,
  type RateStayCompositionResult,
} from "./composition";
import {
  RatePublicationService,
  type RatePlanRelease,
  type RateReleaseNightEvaluation,
} from "./publication";
import type { RateTargetCommercial } from "./targeting";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CHANNEL = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const DAY_MS = 86_400_000;
const MAX_BIGINT = 9_223_372_036_854_775_807n;

type JsonObject = Record<string, unknown>;

export class RateQuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateQuoteError";
  }
}

export class RateQuoteNotFoundError extends RateQuoteError {
  constructor(message: string) {
    super(message);
    this.name = "RateQuoteNotFoundError";
  }
}

export class RateQuoteConflictError extends RateQuoteError {
  constructor(message: string) {
    super(message);
    this.name = "RateQuoteConflictError";
  }
}

export interface RateQuoteGuestMixInput {
  readonly adults: number;
  readonly childAges: readonly number[];
}

export interface ResolveRateQuoteInput {
  readonly propertyNode: string;
  readonly ratePlanId: string;
  readonly sellableUnitId: string;
  readonly stayStart: Date;
  readonly stayEnd: Date;
  readonly guests: RateQuoteGuestMixInput;
  readonly selectedPromotionCodes: readonly string[];
  readonly commercial: RateTargetCommercial;
  readonly channelCode: string;
}

export interface RateQuote {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly ratePlanId: string;
  readonly releaseId: string;
  readonly releaseVersion: number;
  readonly releaseContentHash: string;
  readonly modelDraftId: string;
  readonly modelDraftVersion: number;
  readonly targetDraftId: string;
  readonly targetDraftVersion: number;
  readonly sellableUnitId: string;
  readonly unitTypeId: string;
  readonly bookingInstant: string;
  readonly propertyTimeZone: string;
  readonly stayStartDate: string;
  readonly stayEndDate: string;
  readonly availabilityOption: AvailabilityOption;
  readonly occupancyEvidence: readonly RateQuoteNightOccupancyEvidence[];
  readonly taxAssignmentState: "configured" | "partial" | "none";
  readonly taxAssignments: readonly RateQuoteTaxAssignmentEvidence[];
  readonly result: RateStayCompositionResult;
  readonly quoteHash: string;
}

export interface RateQuoteNightOccupancyEvidence {
  readonly nightDate: string;
  readonly signal: AvailabilityOccupancySignal | null;
}

export interface RateQuoteTaxAssignmentEvidence {
  readonly nightDate: string;
  readonly jurisdictionKey: string | null;
  readonly evidenceRef: string | null;
}

interface PropertyClockRow {
  readonly tenant_id: string | null;
  readonly timezone: string;
  readonly booking_instant: Date;
}

interface PolicyRow {
  readonly id: string;
  readonly kind: "cancellation" | "deposit" | "guarantee" | "no_show";
}

interface ChannelMapRow {
  readonly kind: "unit_type" | "rate_plan";
  readonly internal_id: string;
  readonly external_code: string;
}

interface TaxAssignmentRow {
  readonly jurisdiction_key: string;
  readonly from_date: string | null;
  readonly to_date: string | null;
}

interface MandatoryEvidenceResult {
  readonly composition: readonly RateMandatoryPolicyEvidence[];
  readonly taxAssignments: readonly RateQuoteTaxAssignmentEvidence[];
  readonly state: "configured" | "partial" | "none";
}

interface NormalizedQuoteInput extends Omit<ResolveRateQuoteInput, "stayStart" | "stayEnd"> {
  readonly stayStart: Date;
  readonly stayEnd: Date;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, subject: string): JsonObject {
  if (!isObject(value)) throw new RateQuoteError(`${subject} must be an object`);
  return value;
}

function requireOnlyKeys(value: JsonObject, allowed: readonly string[], subject: string): void {
  const names = new Set(allowed);
  if (Object.keys(value).some((key) => !names.has(key))) {
    throw new RateQuoteError(`${subject} contains unsupported fields`);
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new RateQuoteError(`${name} must be a UUID`);
  return value;
}

function requireDateObject(name: string, value: unknown): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new RateQuoteError(`${name} must be a finite Date`);
  }
  return new Date(value.getTime());
}

function requireInteger(name: string, value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RateQuoteError(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value as number;
}

function normalizeInput(value: unknown): NormalizedQuoteInput {
  const source = requireObject(value, "rate quote input");
  const fields = [
    "propertyNode", "ratePlanId", "sellableUnitId", "stayStart", "stayEnd", "guests",
    "selectedPromotionCodes", "commercial", "channelCode",
  ];
  requireOnlyKeys(source, fields, "rate quote input");
  for (const field of fields) {
    if (!Object.hasOwn(source, field)) throw new RateQuoteError(`rate quote input requires ${field}`);
  }
  const stayStart = requireDateObject("stayStart", source.stayStart);
  const stayEnd = requireDateObject("stayEnd", source.stayEnd);
  if (stayStart >= stayEnd) throw new RateQuoteError("stay instants must be half-open and increasing");
  const guests = requireObject(source.guests, "guests");
  requireOnlyKeys(guests, ["adults", "childAges"], "guests");
  if (!Array.isArray(guests.childAges) || guests.childAges.length > 30) {
    throw new RateQuoteError("guests.childAges must contain at most 30 ages");
  }
  const childAges = guests.childAges.map((age, index) => requireInteger(`guests.childAges ${index}`, age, 0, 17));
  if (!Array.isArray(source.selectedPromotionCodes) || source.selectedPromotionCodes.length > 50 ||
      source.selectedPromotionCodes.some((code) => typeof code !== "string")) {
    throw new RateQuoteError("selectedPromotionCodes must contain at most 50 strings");
  }
  if (typeof source.channelCode !== "string" || !CHANNEL.test(source.channelCode)) {
    throw new RateQuoteError("channelCode must be a canonical lowercase code");
  }
  const commercial = requireObject(source.commercial, "commercial") as RateTargetCommercial;
  if (commercial.channelCode !== undefined && commercial.channelCode !== source.channelCode) {
    throw new RateQuoteError("commercial channelCode must match the quote channelCode");
  }
  return Object.freeze({
    propertyNode: requireUuid("propertyNode", source.propertyNode),
    ratePlanId: requireUuid("ratePlanId", source.ratePlanId),
    sellableUnitId: requireUuid("sellableUnitId", source.sellableUnitId),
    stayStart,
    stayEnd,
    guests: Object.freeze({
      adults: requireInteger("guests.adults", guests.adults, 1, 99),
      childAges: Object.freeze(childAges),
    }),
    selectedPromotionCodes: Object.freeze([...(source.selectedPromotionCodes as string[])]),
    commercial: Object.freeze({ ...commercial }),
    channelCode: source.channelCode,
  });
}

function localDate(instant: Date, timeZone: string): string {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    throw new RateQuoteError("Property timezone is not a supported IANA timezone");
  }
  const parts = new Map(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
  const year = parts.get("year");
  const month = parts.get("month");
  const day = parts.get("day");
  if (!year || !month || !day) throw new RateQuoteError("Property timezone did not produce a local date");
  return `${year}-${month}-${day}`;
}

function localNights(start: string, end: string): readonly string[] {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  const count = (endMs - startMs) / DAY_MS;
  if (!Number.isInteger(count) || count < 1 || count > 730) {
    throw new RateQuoteError("stay must contain 1 to 730 property-local nights");
  }
  return Object.freeze(Array.from({ length: count }, (_, index) =>
    new Date(startMs + index * DAY_MS).toISOString().slice(0, 10)
  ));
}

function exactJson(value: unknown): unknown {
  if (typeof value === "bigint") {
    if (value < -MAX_BIGINT - 1n || value > MAX_BIGINT) throw new RateQuoteError("quote bigint overflow");
    return { $minor: value.toString() };
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new RateQuoteError("quote evidence contains unsafe number");
    return value;
  }
  if (Array.isArray(value)) return value.map(exactJson);
  if (!isObject(value)) throw new RateQuoteError("quote evidence is not canonical data");
  const result: JsonObject = {};
  for (const key of Object.keys(value).sort()) result[key] = exactJson(value[key]);
  return result;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new RateQuoteError("quote evidence cannot be serialized");
  return encoded;
}

function hash(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(stableJson(exactJson(value))).digest("hex");
}

function availabilityEvidence(
  option: AvailabilityOption,
  input: NormalizedQuoteInput,
): RateAvailabilityEvidence {
  const restrictionEvidence = option.restrictionsApplied.map((restriction) => Object.freeze({
    key: `restriction-${restriction.id}`,
    kind: restriction.kind === "min_los" ? "min_stay" as const
      : restriction.kind === "max_los" ? "max_stay" as const
      : restriction.kind === "min_adv" ? "min_advance" as const
      : restriction.kind === "max_adv" ? "max_advance" as const
      : restriction.kind,
    blocked: restriction.blocks,
    evidenceRef: `restriction:${restriction.id}`,
  }));
  const operationalBlockEvidence = option.operationalBlocksApplied.map((block) => Object.freeze({
    key: `operational-${block.id}`,
    kind: block.kind === "ooo" ? "out_of_order" as const : "out_of_service" as const,
    blocked: block.blocks,
    evidenceRef: `operational-block:${block.id}`,
  }));
  return Object.freeze({
    sellableUnitId: option.sellableUnitId,
    availableCount: option.availableCount,
    bookable: option.bookable,
    restrictionEvidence: Object.freeze(restrictionEvidence),
    operationalBlockEvidence: Object.freeze(operationalBlockEvidence),
    evidenceRef: `availability:${hash({
      propertyNode: input.propertyNode,
      sellableUnitId: option.sellableUnitId,
      stayStart: input.stayStart.toISOString(),
      stayEnd: input.stayEnd.toISOString(),
      availableCount: option.availableCount,
      bookable: option.bookable,
      restrictionEvidence,
      operationalBlockEvidence,
    })}`,
  });
}

function usesOccupancy(release: RatePlanRelease): boolean {
  return release.evaluatorSpec.gate.occupancy !== undefined ||
    release.evaluatorSpec.rules.some(({ when }) => when.occupancy !== undefined);
}

export class RateQuoteService {
  readonly #publication: Pick<RatePublicationService, "getActiveRelease" | "evaluateReleaseNight">;
  readonly #availability: Pick<AvailabilityService, "search">;
  readonly #projection: Pick<AvailabilityProjectionService, "occupancySignal">;

  constructor(
    publication: Pick<RatePublicationService, "getActiveRelease" | "evaluateReleaseNight">,
    availability: Pick<AvailabilityService, "search"> = new AvailabilityService(),
    projection: Pick<AvailabilityProjectionService, "occupancySignal"> = new AvailabilityProjectionService(),
  ) {
    this.#publication = publication;
    this.#availability = availability;
    this.#projection = projection;
  }

  async resolve(tx: Tx, value: ResolveRateQuoteInput): Promise<RateQuote> {
    const input = normalizeInput(value);
    const clocks = await tx<PropertyClockRow[]>`
      SELECT nullif(current_setting('app.tenant_id', true), '')::uuid AS tenant_id,
             timezone, transaction_timestamp() AS booking_instant
      FROM org_node
      WHERE id = ${input.propertyNode}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND kind = 'property'
    `;
    const clock = clocks[0];
    if (!clock?.tenant_id) throw new RateQuoteNotFoundError("Property was not found in the active tenant");
    if (!(clock.booking_instant instanceof Date) || !Number.isFinite(clock.booking_instant.getTime())) {
      throw new RateQuoteError("PostgreSQL did not return a valid transaction timestamp");
    }
    const bookingInstant = clock.booking_instant.toISOString();
    const stayStartDate = localDate(input.stayStart, clock.timezone);
    const stayEndDate = localDate(input.stayEnd, clock.timezone);
    const nights = localNights(stayStartDate, stayEndDate);
    const release = await this.#publication.getActiveRelease(tx, input.propertyNode, input.ratePlanId);
    const options = await this.#availability.search(tx, {
      propertyNode: input.propertyNode,
      from: input.stayStart,
      to: input.stayEnd,
      partySize: input.guests.adults + input.guests.childAges.length,
      ratePlanId: input.ratePlanId,
      channelCode: input.channelCode,
      sellableUnitId: input.sellableUnitId,
    });
    const matches = options.filter(({ sellableUnitId }) => sellableUnitId === input.sellableUnitId);
    if (matches.length !== 1) {
      throw new RateQuoteNotFoundError("Exact sellable availability evidence was not found once");
    }
    const option = matches[0]!;
    const availability = availabilityEvidence(option, input);
    const policyEvidence = await this.#policyEvidence(tx, release);
    const mandatory = await this.#mandatoryEvidence(tx, input.propertyNode, nights);
    const channelMappingEvidenceRef = await this.#channelMapping(
      tx,
      input,
      option.unitTypeId,
    );
    const rateEvaluations: RateReleaseNightEvaluation[] = [];
    const occupancyEvidence: RateQuoteNightOccupancyEvidence[] = [];
    for (const nightDate of nights) {
      const occupancy = await this.#projection.occupancySignal(
        tx,
        input.propertyNode,
        option.unitTypeId,
        nightDate,
      );
      if (usesOccupancy(release) && occupancy === null) {
        throw new RateQuoteConflictError(`Projected occupancy evidence is missing for ${nightDate}`);
      }
      occupancyEvidence.push(Object.freeze({ nightDate, signal: occupancy }));
      rateEvaluations.push(await this.#publication.evaluateReleaseNight(tx, release.id, {
        propertyTimeZone: clock.timezone,
        bookingInstant,
        stayStartInstant: input.stayStart.toISOString(),
        stayEndInstant: input.stayEnd.toISOString(),
        nightDate,
        ...(occupancy === null ? {} : {
          occupancyBasisPoints: occupancy.basisPoints,
          occupancyEvidenceRef: occupancy.evidenceRef,
        }),
        targetContext: {
          unitTypeId: option.unitTypeId,
          sellableUnitId: option.sellableUnitId,
          commercial: input.commercial,
        },
      }));
    }
    const context = deriveRateStayCompositionContext({
      rateEvaluatorSpec: release.evaluatorSpec,
      rateEvaluations: rateEvaluations.map(({ evaluationContext, result }) => ({
        nightDate: evaluationContext.nightDate,
        evaluationContext,
        evaluationResult: result,
      })),
      guests: input.guests,
      selectedPromotionCodes: input.selectedPromotionCodes,
      policyEvidence,
      mandatoryPolicyEvidence: mandatory.composition,
      availabilityEvidence: availability,
      channelCode: input.channelCode,
      channelMappingEvidenceRef,
    });
    const result = composeRateStayQuote(release.compositionSpec, context);
    const withoutHash = Object.freeze({
      tenantId: clock.tenant_id,
      propertyNode: input.propertyNode,
      ratePlanId: input.ratePlanId,
      releaseId: release.id,
      releaseVersion: release.extensionVersion,
      releaseContentHash: release.contentHash,
      modelDraftId: release.modelDraftId,
      modelDraftVersion: release.modelDraftVersion,
      targetDraftId: release.targetDraftId,
      targetDraftVersion: release.targetDraftVersion,
      sellableUnitId: option.sellableUnitId,
      unitTypeId: option.unitTypeId,
      bookingInstant,
      propertyTimeZone: clock.timezone,
      stayStartDate,
      stayEndDate,
      availabilityOption: option,
      occupancyEvidence: Object.freeze(occupancyEvidence),
      taxAssignmentState: mandatory.state,
      taxAssignments: mandatory.taxAssignments,
      result,
    });
    return Object.freeze({ ...withoutHash, quoteHash: hash(withoutHash) });
  }

  async #policyEvidence(tx: Tx, release: RatePlanRelease): Promise<readonly RatePolicyEvidence[]> {
    const configured = [
      ["cancellation", release.compositionSpec.policy.cancellationPolicyId],
      ["deposit", release.compositionSpec.policy.depositPolicyId],
      ["guarantee", release.compositionSpec.policy.guaranteePolicyId],
      ["no_show", release.compositionSpec.policy.noShowPolicyId],
    ] as const;
    const evidence: RatePolicyEvidence[] = [];
    for (const [kind, id] of configured) {
      if (id === null) continue;
      const rows = await tx<PolicyRow[]>`
        SELECT id, kind
        FROM policy
        WHERE id = ${id}::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND kind = ${kind}
      `;
      const row = rows[0];
      if (!row) throw new RateQuoteConflictError(`${kind} policy evidence is no longer available`);
      evidence.push(Object.freeze({ kind: row.kind, policyId: row.id, evidenceRef: `policy:${row.id}` }));
    }
    return Object.freeze(evidence.sort((left, right) => left.kind.localeCompare(right.kind)));
  }

  async #channelMapping(
    tx: Tx,
    input: NormalizedQuoteInput,
    unitTypeId: string,
  ): Promise<string | null> {
    if (input.channelCode === "direct") return null;
    const rows = await tx<ChannelMapRow[]>`
      SELECT kind, internal_id, external_code
      FROM channel_map
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = ${input.propertyNode}::uuid
        AND channel_code = ${input.channelCode}
        AND (
          (kind = 'rate_plan' AND internal_id = ${input.ratePlanId}::uuid)
          OR (kind = 'unit_type' AND internal_id = ${unitTypeId}::uuid)
        )
      ORDER BY kind, internal_id
    `;
    if (rows.length !== 2 || new Set(rows.map(({ kind }) => kind)).size !== 2) {
      throw new RateQuoteConflictError("Non-direct quote requires exact rate-plan and unit-type channel mappings");
    }
    return `channel-map:${hash(rows)}`;
  }

  async #mandatoryEvidence(
    tx: Tx,
    propertyNode: string,
    nights: readonly string[],
  ): Promise<MandatoryEvidenceResult> {
    const rows = await tx<TaxAssignmentRow[]>`
      SELECT jurisdiction_key,
             lower(effective)::text AS from_date,
             upper(effective)::text AS to_date
      FROM tax_assignment
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = ${propertyNode}::uuid
        AND effective && daterange(${nights[0]}::date, ${new Date(Date.parse(`${nights.at(-1)}T00:00:00.000Z`) + DAY_MS).toISOString().slice(0, 10)}::date, '[)')
      ORDER BY lower(effective), upper(effective), jurisdiction_key
    `;
    const taxAssignments = nights.map((nightDate) => {
      const matches = rows.filter(({ from_date, to_date }) =>
        (from_date === null || nightDate >= from_date) && (to_date === null || nightDate < to_date)
      );
      if (matches.length > 1) {
        throw new RateQuoteConflictError(`Multiple tax assignments apply to ${nightDate}`);
      }
      const match = matches[0];
      return Object.freeze({
        nightDate,
        jurisdictionKey: match?.jurisdiction_key ?? null,
        evidenceRef: match === undefined ? null : `tax-assignment:${hash({ nightDate, ...match })}`,
      });
    });
    const configured = taxAssignments.filter(({ jurisdictionKey }) => jurisdictionKey !== null);
    const composition = configured.map(({ nightDate, evidenceRef }) => Object.freeze({
      key: `tax-assignment-${nightDate}`,
      evidenceRef: evidenceRef!,
    }));
    return Object.freeze({
      composition: Object.freeze(composition),
      taxAssignments: Object.freeze(taxAssignments),
      state: configured.length === 0 ? "none" : configured.length === nights.length ? "configured" : "partial",
    });
  }
}
