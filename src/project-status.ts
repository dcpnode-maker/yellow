export type PhaseBuildState = "reviewed" | "built_unverified" | "active" | "planned";

export interface ProjectPhaseSnapshot {
  readonly number: number;
  readonly name: string;
  readonly state: PhaseBuildState;
}

export interface OperatorRuntimeStatus {
  readonly workbenchEnabled: boolean;
  readonly holdExpiryWorkerEnabled: boolean;
  readonly availabilityProjectionWorkerEnabled: boolean;
  readonly processStartedAt: string;
}

export const DEFAULT_OPERATOR_RUNTIME_STATUS: OperatorRuntimeStatus = Object.freeze({
  workbenchEnabled: false,
  holdExpiryWorkerEnabled: false,
  availabilityProjectionWorkerEnabled: false,
  processStartedAt: new Date(0).toISOString(),
});

export const PROJECT_BUILD_SNAPSHOT = Object.freeze({
  schemaVersion: 1,
  recordedAt: "2026-08-22",
  label: "Recorded build snapshot",
  roadmap: Object.freeze({
    phaseCount: 13,
    latestBuiltOrder: 67,
    currentOrder: 67,
    activePhase: 3,
  }),
  review: Object.freeze({
    independentlyReviewedThroughOrder: 18,
    gate3Debt: 23,
    state: "UNVERIFIED" as const,
  }),
  referee: Object.freeze({ requiredPasses: 11, requiredFailures: 0 }),
  phases: Object.freeze([
    Object.freeze({ number: 0, name: "Bootstrap", state: "reviewed" as const }),
    Object.freeze({ number: 1, name: "Kernel", state: "built_unverified" as const }),
    Object.freeze({ number: 2, name: "Inventory & occupancy", state: "built_unverified" as const }),
    Object.freeze({ number: 3, name: "Rates & policies", state: "active" as const }),
    Object.freeze({ number: 4, name: "Reservations", state: "planned" as const }),
    Object.freeze({ number: 5, name: "Financials", state: "planned" as const }),
    Object.freeze({ number: 6, name: "Stay operations & housekeeping", state: "planned" as const }),
    Object.freeze({ number: 7, name: "Tax & India IRP", state: "planned" as const }),
    Object.freeze({ number: 8, name: "Statutory reporting & ZATCA", state: "planned" as const }),
    Object.freeze({ number: 9, name: "Distribution", state: "planned" as const }),
    Object.freeze({ number: 10, name: "Progressive web app", state: "planned" as const }),
    Object.freeze({ number: 11, name: "Groups & blocks", state: "planned" as const }),
    Object.freeze({ number: 12, name: "UAE ASP, accounts receivable & migration", state: "planned" as const }),
  ] satisfies readonly ProjectPhaseSnapshot[]),
});
