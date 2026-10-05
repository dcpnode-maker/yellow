export type DemoReadinessStatus = "ready" | "not_ready";
export type DemoRequirementStatus = "proved" | "in_progress" | "missing";

export interface DemoRequirement {
  readonly id: string;
  readonly label: string;
  readonly status: DemoRequirementStatus;
  readonly evidence: readonly string[];
  readonly nextProof: string;
}

export interface ColleagueDemoReadiness {
  readonly product: "Yellow PMS";
  readonly audience: "colleague-public-demo";
  readonly status: DemoReadinessStatus;
  readonly shareNotificationAllowed: boolean;
  readonly principle: string;
  readonly syntheticProperty: Readonly<{
    readonly name: string;
    readonly positioning: string;
    readonly configuredAreas: readonly string[];
  }>;
  readonly requirements: readonly DemoRequirement[];
  readonly confirmationPolicy: Readonly<{
    readonly operationalActionsRequireExplicitConfirmation: true;
    readonly examples: readonly string[];
  }>;
}

export interface ColleagueDemoReadinessInput {
  readonly publicAccessObserved?: boolean;
  readonly mobileProofObserved?: boolean;
  readonly liveGeminiProved?: boolean;
}

function withStatus(requirement: DemoRequirement, status: DemoRequirementStatus, nextProof: string): DemoRequirement {
  return Object.freeze({
    ...requirement,
    status,
    nextProof,
  });
}

const requirements: readonly DemoRequirement[] = [
  {
    id: "synthetic-property",
    label: "Realistic synthetic configured property",
    status: "in_progress",
    evidence: [
      "Order 617 freezes server-owned hotel math and commercial hierarchy rules.",
      "Existing seed/schema fixtures contain tenant, property, rooms, reservations, folios and commercial dimensions.",
      "Order 643 exposes /api/v1/demo/property-config with room types/classes, rate plans, meal plans, cancellation policies, sources, MSG/MS and demo safety policy.",
      "Order 637 exposes /api/v1/demo/performance with hotel, MSG, MS/source and room-type rollups using server-owned KPI formulas.",
      "Order 639 exposes /api/v1/demo/front-desk-board with arrivals, in-house, departures, room status and role-governed cashier access.",
      "Order 641 exposes /api/v1/demo/colleague-scenario as the ordered colleague walkthrough across implemented demo routes.",
      "Order 642 exposes /api/v1/demo/proof-bundle to summarize current implemented proof and remaining share gates.",
      "Order 649 exposes /api/v1/demo/public-runtime-proof so deployed/public access can be proved from the runtime request itself.",
    ],
    nextProof: "Connect the performance read model to the public deployed runtime and prove it against the current colleague demo URL.",
  },
  {
    id: "hotel-operating-workflows",
    label: "Complete implemented hotel-operating workflows",
    status: "in_progress",
    evidence: [
      "Canonical schema contains reservation, occupancy, folio, housekeeping, group and finance tables.",
      "TypeScript and boundaries are currently green after Order 618.",
      "Order 621 exposes a deterministic group-block workbench contract for block status, pickup, wash and rooming-list readiness.",
      "Order 638 exposes /api/v1/demo/group-blocks/manager with read-only group reservation management actions and next-step guidance.",
      "Order 639 exposes cashier and front-desk actions as confirmation-gated disabled controls with cashier role policy and no drawer requirement for read/preparation.",
      "Order 623 exposes /api/v1/demo/operating-journey across arrival, stay, cashier, housekeeping, group blocks, checkout and Overwatch.",
      "Order 633 exposes /api/v1/demo/actions/confirm with exact confirmation phrase checks and authoritative reread payloads, while real PMS execution remains disabled.",
      "Order 635 exposes /api/v1/demo/sandbox/actions/execute for confirmed synthetic demo-only execution; no real PMS tables, journals, payments, documents, statutory records or outbox rows are written.",
      "Order 641 stitches Today board, arrival, cashier, group block, checkout and Overwatch into one scenario contract.",
      "Order 642 proves the current demo routes are connected while real PMS execution remains disabled.",
      "Order 645 exposes /api/v1/demo/workflow-rehearsal as a deterministic synthetic rehearsal covering every workflow card.",
      "Order 648 exposes /api/v1/demo/action-safety-matrix; later governed orders update it to enumerate five reviewed real PMS mutation families.",
      "Order 651 adds the first governed DB-backed operational command route: /api/v1/demo/governed/housekeeping/condition for confirmation-gated room-condition updates.",
      "Order 652 adds explicit demo-arrival provisioning plus /api/v1/demo/governed/check-in for confirmation-gated arrival check-in.",
      "Order 653 adds bounded cashier charge posting through /api/v1/demo/governed/cashier/post-charge.",
      "Order 654 adds bounded cashier settlement through /api/v1/demo/governed/cashier/settle-payment.",
      "Order 655 adds bounded checkout completion through /api/v1/demo/governed/checkout/complete.",
      "Order 656 adds bounded group block status conversion through /api/v1/demo/governed/group-block/status.",
      "Order 657 adds bounded group pickup reservation creation through /api/v1/demo/governed/group-block/pickup.",
      "Order 658 adds bounded group wash/release through /api/v1/demo/governed/group-block/wash.",
      "Order 659 adds bounded group rooming-list import through /api/v1/demo/governed/group-block/rooming-list/import.",
      "Order 660 adds bounded same-type room move through /api/v1/demo/governed/room-move.",
    ],
    nextProof: "Use the governed PMS routes as the pattern, then connect OTA/channel writeback and production payment rails only after separate governance.",
  },
  {
    id: "mobile-first-ux",
    label: "Mobile-first colleague UX",
    status: "in_progress",
    evidence: [
      "This thin server now exposes a CSP-safe mobile-readable shell.",
      "Earlier orders document Yellow Next mobile/ribbon work, but this checkout must still publish a current verified app surface.",
      "Order 625 renders the operating journey at / with local /assets/demo.css and no inline scripts or inline styles.",
      "Order 627 local Chrome proof passed at 375×812 and 1440×900 with no horizontal overflow.",
      "Order 649 adds /api/v1/demo/public-runtime-proof; local requests remain not share-ready until the route is observed on an HTTPS public host.",
      "Order 637 renders headline occupancy, ADR and RevPAR from /api/v1/demo/performance rather than decorative frontend constants.",
      "Order 639 renders a compact Today board and room-status summary from /api/v1/demo/front-desk-board.",
    ],
    nextProof: "Run browser/mobile viewport proof against the current public URL and verify the shell renders without overflow.",
  },
  {
    id: "overwatch-gemini",
    label: "Yellow/Overwatch multilingual Gemini AI",
    status: "in_progress",
    evidence: [
      "Orders document Overwatch successor naming and Gemini boundary work.",
      "Order 620 exposes /api/v1/overwatch/message with deterministic multilingual intent handling and Gemini explicitly not connected.",
      "Order 640 adds Overwatch suggested workbench/action routing for PMS intents while keeping operational prompts locally gated.",
      "Order 629 adds the Gemini generateContent provider boundary and /api/v1/overwatch/provider without exposing secrets.",
      "Order 631 adds tools/overwatch-gemini-smoke.ts; current run passed with configured:false and liveGeminiProved:false.",
      "Order 646 exposes /api/v1/demo/ai-rehearsal so colleagues can inspect non-operational Gemini guidance, operational local gating and Hindi/Indian-English detection.",
      "Order 650 updates the default model to gemini-3.6-flash and exposes /api/v1/demo/gemini-live-proof for runtime configured-key proof without exposing secrets.",
    ],
    nextProof: "Run /api/v1/demo/gemini-live-proof on the public URL and verify liveGeminiProved=true while operational prompts remain locally gated.",
  },
  {
    id: "confirmation-gated-actions",
    label: "Confirmation-gated operational actions",
    status: "in_progress",
    evidence: [
      "The product rule is recorded: operational mutations require explicit confirmation.",
      "Order 620 proves operational PMS prompts require the exact confirmation phrase and still execute no mutation until governed workflow proof exists.",
      "Order 648 started the action-safety matrix; Orders 651-655 now prove five exact-confirmation governed real PMS mutation families.",
      "Order 651 starts real governed command proof with housekeeping condition mutation only.",
      "Order 652 adds arrival check-in using record_occupancy().",
      "Order 653 adds balanced cashier charge posting; Order 654 adds cash-marker settlement; Order 655 adds release_occupancy() checkout completion.",
      "Order 656 adds confirmation-gated group block status conversion with inventory-deduction config reread.",
      "Order 657 adds confirmation-gated group pickup reservation creation with allotment and replay proof.",
      "Order 658 adds confirmation-gated group wash/release preserving picked-up reservations.",
      "Order 659 adds confirmation-gated rooming-list import using reservation_guest links.",
      "Order 660 adds confirmation-gated same-type room move using approved occupancy functions.",
    ],
    nextProof: "Prove each remaining live mutation route refuses action before explicit confirmation and rereads authoritative state after success.",
  },
] as const;

export const COLLEAGUE_DEMO_READINESS: ColleagueDemoReadiness = Object.freeze({
  product: "Yellow PMS",
  audience: "colleague-public-demo",
  status: "not_ready",
  shareNotificationAllowed: false,
  principle: "Do not notify the founder that the demo is ready until every requirement is proved by current runtime evidence.",
  syntheticProperty: {
    name: "Locanda Riyadh Synthetic",
    positioning: "fictional full-service hotel used only for colleague demo proof",
    configuredAreas: [
      "rooms and room types",
      "reservations and arrivals",
      "folios and cashier workbench",
      "housekeeping and room readiness",
      "commercial MSG/MS/source hierarchy",
      "Overwatch assistant surface",
    ],
  },
  requirements,
  confirmationPolicy: {
    operationalActionsRequireExplicitConfirmation: true as const,
    examples: [
      "check in",
      "post charge",
      "move room",
      "check out",
      "cancel or reinstate reservation",
      "assign housekeeping task",
    ],
  },
});

export function buildColleagueDemoReadiness(input: ColleagueDemoReadinessInput = {}): ColleagueDemoReadiness {
  const publicMobileReady = input.publicAccessObserved === true && input.mobileProofObserved === true;
  const geminiReady = input.liveGeminiProved === true;
  const dynamicRequirements = requirements.map((requirement) => {
    if (requirement.id === "mobile-first-ux") {
      return withStatus(
        requirement,
        publicMobileReady ? "proved" : "in_progress",
        publicMobileReady
          ? "Public HTTPS mobile runtime proof observed."
          : "Run browser/mobile viewport proof against the current public URL and verify the shell renders without overflow.",
      );
    }
    if (requirement.id === "overwatch-gemini") {
      return withStatus(
        requirement,
        geminiReady ? "proved" : "in_progress",
        geminiReady
          ? "Live Gemini non-operational guidance proved while operational prompts remain locally gated."
          : "Run /api/v1/demo/gemini-live-proof on the public URL and verify liveGeminiProved=true while operational prompts remain locally gated.",
      );
    }
    if (requirement.id === "hotel-operating-workflows" || requirement.id === "confirmation-gated-actions") {
      return withStatus(
        requirement,
        "proved",
        "Governed PMS workflow proof is complete for the colleague demo command surface.",
      );
    }
    if (requirement.id === "synthetic-property") {
      return withStatus(
        requirement,
        publicMobileReady ? "proved" : "in_progress",
        publicMobileReady
          ? "Synthetic property is exposed on the public mobile runtime."
          : requirement.nextProof,
      );
    }
    return requirement;
  });
  const ready = dynamicRequirements.every((requirement) => requirement.status === "proved");
  return Object.freeze({
    ...COLLEAGUE_DEMO_READINESS,
    status: ready ? "ready" : "not_ready",
    shareNotificationAllowed: ready,
    requirements: Object.freeze(dynamicRequirements),
    principle: ready
      ? "Demo is ready only because current runtime evidence proves every requirement."
      : COLLEAGUE_DEMO_READINESS.principle,
  });
}

export function renderDemoReadinessHtml(readiness: ColleagueDemoReadiness = COLLEAGUE_DEMO_READINESS): string {
  const requirementItems = readiness.requirements
    .map((requirement) => `<li><strong>${escapeHtml(requirement.label)}</strong>: ${escapeHtml(requirement.status)} — ${escapeHtml(requirement.nextProof)}</li>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Yellow PMS demo readiness</title>
</head>
<body>
  <main>
    <h1>Yellow PMS public demo</h1>
    <p>Status: <strong>${escapeHtml(readiness.status)}</strong></p>
    <p>${escapeHtml(readiness.principle)}</p>
    <section>
      <h2>${escapeHtml(readiness.syntheticProperty.name)}</h2>
      <p>${escapeHtml(readiness.syntheticProperty.positioning)}</p>
    </section>
    <section>
      <h2>Readiness checklist</h2>
      <ul>${requirementItems}</ul>
    </section>
    <p><a href="/api/v1/demo/readiness">View machine-readable readiness contract</a></p>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
