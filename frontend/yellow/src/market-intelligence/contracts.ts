/** Transport-free contracts for the Yellow Devices market laboratory. */

export type TenantId = string & { readonly __tenantId: unique symbol };
export type PropertyId = string & { readonly __propertyId: unique symbol };
export type SourceId = string & { readonly __sourceId: unique symbol };
export type BusinessDate = string & { readonly __businessDate: unique symbol };
export type CurrencyCode = string;

/** Money is never represented with a floating-point value. */
export interface Money {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
}

export type ObservationMode = "deterministic" | "ai-drift" | "manual";

export interface PropertyShellSnapshot {
  readonly tenantId: TenantId | string;
  readonly propertyId: PropertyId | string;
  readonly propertyName: string;
  readonly timezone: string;
  readonly currency: CurrencyCode;
  readonly roomTypeCodes: readonly string[];
  readonly ratePlanCodes: readonly string[];
  readonly channelCodes: readonly string[];
  readonly shellVersion: string;
  readonly asOf: BusinessDate | string;
}

export interface Occupancy {
  readonly adults: number;
  readonly children: number;
  readonly rooms: number;
}

export interface ObservationRequest {
  readonly tenantId: TenantId | string;
  readonly propertyId: PropertyId | string;
  readonly shell: PropertyShellSnapshot;
  readonly arrival: BusinessDate | string;
  readonly departure: BusinessDate | string;
  readonly occupancy: Occupancy;
  readonly currency: CurrencyCode;
  readonly roomTypeCodes: readonly string[];
  readonly ratePlanCodes: readonly string[];
  readonly channelCodes: readonly string[];
  readonly sourceIds: readonly (SourceId | string)[];
  readonly mode: ObservationMode;
}

/** Missing evidence is explicitly different from sold out. */
export type AvailabilitySignal =
  | { readonly kind: "available"; readonly quantity: number }
  | { readonly kind: "sold_out"; readonly reason: "explicit_source_signal" }
  | { readonly kind: "not_observed"; readonly reason: "absence" | "source_no_data" }
  | { readonly kind: "unavailable"; readonly reason: string };

export interface OfferObservation {
  readonly offerId: string;
  readonly sourceId: SourceId | string;
  readonly roomTypeCode: string;
  readonly ratePlanCode: string;
  readonly channelCode: string;
  readonly arrival: BusinessDate | string;
  readonly departure: BusinessDate | string;
  readonly total: Money;
  readonly availability: AvailabilitySignal;
  readonly observedAt: string;
  readonly synthetic: true;
}

export interface SourcePolicy {
  readonly id: string;
  readonly allowedHosts: readonly string[];
  readonly zeroCost: boolean;
  readonly maxConcurrency: number;
  readonly ttlMs: number;
}

export type Estimate =
  | { readonly kind: "zero_cost" }
  | { readonly kind: "estimated"; readonly amount: Money }
  | { readonly kind: "unknown"; readonly reason: string };

export type AdapterResult =
  | {
      readonly kind: "complete";
      readonly sourceId: SourceId | string;
      readonly observations: readonly OfferObservation[];
      readonly estimate: Estimate;
    }
  | {
      readonly kind: "partial";
      readonly sourceId: SourceId | string;
      readonly observations: readonly OfferObservation[];
      readonly unavailable: string;
      readonly estimate: Estimate;
    }
  | {
      readonly kind: "unavailable";
      readonly sourceId: SourceId | string;
      readonly observations: readonly [];
      readonly reason: "zero_cost_required" | "host_not_allowed" | "adapter_unavailable" | "aborted";
      readonly estimate: Estimate;
    };

export interface MarketObservationAdapter {
  readonly sourceId: SourceId | string;
  readonly host: string;
  /** Optional local estimate used for a preflight zero-cost hard stop. */
  readonly costEstimate?: Estimate;
  observe(request: ObservationRequest): Promise<AdapterResult>;
}

export type SchedulerResult =
  | {
      readonly kind: "complete";
      readonly cacheKey: string;
      readonly results: readonly AdapterResult[];
      readonly fromCache: boolean;
    }
  | {
      readonly kind: "partial";
      readonly cacheKey: string;
      readonly results: readonly AdapterResult[];
      readonly fromCache: boolean;
      readonly unavailableSources: readonly string[];
    }
  | {
      readonly kind: "unavailable";
      readonly cacheKey: string;
      readonly results: readonly AdapterResult[];
      readonly fromCache: false;
      readonly reason: "zero_cost_required" | "host_not_allowed" | "adapter_unavailable" | "aborted";
      readonly unavailableSources: readonly string[];
    };

export function freezeContract<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

export function notObserved(reason: "absence" | "source_no_data" = "absence"): AvailabilitySignal {
  return Object.freeze({ kind: "not_observed", reason });
}
