import {
  freezeContract,
  notObserved,
  type AdapterResult,
  type AvailabilitySignal,
  type MarketObservationAdapter,
  type ObservationRequest,
  type OfferObservation,
  type SourceId,
} from "./contracts";

export interface SyntheticAdapterOptions {
  readonly sourceId?: SourceId | string;
  readonly host?: string;
  readonly now?: () => string;
  /** Optional deterministic delay used by bounded-concurrency tests. */
  readonly delayMs?: number;
}

function stableHash(input: string): number {
  // FNV-1a is small, deterministic and available in every supported runtime.
  let hash = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function requestFingerprint(request: ObservationRequest, sourceId: string): string {
  return JSON.stringify({
    sourceId,
    property: request.propertyId,
    arrival: request.arrival,
    departure: request.departure,
    occupancy: request.occupancy,
    currency: request.currency,
    roomTypes: [...request.roomTypeCodes].sort(),
    ratePlans: [...request.ratePlanCodes].sort(),
    channels: [...request.channelCodes].sort(),
    mode: request.mode,
  });
}

function signalForQuantity(quantity: number): AvailabilitySignal {
  return quantity > 0
    ? freezeContract({ kind: "available", quantity })
    : notObserved("absence");
}

function syntheticOffer(
  request: ObservationRequest,
  sourceId: string,
  roomTypeCode: string,
  ratePlanCode: string,
  channelCode: string,
  seed: number,
  observedAt: string,
): OfferObservation {
  const quantity = 1 + (seed % 4);
  const amountMinor = BigInt(7_500 + (seed % 17_500));
  return freezeContract({
    offerId: `synthetic:${sourceId}:${roomTypeCode}:${ratePlanCode}:${channelCode}`,
    sourceId,
    roomTypeCode,
    ratePlanCode,
    channelCode,
    arrival: request.arrival,
    departure: request.departure,
    total: freezeContract({ amountMinor, currency: request.currency }),
    availability: signalForQuantity(quantity),
    observedAt,
    synthetic: true,
  });
}

/**
 * A deterministic in-memory adapter. It intentionally has no fetch, URL,
 * browser, credential or provider dependency.
 */
export class SyntheticMarketAdapter implements MarketObservationAdapter {
  public readonly sourceId: SourceId | string;
  public readonly host: string;
  private readonly now: () => string;
  private readonly delayMs: number;

  public constructor(options: SyntheticAdapterOptions = {}) {
    this.sourceId = options.sourceId ?? "synthetic-yellow";
    this.host = options.host ?? "synthetic.yellow.internal";
    this.now = options.now ?? (() => new Date(0).toISOString());
    this.delayMs = Math.max(0, Math.floor(options.delayMs ?? 0));
  }

  public async observe(request: ObservationRequest): Promise<AdapterResult> {
    if (this.delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
    }
    const sourceId = String(this.sourceId);
    const fingerprint = requestFingerprint(request, sourceId);
    const seed = stableHash(fingerprint);
    const observedAt = this.now();
    const roomTypes = [...request.roomTypeCodes].sort();
    const ratePlans = [...request.ratePlanCodes].sort();
    const channels = [...request.channelCodes].sort();

    // A zero seed bucket intentionally represents no evidence. It is still a
    // complete read and must never be translated into a sold-out signal.
    const hasData = seed % 5 !== 0;
    const observations: OfferObservation[] = [];
    if (hasData && roomTypes.length > 0 && ratePlans.length > 0 && channels.length > 0) {
      let offset = 0;
      for (const roomTypeCode of roomTypes) {
        for (const ratePlanCode of ratePlans) {
          for (const channelCode of channels) {
            observations.push(syntheticOffer(
              request,
              sourceId,
              roomTypeCode,
              ratePlanCode,
              channelCode,
              seed + offset,
              observedAt,
            ));
            offset += 1;
          }
        }
      }
    }
    return freezeContract({
      kind: "complete",
      sourceId: this.sourceId,
      observations: Object.freeze(observations),
      estimate: freezeContract({ kind: "zero_cost" }),
    }) as AdapterResult;
  }
}

export function syntheticAvailability(observations: readonly OfferObservation[]): AvailabilitySignal {
  if (observations.length === 0) return notObserved("absence");
  const quantity = observations.reduce((total, offer) =>
    offer.availability.kind === "available" ? total + offer.availability.quantity : total, 0);
  return signalForQuantity(quantity);
}

export function createSyntheticAdapter(options: SyntheticAdapterOptions = {}): SyntheticMarketAdapter {
  return new SyntheticMarketAdapter(options);
}
