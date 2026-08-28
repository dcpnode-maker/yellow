import { INDEPENDENTLY_REVIEWED_THROUGH_ORDER } from "./generated/review-coverage";

export type PhaseBuildState = "reviewed" | "built_unverified" | "active" | "planned";

export interface ProjectPhaseSnapshot {
  readonly number: number;
  readonly name: string;
  readonly state: PhaseBuildState;
}

export type ProjectRecordedWorkState = "independently_approved" | "proof_in_progress";

export interface ProjectRecordedWorkSnapshot {
  readonly order:
    | 126 | 127 | 148 | 154 | 155 | 156 | 160 | 161 | 162 | 163 | 164
    | 165 | 166 | 168 | 169 | 170 | 171 | 173 | 174 | 175 | 176 | 177 | 178
    | 179 | 180 | 181 | 182 | 183 | 184 | 185 | 186 | 188 | 189;
  readonly state: ProjectRecordedWorkState;
  readonly summary: string;
  readonly remaining?: string;
}

export interface OperatorRuntimeStatus {
  readonly workbenchEnabled: boolean;
  readonly holdExpiryWorkerEnabled: boolean;
  readonly availabilityProjectionWorkerEnabled: boolean;
  readonly pickupTaskWorkerEnabled: boolean;
  readonly reservationArrivalRollWorkerEnabled: boolean;
  readonly processStartedAt: string;
}

export const DEFAULT_OPERATOR_RUNTIME_STATUS: OperatorRuntimeStatus = Object.freeze({
  workbenchEnabled: false,
  holdExpiryWorkerEnabled: false,
  availabilityProjectionWorkerEnabled: false,
  pickupTaskWorkerEnabled: false,
  reservationArrivalRollWorkerEnabled: false,
  processStartedAt: new Date(0).toISOString(),
});

export const PROJECT_BUILD_SNAPSHOT = Object.freeze({
  schemaVersion: 1,
  recordedAt: "2026-08-27",
  label: "Recorded build snapshot",
  roadmap: Object.freeze({
    phaseCount: 13,
    latestBuiltOrder: 189,
    currentOrder: 190,
    activePhase: 5,
  }),
  review: Object.freeze({
    independentlyReviewedThroughOrder: INDEPENDENTLY_REVIEWED_THROUGH_ORDER,
    gate3Debt: 0,
    state: INDEPENDENTLY_REVIEWED_THROUGH_ORDER >= 107 ? "reviewed" as const : "built_unverified" as const,
  }),
  referee: Object.freeze({ requiredPasses: 11, requiredFailures: 0 }),
  recordedWork: Object.freeze([
    Object.freeze({
      order: 126,
      state: "independently_approved" as const,
      summary: "Order 126 independently approved (D-391).",
    }),
    Object.freeze({
      order: 127,
      state: "independently_approved" as const,
      summary: "Order 127 independently approved (D-407).",
    }),
    Object.freeze({
      order: 148,
      state: "independently_approved" as const,
      summary: "Order 148 independently approved (D-412).",
      remaining: "PR #78 is open and unmerged; no deployment is claimed.",
    }),
    Object.freeze({
      order: 154,
      state: "independently_approved" as const,
      summary: "Order 154 reviewed runtime-DML union independently approved.",
      remaining: "The reviewed union is unmerged; no deployment is claimed.",
    }),
    Object.freeze({
      order: 155,
      state: "independently_approved" as const,
      summary: "Order 155 resolved-question normalization independently checked.",
      remaining: "The governance-only order is unmerged.",
    }),
    Object.freeze({
      order: 156,
      state: "independently_approved" as const,
      summary: "Order 156 dedicated extension registrar independently approved.",
      remaining: "This capability does not imply Phase-wide completion or production deployment.",
    }),
    Object.freeze({
      order: 160,
      state: "independently_approved" as const,
      summary: "Order 160 local-review booking authority independently approved.",
      remaining: "Approval is limited to the governed local Party-to-reservation journey.",
    }),
    Object.freeze({
      order: 161,
      state: "independently_approved" as const,
      summary: "Order 161 local booking promotion independently approved.",
      remaining: "Runtime promotion evidence is recorded separately; no production deployment is claimed.",
    }),
    Object.freeze({
      order: 162,
      state: "independently_approved" as const,
      summary: "Order 162 rate-publication cursor correction independently approved.",
      remaining: "Approval is limited to the immutable cursor-binding correction.",
    }),
    Object.freeze({
      order: 163,
      state: "independently_approved" as const,
      summary: "Order 163 persistent local founder login handoff independently approved.",
      remaining: "The protected credential handoff and runtime identity are evidenced outside this snapshot.",
    }),
    Object.freeze({
      order: 164,
      state: "independently_approved" as const,
      summary: "Order 164 approved the clean product and local operational lineage prerequisite.",
      remaining: "Approval did not complete reservation UX, deploy, or advance Phase 5.",
    }),
    Object.freeze({
      order: 165,
      state: "independently_approved" as const,
      summary: "Order 165 independently approved editable near-future stay defaults and the exact booking-window 400 response.",
      remaining: "Approval did not include the reservation board, read model, drawer, or broader UI completion.",
    }),
    Object.freeze({
      order: 166,
      state: "independently_approved" as const,
      summary: "Order 166 independently approved the bounded reservation board and UUID detail read surface.",
      remaining: "Approval did not include a new UI, reservation writes, schema changes, or Phase-wide completion.",
    }),
    Object.freeze({
      order: 168,
      state: "independently_approved" as const,
      summary: "Order 168 independently approved the dependency-free reservation workspace UI.",
      remaining: "Approval did not itself promote a local stack or claim broader Phase 5 completion.",
    }),
    Object.freeze({
      order: 169,
      state: "independently_approved" as const,
      summary: "Order 169 independently approved the bounded loopback app-only promotion.",
      remaining: "Approval did not authorize public exposure, production deployment, or rollback destruction.",
    }),
    Object.freeze({
      order: 170,
      state: "independently_approved" as const,
      summary: "Order 170 independently approved the extension registrar composition onto the reservation lineage.",
      remaining: "Approval did not close other command-capability debt or authorize extension publication transitions.",
    }),
    Object.freeze({
      order: 171,
      state: "independently_approved" as const,
      summary: "Order 171 independently approved the explicit reservation-to-primary-folio-to-governed-untaxed-charge journey.",
      remaining: "Approval did not include payments, tax, fiscal documents, settlement, transfers, or checkout.",
    }),
    Object.freeze({
      order: 173,
      state: "independently_approved" as const,
      summary: "Order 173 independently approved exact byte-identical primary-folio replay semantics.",
      remaining: "Approval was limited to the corrected HTTP representation and existing replay header.",
    }),
    Object.freeze({
      order: 174,
      state: "independently_approved" as const,
      summary: "Order 174 independently approved the singular UUID folio workspace shell route.",
      remaining: "The shell adds no data or business authority.",
    }),
    Object.freeze({
      order: 175,
      state: "independently_approved" as const,
      summary: "Order 175 independently approved responsive folio containment with the semantic table preserved.",
      remaining: "Approval did not change folio data, finance authority, or runtime behavior.",
    }),
    Object.freeze({
      order: 176,
      state: "independently_approved" as const,
      summary: "Order 176 independently approved the adaptive detail levels and original visual themes.",
      remaining: "Presentation changes do not alter permissions, request semantics, or business authority.",
    }),
    Object.freeze({
      order: 177,
      state: "independently_approved" as const,
      summary: "Order 177 independently approved the bounded read-only Today command centre and focus correction.",
      remaining: "Approval did not add operational mutations or Phase-wide completion authority.",
    }),
    Object.freeze({
      order: 178,
      state: "independently_approved" as const,
      summary: "Order 178 independently approved deterministic offline India and Canada UAT inputs.",
      remaining: "These offline scenario foundations have not been imported into the application and carry no legal or fiscal authority.",
    }),
    Object.freeze({
      order: 179,
      state: "independently_approved" as const,
      summary: "Order 179 independently approved the authenticated founder-visible recorded-status snapshot.",
      remaining: "Approval was limited to recorded-status truth and did not promote a local runtime.",
    }),
    Object.freeze({
      order: 180,
      state: "independently_approved" as const,
      summary: "Order 180 independently approved the sole founder-local application on loopback port 3000.",
      remaining: "Approval was local-only; no public or production deployment is claimed.",
    }),
    Object.freeze({
      order: 181,
      state: "independently_approved" as const,
      summary: "Order 181 independently approved deterministic two-hotel offline scenario seed authority.",
      remaining: "Approval covered seed code only and did not import scenarios into the active local database.",
    }),
    Object.freeze({
      order: 182,
      state: "independently_approved" as const,
      summary: "Order 182 independently approved the bounded two-hotel scenario import into the sole founder-local database.",
      remaining: "The import preserved the existing founder journey; no product, schema, credential, or production change is claimed.",
    }),
    Object.freeze({
      order: 183,
      state: "independently_approved" as const,
      summary: "Order 183 independently approved governed immutable folio charge correction.",
      remaining: "Approval did not itself promote the correction to the founder-local runtime.",
    }),
    Object.freeze({
      order: 184,
      state: "independently_approved" as const,
      summary: "Order 184 independently approved the material theme-skin product and its guarded local presentation.",
      remaining: "Its sixteen-skin catalogue was later superseded by Order 185; no broader product authority is claimed.",
    }),
    Object.freeze({
      order: 185,
      state: "independently_approved" as const,
      summary: "Order 185 independently approved the founder-curated Apple, Android, Win95 and Glass product catalogue.",
      remaining: "Approval changed presentation only and did not promote a local runtime.",
    }),
    Object.freeze({
      order: 186,
      state: "independently_approved" as const,
      summary: "Order 186 independently approved the correction-capable product on the sole founder-local application.",
      remaining: "Founder CRUD drift was preserved; no local business day was sealed and no production deployment is claimed.",
    }),
    Object.freeze({
      order: 188,
      state: "independently_approved" as const,
      summary: "Order 188 independently approved multi-window folio routing and the five-appearance product.",
      remaining: "Approval did not itself replace the founder-local application or claim Phase-wide completion.",
    }),
    Object.freeze({
      order: 189,
      state: "independently_approved" as const,
      summary: "Order 189 independently approved the exact Order 188 product on the sole founder-local application.",
      remaining: "Founder CRUD drift and persistent data were preserved; no public or production deployment is claimed.",
    }),
  ] satisfies readonly ProjectRecordedWorkSnapshot[]),
  phases: Object.freeze([
    Object.freeze({ number: 0, name: "Bootstrap", state: "reviewed" as const }),
    Object.freeze({ number: 1, name: "Kernel", state: INDEPENDENTLY_REVIEWED_THROUGH_ORDER >= 26 ? "reviewed" as const : "built_unverified" as const }),
    Object.freeze({ number: 2, name: "Inventory & occupancy", state: INDEPENDENTLY_REVIEWED_THROUGH_ORDER >= 44 ? "reviewed" as const : "built_unverified" as const }),
    Object.freeze({ number: 3, name: "Rates & policies", state: INDEPENDENTLY_REVIEWED_THROUGH_ORDER >= 79 ? "reviewed" as const : "built_unverified" as const }),
    Object.freeze({ number: 4, name: "Reservations", state: "built_unverified" as const }),
    Object.freeze({ number: 5, name: "Financials", state: "active" as const }),
    Object.freeze({ number: 6, name: "Stay operations & housekeeping", state: "planned" as const }),
    Object.freeze({ number: 7, name: "Tax & India IRP", state: "planned" as const }),
    Object.freeze({ number: 8, name: "Statutory reporting & ZATCA", state: "planned" as const }),
    Object.freeze({ number: 9, name: "Distribution", state: "planned" as const }),
    Object.freeze({ number: 10, name: "Progressive web app", state: "planned" as const }),
    Object.freeze({ number: 11, name: "Groups & blocks", state: "planned" as const }),
    Object.freeze({ number: 12, name: "UAE ASP, accounts receivable & migration", state: "planned" as const }),
  ] satisfies readonly ProjectPhaseSnapshot[]),
});
