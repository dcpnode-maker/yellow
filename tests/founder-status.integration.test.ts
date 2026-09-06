import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import { OperatorHttpApi } from "../src/http/operator";
import { buildInfoFromEnvironment, Database, PostgresIdempotency } from "../src/kernel";
import { PROJECT_BUILD_SNAPSHOT, type OperatorRuntimeStatus } from "../src/project-status";
import { APPROVED_REVIEW_FILES, INDEPENDENTLY_REVIEWED_THROUGH_ORDER } from "../src/generated/review-coverage";
import { deriveIndependentReviewCoverage, parseApprovedOrders } from "../scripts/derive-review-coverage";
import { REVIEW_EMAIL, runReviewSeed } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_FOUNDER_STATUS_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_FOUNDER_STATUS === "1";
const SECRET = "yellow-order-064-founder-status-secret-long-enough";
const PASSWORD = "YellowLocal2026!";
const TEST_BUILD = buildInfoFromEnvironment({
  YELLOW_BUILD_SHA: "0123456789abcdef0123456789abcdef01234567",
});
const RUNTIME_STATUS: OperatorRuntimeStatus = Object.freeze({
  build: TEST_BUILD,
  workbenchEnabled: true,
  holdExpiryWorkerEnabled: true,
  availabilityProjectionWorkerEnabled: false,
  pickupTaskWorkerEnabled: false,
  reservationArrivalRollWorkerEnabled: true,
  reservationDepartureRollWorkerEnabled: true,
  businessDayRollWorkerEnabled: true,
  processStartedAt: "2026-08-22T00:00:00.000Z",
});

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_FOUNDER_STATUS_URL is required by the Order 064 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let loginPool: SQL | undefined;
let database: Database | undefined;
let tokens: Hs256TokenSigner;
let app: ReturnType<typeof createApp>;

function createFounderStatusApp(): ReturnType<typeof createApp> {
  return createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      new LocalLoginService(loginPool!, tokens),
      new AvailabilityService(),
      undefined,
      new PostgresIdempotency(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      RUNTIME_STATUS,
    ),
  });
}

function request(path: string, token?: string): Promise<Response> {
  return app.handle(new Request(`http://yellow.test${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }));
}

async function loginToken(): Promise<string> {
  const response = await app.handle(new Request("http://yellow.test/api/v1/auth/local:login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant: SEED_TENANT.slug, email: REVIEW_EMAIL, password: PASSWORD }),
  }));
  expect(response.status).toBe(200);
  const body = await response.json() as { accessToken?: string };
  if (!body.accessToken) throw new Error("review login returned no access token");
  return body.accessToken;
}

function manifestRows(source: string): Array<{ order: number; status: string }> {
  return source.split("\n").flatMap((line) => {
    const match = line.match(/^\|\s*(\d{3})\s*\|[^|]*\|[^|]*\|\s*([A-Z-]+)\s*\|/);
    return match ? [{ order: Number(match[1]), status: match[2]! }] : [];
  });
}

const FOUNDER_STATUS_SENSITIVE_VALUE_PATTERNS = [
  ["credential assignment", /\b(?:password|secret|token)\b\s*(?:=|:)\s*\S+/i],
  ["database environment", /\bDATABASE_URL\b/i],
  ["Postgres URL", /postgres(?:ql)?:\/\//i],
  ["bearer credential", /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i],
  ["JWT credential", /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/],
  ["Unix home path", /\/home\//i],
  ["Windows absolute path", /\b[A-Za-z]:\\/],
  ["Git internals", /\.git/i],
  ["handoff internals", /handoff[\\/]/i],
] as const;

function founderStatusPrivacyLeaks(
  value: unknown,
  exactSensitiveValues: readonly (string | undefined)[] = [],
): string[] {
  const leaks: string[] = [];
  const exactValues = exactSensitiveValues.filter((candidate): candidate is string => Boolean(candidate));

  const visit = (candidate: unknown, path: string): void => {
    if (typeof candidate === "string") {
      for (const exactValue of exactValues) {
        if (candidate.includes(exactValue)) leaks.push(`${path}: exact sensitive value`);
      }
      for (const [label, pattern] of FOUNDER_STATUS_SENSITIVE_VALUE_PATTERNS) {
        if (pattern.test(candidate)) leaks.push(`${path}: ${label}`);
      }
      return;
    }
    if (Array.isArray(candidate)) {
      candidate.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, entry] of Object.entries(candidate)) {
      const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
      if (["password", "secret", "token", "databaseurl"].some((part) => normalizedKey.includes(part))) {
        leaks.push(`${path}.${key}: sensitive key`);
      }
      visit(entry, `${path}.${key}`);
    }
  };

  visit(value, "$");
  return leaks;
}

describe("Order 432 founder-status privacy oracle", () => {
  test("permits domain prose while rejecting credential data and internal paths", () => {
    expect(founderStatusPrivacyLeaks({
      summary: "Order 192 independently approved the token-only payment foundation.",
      remaining: "Password and secret-management requirements remain documented.",
    })).toEqual([]);

    const hostileCases: ReadonlyArray<{
      readonly label: string;
      readonly value: unknown;
      readonly exactValues?: readonly string[];
    }> = [
      { label: "password key", value: { password: "redacted" } },
      { label: "camel-case token key", value: { accessToken: "redacted" } },
      { label: "snake-case secret key", value: { client_secret: "redacted" } },
      { label: "database URL key", value: { DATABASE_URL: "redacted" } },
      { label: "password assignment", value: { detail: "password=not-for-clients" } },
      { label: "secret assignment", value: { detail: "secret: not-for-clients" } },
      { label: "token assignment", value: { detail: "token=not-for-clients" } },
      { label: "database environment", value: { detail: "DATABASE_URL is configured" } },
      { label: "Postgres URL", value: { detail: "postgres://yellow:password@database/yellow" } },
      { label: "bearer credential", value: { detail: "Bearer opaque-access-credential" } },
      { label: "JWT credential", value: { detail: "eyJheader12345.payload12345.signature12345" } },
      { label: "Unix home path", value: { detail: "/home/runner/work/yellow" } },
      { label: "Windows path", value: { detail: "C:\\Users\\runner\\yellow" } },
      { label: "Git internals", value: { detail: ".git/config" } },
      { label: "handoff internals", value: { detail: "handoff/orders/432.md" } },
      {
        label: "known opaque credential",
        value: { detail: "known-opaque-credential" },
        exactValues: ["known-opaque-credential"],
      },
    ];

    for (const hostile of hostileCases) {
      expect({ label: hostile.label, leaked: founderStatusPrivacyLeaks(hostile.value, hostile.exactValues).length > 0 })
        .toEqual({ label: hostile.label, leaked: true });
    }
  });
});

function reviewSource({
  title = "045-091 wave test",
  reviewer = "OpenAI Codex independent non-implementing reviewer",
  verdict = "APPROVED",
  scope,
}: {
  readonly title?: string;
  readonly reviewer?: string;
  readonly verdict?: string;
  readonly scope?: string;
} = {}): string {
  return [
    `# REVIEW ${title}`,
    `**Reviewed by:** ${reviewer}`,
    "**Date:** 2026-08-24",
    `**Verdict:** ${verdict}`,
    ...(scope === undefined ? [] : ["", "## Exclusive discharge scope", `Orders **${scope}**.`]),
  ].join("\n");
}

describe("Order 093 hostile review-coverage parsing", () => {
  test("a partial 045-091 wave header cannot imply full coverage", () => {
    expect(parseApprovedOrders(reviewSource())).toBeUndefined();
    expect(parseApprovedOrders(reviewSource({ scope: "045-052" }))).toEqual([
      45, 46, 47, 48, 49, 50, 51, 52,
    ]);

    const wrappedScopeWithSupportingOrder = [
      "# REVIEW 045-091 — Wave hostile",
      "**Reviewed by:** OpenAI Codex independent non-implementing reviewer",
      "**Date:** 2026-08-24",
      "**Verdict:** **APPROVED**",
      "",
      "## Exclusive discharge scope",
      "This review approves only Orders **045-086, 089-090,",
      "with no other owners**. Supporting evidence from Order 091 is not discharged here.",
      "",
      "## Next",
    ].join("\n");
    const approvedOrders = parseApprovedOrders(wrappedScopeWithSupportingOrder);
    expect(approvedOrders).toContain(90);
    expect(approvedOrders).not.toContain(91);
  });

  test("explicit approval and recognized independent authority are mandatory", () => {
    expect(parseApprovedOrders(reviewSource({ verdict: "CHANGES REQUIRED" }))).toBeUndefined();
    expect(parseApprovedOrders(reviewSource({ verdict: "review complete" }))).toBeUndefined();
    expect(parseApprovedOrders(reviewSource({ reviewer: "Yellow builder" }))).toBeUndefined();
    expect(parseApprovedOrders(reviewSource({ reviewer: "helpful observer" }))).toBeUndefined();
    expect(parseApprovedOrders(reviewSource({ scope: "089-091" }))).toEqual([89, 90, 91]);
  });

  test("the wave union must be complete while documented 087/088 gaps create no debt", async () => {
    const directoryPath = await mkdtemp(join(tmpdir(), "yellow-review-coverage-"));
    const directory = new URL("./", pathToFileURL(`${directoryPath}/`));
    try {
      await Bun.write(new URL("base.md", directory), reviewSource({
        title: "001-044 cumulative",
        reviewer: "Claude architect role",
      }));
      await Bun.write(new URL("wave-a.md", directory), reviewSource({ scope: "045-086" }));
      await Bun.write(new URL("wave-b.md", directory), reviewSource({ scope: "089-090" }));
      expect((await deriveIndependentReviewCoverage(directory)).throughOrder).toBe(44);

      await Bun.write(new URL("wave-b.md", directory), reviewSource({ scope: "089-091" }));
      expect((await deriveIndependentReviewCoverage(directory)).throughOrder).toBe(91);
    } finally {
      await rm(directoryPath, { recursive: true, force: true });
    }
  });
});

describe("Order 064 recorded build snapshot", () => {
  test("P3: runtime snapshot is exact to the committed Gate-3 manifest", async () => {
    const manifest = await Bun.file(new URL("../handoff/GATE-3-MANIFEST.md", import.meta.url)).text();
    const reviewCoverage = await deriveIndependentReviewCoverage();
    const rows = manifestRows(manifest);
    expect(rows.length).toBeGreaterThan(0);
    expect(PROJECT_BUILD_SNAPSHOT.schemaVersion).toBe(2);
    expect(PROJECT_BUILD_SNAPSHOT.label).toBe("Durable fiscal submission integration in progress");
    expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-06");
    expect(PROJECT_BUILD_SNAPSHOT.roadmap.latestBuiltOrder).toBe(439);
    expect(PROJECT_BUILD_SNAPSHOT.review.gate3Debt).toBe(0);
    expect(PROJECT_BUILD_SNAPSHOT.review.state).toBe("built_unverified");
    expect(PROJECT_BUILD_SNAPSHOT.roadmap.currentOrder).toBe(440);
    expect(PROJECT_BUILD_SNAPSHOT.roadmap.activePhase).toBe(7);
    expect(PROJECT_BUILD_SNAPSHOT.roadmap.phaseCount).toBe(18);
    expect(reviewCoverage.throughOrder).toBe(91);
    expect(reviewCoverage.approvedReviewFiles).toContain("045-091-wave-a.md");
    expect(reviewCoverage.approvedReviewFiles).toContain("045-091-wave-b.md");
    expect(reviewCoverage.approvedReviewFiles).toContain("045-091-wave-c.md");
    expect(reviewCoverage.approvedReviewFiles).toContain("045-091-wave-d.md");
    expect(reviewCoverage.approvedReviewFiles).not.toContain("045-073-gate-3.md");
    expect(JSON.stringify(APPROVED_REVIEW_FILES)).toBe(JSON.stringify(reviewCoverage.approvedReviewFiles));
    expect(Number(INDEPENDENTLY_REVIEWED_THROUGH_ORDER)).toBe(reviewCoverage.throughOrder);
    expect(Number(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder)).toBe(Number(reviewCoverage.throughOrder));
    expect(PROJECT_BUILD_SNAPSHOT.referee).toEqual({ requiredPasses: 11, requiredFailures: 0 });
    expect(PROJECT_BUILD_SNAPSHOT.recordedWork).toEqual([
      {
        order: 126,
        state: "independently_approved",
        summary: "Order 126 independently approved (D-391).",
      },
      {
        order: 127,
        state: "independently_approved",
        summary: "Order 127 independently approved (D-407).",
      },
      {
        order: 148,
        state: "independently_approved",
        summary: "Order 148 independently approved (D-412).",
        remaining: "Historical approval was limited to this source scope; current integration and release truth is carried by Order 438 evidence.",
      },
      {
        order: 154,
        state: "independently_approved",
        summary: "Order 154 reviewed runtime-DML union independently approved.",
        remaining: "Historical review was limited to the runtime-DML union; current integration and release truth is carried by Order 438 evidence.",
      },
      {
        order: 155,
        state: "independently_approved",
        summary: "Order 155 resolved-question normalization independently checked.",
        remaining: "This remains historical governance evidence; current integration and release truth is carried by Order 438.",
      },
      {
        order: 156,
        state: "independently_approved",
        summary: "Order 156 dedicated extension registrar independently approved.",
        remaining: "This capability does not imply Phase-wide completion or production deployment.",
      },
      {
        order: 160,
        state: "independently_approved",
        summary: "Order 160 local-review booking authority independently approved.",
        remaining: "Approval is limited to the governed local Party-to-reservation journey.",
      },
      {
        order: 161,
        state: "independently_approved",
        summary: "Order 161 local booking promotion independently approved.",
        remaining: "Runtime promotion evidence is recorded separately; no production deployment is claimed.",
      },
      {
        order: 162,
        state: "independently_approved",
        summary: "Order 162 rate-publication cursor correction independently approved.",
        remaining: "Approval is limited to the immutable cursor-binding correction.",
      },
      {
        order: 163,
        state: "independently_approved",
        summary: "Order 163 persistent local founder login handoff independently approved.",
        remaining: "The protected credential handoff and runtime identity are evidenced outside this snapshot.",
      },
      {
        order: 164,
        state: "independently_approved",
        summary: "Order 164 approved the clean product and local operational lineage prerequisite.",
        remaining: "Approval did not complete reservation UX, deploy, or advance Phase 5.",
      },
      {
        order: 165,
        state: "independently_approved",
        summary: "Order 165 independently approved editable near-future stay defaults and the exact booking-window 400 response.",
        remaining: "Approval did not include the reservation board, read model, drawer, or broader UI completion.",
      },
      {
        order: 166,
        state: "independently_approved",
        summary: "Order 166 independently approved the bounded reservation board and UUID detail read surface.",
        remaining: "Approval did not include a new UI, reservation writes, schema changes, or Phase-wide completion.",
      },
      {
        order: 168,
        state: "independently_approved",
        summary: "Order 168 independently approved the dependency-free reservation workspace UI.",
        remaining: "Approval did not itself promote a local stack or claim broader Phase 5 completion.",
      },
      {
        order: 169,
        state: "independently_approved",
        summary: "Order 169 independently approved the bounded loopback app-only promotion.",
        remaining: "Approval did not authorize public exposure, production deployment, or rollback destruction.",
      },
      {
        order: 170,
        state: "independently_approved",
        summary: "Order 170 independently approved the extension registrar composition onto the reservation lineage.",
        remaining: "Approval did not close other command-capability debt or authorize extension publication transitions.",
      },
      {
        order: 171,
        state: "independently_approved",
        summary: "Order 171 independently approved the explicit reservation-to-primary-folio-to-governed-untaxed-charge journey.",
        remaining: "Approval did not include payments, tax, fiscal documents, settlement, transfers, or checkout.",
      },
      {
        order: 173,
        state: "independently_approved",
        summary: "Order 173 independently approved exact byte-identical primary-folio replay semantics.",
        remaining: "Approval was limited to the corrected HTTP representation and existing replay header.",
      },
      {
        order: 174,
        state: "independently_approved",
        summary: "Order 174 independently approved the singular UUID folio workspace shell route.",
        remaining: "The shell adds no data or business authority.",
      },
      {
        order: 175,
        state: "independently_approved",
        summary: "Order 175 independently approved responsive folio containment with the semantic table preserved.",
        remaining: "Approval did not change folio data, finance authority, or runtime behavior.",
      },
      {
        order: 176,
        state: "independently_approved",
        summary: "Order 176 independently approved the adaptive detail levels and original visual themes.",
        remaining: "Presentation changes do not alter permissions, request semantics, or business authority.",
      },
      {
        order: 177,
        state: "independently_approved",
        summary: "Order 177 independently approved the bounded read-only Today command centre and focus correction.",
        remaining: "Approval did not add operational mutations or Phase-wide completion authority.",
      },
      {
        order: 178,
        state: "independently_approved",
        summary: "Order 178 independently approved deterministic offline India and Canada UAT inputs.",
        remaining: "These offline scenario foundations have not been imported into the application and carry no legal or fiscal authority.",
      },
      {
        order: 179,
        state: "independently_approved",
        summary: "Order 179 independently approved the authenticated founder-visible recorded-status snapshot.",
        remaining: "Approval was limited to recorded-status truth and did not promote a local runtime.",
      },
      {
        order: 180,
        state: "independently_approved",
        summary: "Order 180 independently approved the sole founder-local application on loopback port 3000.",
        remaining: "Approval was local-only; no public or production deployment is claimed.",
      },
      {
        order: 181,
        state: "independently_approved",
        summary: "Order 181 independently approved deterministic two-hotel offline scenario seed authority.",
        remaining: "Approval covered seed code only and did not import scenarios into the active local database.",
      },
      {
        order: 182,
        state: "independently_approved",
        summary: "Order 182 independently approved the bounded two-hotel scenario import into the sole founder-local database.",
        remaining: "The import preserved the existing founder journey; no product, schema, credential, or production change is claimed.",
      },
      {
        order: 183,
        state: "independently_approved",
        summary: "Order 183 independently approved governed immutable folio charge correction.",
        remaining: "Approval did not itself promote the correction to the founder-local runtime.",
      },
      {
        order: 184,
        state: "independently_approved",
        summary: "Order 184 independently approved the material theme-skin product and its guarded local presentation.",
        remaining: "Its sixteen-skin catalogue was later superseded by Order 185; no broader product authority is claimed.",
      },
      {
        order: 185,
        state: "independently_approved",
        summary: "Order 185 independently approved the founder-curated Apple, Android, Win95 and Glass product catalogue.",
        remaining: "Approval changed presentation only and did not promote a local runtime.",
      },
      {
        order: 186,
        state: "independently_approved",
        summary: "Order 186 independently approved the correction-capable product on the sole founder-local application.",
        remaining: "Founder CRUD drift was preserved; no local business day was sealed and no production deployment is claimed.",
      },
      {
        order: 188,
        state: "independently_approved",
        summary: "Order 188 independently approved multi-window folio routing and the five-appearance product.",
        remaining: "Approval did not itself replace the founder-local application or claim Phase-wide completion.",
      },
      {
        order: 189,
        state: "independently_approved",
        summary: "Order 189 independently approved the exact Order 188 product on the sole founder-local application.",
        remaining: "Founder CRUD drift and persistent data were preserved; no public or production deployment is claimed.",
      },
      {
        order: 190,
        state: "independently_approved",
        summary: "Order 190 independently approved recorded project-status truth through Order 189 (D-501).",
        remaining: "Approval changed recorded status only and did not advance review coverage or promote a runtime.",
      },
      {
        order: 191,
        state: "independently_approved",
        summary: "Order 191 independently approved the sole-local Order 190 app-only promotion (D-504).",
        remaining: "Approval was loopback-local only and changed no database, credential, permission or product truth.",
      },
      {
        order: 192,
        state: "independently_approved",
        summary: "Order 192 independently approved the token-only payment foundation (D-509).",
        remaining: "Approval did not promote it locally or authorize a real payment provider, public deployment or Phase completion.",
      },
      {
        order: 193,
        state: "independently_approved",
        summary: "Order 193 independently approved the hosted-payment and deposit workbench (D-518).",
        remaining: "Approval remained provider-synthetic and did not authorize public exposure, production or Phase completion.",
      },
      {
        order: 195,
        state: "independently_approved",
        summary: "Order 195 independently approved the retained six-appearance product (D-530).",
        remaining: "Approval was limited to retaining that exact candidate on the sole loopback-local app; it did not authorize public or production deployment or Phase completion.",
      },
      {
        order: 199,
        state: "independently_approved",
        summary: "Orders 196–199 delivered folio settlement, cashier sessions, governed receivable transfer and the independently approved Phase-5 financial journey gate (D-967).",
        remaining: "The complete Phase-5 domain contract was later independently approved by Order 375 (D-1112); external provider settlement, full AR, fiscal issue and application completion remain separate.",
      },
      {
        order: 236,
        state: "independently_approved",
        summary: "Orders 200–236 and the bounded Orders 342–345 Phase-6 exit gate were independently approved (D-974).",
        remaining: "Approval excludes deferred discrepancy resolution, queue and message workflows, later phases, local refresh, merge and deployment.",
      },
      {
        order: 310,
        state: "independently_approved",
        summary: "Orders 237–310 built the Phase-7 tax lineage through independently approved India GST supplier and recipient registration evidence, property fiscal location, accommodation classification and place of supply, registered-state comparison, supplier service location, SEZ status, supply nature, statutory time-of-supply evidence, effective accommodation rate history, property-local day containment, component-family derivation, levy-input lineage and ordered IGST or CGST+SGST/UTGST component identities. The earlier approved stack also includes pure tax evaluation, attributable quote preview, canonical positive attribution persistence, quoted-tax hold and reservation lineage, configured semantic routing, governed line-rounded non-India posting and immutable full correction/reversal evidence.",
        remaining: "Numeric dual-component rate authority, taxable-value and amount calculation, rounding, India fiscal documents and IRP submission, final Phase-7 integration and Phase completion remain pending.",
      },
      {
        order: 396,
        state: "independently_approved",
        summary: "Orders 384–396 independently approved the Phase-5 business-day readiness, discrepancy carry, audited seal, and owner-trust operator delivery.",
        remaining: "These operator journeys are integrated and were reflected in the sole founder local by approved Orders 398–399; no public or production deployment, later financial expansion, or application completion is claimed.",
      },
      {
        order: 429,
        state: "independently_approved",
        summary: "Order 429 independently approved and closed (D1300) the read-only India IRP fiscal-action readiness boundary.",
        remaining: "Approval returns frozen false readiness only; document origin, numbering, series, provider submission, and Phase-7 completion remain separate.",
      },
      {
        order: 434,
        state: "independently_approved",
        summary: "Order 434 independently accepted native fiscal issuance at exact source 92346674c784b552356934e168d60e4b9650497a; PR83 CI33993977811 passed native116/116, migrations41/41, compatibility89/89, catalogue23/23, exact schema and referee11/11, and merged source is 443e3826b47025106d1829fcbb406ce6302fbbba with 77 migrations and 127 public tables.",
        remaining: "Acceptance is unreleased native proof: provider submission, durable attempt/receipt integration, authenticated provider normalization, runtime activation and Phase-7 completion remain separate.",
      },
      {
        order: 438,
        state: "independently_approved",
        summary: "Orders 438/439 independently approved the consolidated operational baseline at bb3b8f9. All five CI jobs passed, including real database invariants and the full local launcher; migration 75 contains the unapproved legacy native-fiscal issue capability.",
        remaining: "This baseline remains historical source and operational evidence. Its local and cloud serving revisions are separate receipts; no runtime refresh or cloud deployment is claimed, and Phase 7 is not complete.",
      },
      {
        order: 440,
        state: "proof_in_progress",
        summary: "Order 440 is the current Phase-7 work: provider-neutral durable fiscal submission and reconciliation after accepted native issuance; the separately descriptive Order 440 hotel journeys and fictional design study are merged as design input with a fictional in-memory prototype only. The separate Order 441 Astra Ultra RMS paper is documented research only, with no algorithm runtime or measured uplift.",
        remaining: "Private fiscal reducer and issued-wire projection are independently verified; durable persistence, claim/reconciliation worker, canonical issued payload assembly and authenticated provider normalization remain unfinished. IRP provider activation and operator invoice UI remain separate; new-department release, local refresh, cloud deployment and live sandbox evidence remain outstanding; the hotel prototype is not production and Phase 7 is not complete.",
      },
    ]);
    const recordedOrders = PROJECT_BUILD_SNAPSHOT.recordedWork.map(({ order }) => Number(order));
    expect(recordedOrders).toEqual([
      126, 127, 148, 154, 155, 156, 160, 161, 162, 163, 164,
      165, 166, 168, 169, 170, 171, 173, 174, 175, 176, 177, 178,
      179, 180, 181, 182, 183, 184, 185, 186, 188, 189,
      190, 191, 192, 193, 195, 199, 236, 310, 396, 429, 434, 438, 440,
    ]);
    expect(recordedOrders).not.toContain(167);
    expect(recordedOrders).not.toContain(172);
    expect(recordedOrders).not.toContain(187);
    expect(recordedOrders).not.toContain(194);
    expect(PROJECT_BUILD_SNAPSHOT.recordedWork.filter(({ order }) => Number(order) >= 190 && Number(order) <= 195)
      .filter(({ state }) => state === "independently_approved").map(({ order }) => Number(order)))
      .toEqual([190, 191, 192, 193, 195]);
    expect(PROJECT_BUILD_SNAPSHOT.recordedWork.slice(0, -1).every(({ state }) => state === "independently_approved")).toBeTrue();
    expect(PROJECT_BUILD_SNAPSHOT.recordedWork.at(-1)?.state).toBe("proof_in_progress");
    expect(PROJECT_BUILD_SNAPSHOT.recordedWork.find(({ order }) => order === 199)?.summary).toMatch(/196–199/);
    expect(PROJECT_BUILD_SNAPSHOT.recordedWork.find(({ order }) => order === 199)?.state).toBe("independently_approved");
    const order236: { readonly state: string; readonly summary: string; readonly remaining?: string } | undefined =
      PROJECT_BUILD_SNAPSHOT.recordedWork.find(({ order }) => order === 236);
    expect(order236?.state).toBe("independently_approved");
    expect(order236?.summary).toMatch(/200–236/);
    expect(order236?.summary).toMatch(/342–345/);
    expect(order236?.summary).toMatch(/D-974/);
    expect(order236?.remaining).toMatch(/deferred discrepancy resolution/i);
    expect(order236?.remaining).toMatch(/queue and message workflows/i);
    const order310: { readonly state: string; readonly summary: string; readonly remaining?: string } | undefined =
      PROJECT_BUILD_SNAPSHOT.recordedWork.find(({ order }) => order === 310);
    expect(order310?.state).toBe("independently_approved");
    expect(order310?.summary).toMatch(/237–310/);
    expect(order310?.summary).toMatch(/place of supply/i);
    expect(order310?.summary).toMatch(/time-of-supply evidence/i);
    expect(order310?.summary).toMatch(/component-family derivation/i);
    expect(order310?.summary).toMatch(/ordered IGST or CGST\+SGST\/UTGST component identities/i);
    expect(order310?.summary).toMatch(/governed line-rounded non-India posting/i);
    expect(order310?.remaining).toMatch(/numeric dual-component rate authority/i);
    expect(order310?.remaining).toMatch(/taxable-value and amount calculation/i);
    expect(order310?.remaining).toMatch(/fiscal documents and IRP submission/i);
    expect(order310?.remaining).toMatch(/Phase completion remain pending/i);
    const order396: { readonly state: string; readonly summary: string; readonly remaining?: string } | undefined =
      PROJECT_BUILD_SNAPSHOT.recordedWork.find(({ order }) => order === 396);
    expect(order396?.state).toBe("independently_approved");
    expect(order396?.summary).toMatch(/384–396/);
    expect(order396?.summary).toMatch(/business-day readiness/i);
    expect(order396?.summary).toMatch(/discrepancy carry/i);
    expect(order396?.summary).toMatch(/audited seal/i);
    expect(order396?.summary).toMatch(/owner-trust operator delivery/i);
    expect(order396?.remaining).toMatch(/integrated/i);
    expect(order396?.remaining).toMatch(/sole founder local/i);
    expect(order396?.remaining).toMatch(/Orders 398–399/i);
    const order178: { readonly summary: string; readonly remaining?: string } | undefined =
      PROJECT_BUILD_SNAPSHOT.recordedWork.find(({ order }) => order === 178);
    expect(`${order178?.summary} ${order178?.remaining}`).toMatch(/offline/i);
    expect(order178?.remaining).toMatch(/have not been imported into the application/i);
    expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBe(91);
    expect(PROJECT_BUILD_SNAPSHOT.phases).toHaveLength(18);
    expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ number }) => Number(number))).toEqual([...Array(18).keys()]);
    expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ name }) => name)).toEqual([
      "Bootstrap (repo that proves the loop)",
      "Kernel (tenancy, extension registry, outbox, fact_log)",
      "Inventory & Occupancy (the choke point goes live)",
      "Rates & Policies",
      "Reservations (search → hold → commit honest end-to-end)",
      "Financials (the ledger)",
      "Stay ops & Housekeeping",
      "Tax engine + India IRP",
      "Statutory registration + ZATCA",
      "Distribution (direct OTA first)",
      "PWA (seven surfaces, one codebase)",
      "Groups & Blocks",
      "UAE ASP + AR + migration tooling",
      "Voice and Conversational Command Layer",
      "Adaptive RMS and Revenue Intelligence",
      "CRM, CRS and Direct Booking",
      "Reporting, Forecasting and Executive Intelligence",
      "Events, Outlets and Hotel Interfaces",
    ]);
    expect(PROJECT_BUILD_SNAPSHOT.phases[0]?.state).toBe("reviewed");
    expect(PROJECT_BUILD_SNAPSHOT.phases[1]?.state).toBe("reviewed");
    expect(PROJECT_BUILD_SNAPSHOT.phases[2]?.state).toBe("reviewed");
    expect(PROJECT_BUILD_SNAPSHOT.phases[3]?.state).toBe("reviewed");
    expect(PROJECT_BUILD_SNAPSHOT.phases[4]?.state).toBe("built_unverified");
    expect(PROJECT_BUILD_SNAPSHOT.phases[5]?.state).toBe("reviewed");
    expect(PROJECT_BUILD_SNAPSHOT.phases[6]?.state).toBe("reviewed");
    expect(PROJECT_BUILD_SNAPSHOT.phases[7]?.state).toBe("active");
    expect(PROJECT_BUILD_SNAPSHOT.phases.slice(8).every(({ state }) => state === "planned")).toBe(true);
    expect(PROJECT_BUILD_SNAPSHOT.phases.filter(({ state }) => state === "active").map(({ number }) => number)).toEqual([7]);
  });

  test("P4/P5: health stays exact and assets contain honest same-origin status UI", async () => {
    let reserves = 0;
    const disabled = createApp({
      database: new Database({ async reserve(): Promise<never> { reserves += 1; throw new Error("must not reserve"); } }),
    });
    const health = await disabled.handle(new Request("http://yellow.test/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    expect(reserves).toBe(0);

    const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
    const css = await Bun.file(new URL("../src/http/operator/operator.css", import.meta.url)).text();
    const js = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
    const appSource = await Bun.file(new URL("../src/app.ts", import.meta.url)).text();
    const dockerfile = await Bun.file(new URL("../Dockerfile", import.meta.url)).text();
    expect(html).toContain('data-view="status"');
    expect(html).toContain('id="status-view"');
    expect(html).toContain('id="roadmap-progress"');
    expect(html).toContain('<progress id="roadmap-progress" max="18" value="0">0 of 18 phases reached</progress>');
    expect(html).toContain("Position is measured against 18 named BUILD-PLAN phases");
    expect(html).not.toContain("13 named BUILD-PLAN phases");
    expect(html).toContain('id="review-progress"');
    expect(html).toContain('id="status-reviewed"');
    expect(html).toContain('id="status-current-work"');
    expect(html).toContain("Recorded coordination evidence");
    expect(html).toContain("Recorded build snapshot");
    expect(html).toContain("Live service checks");
    expect(css).toContain(".status-health-grid");
    expect(css).toContain(':root[data-theme="android"]');
    expect(js).toContain('"/system-status"');
    expect(js).toContain("loadSystemStatus");
    expect(js).toContain('const statusReviewed = document.querySelector("#status-reviewed")');
    expect(js).toContain('const statusCurrentWork = document.querySelector("#status-current-work")');
    expect(js).toContain("statusCurrentWork.replaceChildren(...currentWork)");
    expect(js).toContain('statusReviewed.textContent = `${snapshot.review.independentlyReviewedThroughOrder} orders`;');
    expect(js).not.toContain('statusDebt.textContent = `${snapshot.review.gate3Debt} orders`;');
    expect(js).not.toMatch(/localStorage|sessionStorage|document\.cookie|setInterval|EventSource|WebSocket/);
    expect(js).not.toMatch(/github\.com|api\.github|docker|compose|child_process|Bun\.spawn|console\.(?:log|debug|info)/i);
    expect(appSource).toContain('/p/:property/status');
    expect(appSource).toContain('/api/v1/properties/:property/system-status');
    expect(dockerfile).not.toMatch(/COPY\s+(?:\.git|handoff|graphify-out)/i);
  });
});

beforeAll(async () => {
  if (!DATABASE_URL) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  await runReviewSeed({
    databaseUrl: DATABASE_URL,
    password: PASSWORD,
    approverPassword: `${PASSWORD}-approver`,
    logger: () => undefined,
  });
  loginPool = new SQL(DATABASE_URL, { max: 4 });
  database = Database.connect(DATABASE_URL, { maxConnections: 8 });
  tokens = new Hs256TokenSigner(SECRET);
});

afterAll(async () => {
  await loginPool?.close();
  await database?.close();
});

databaseDescribe("Order 064 authenticated founder status", () => {
  beforeEach(() => {
    app = createFounderStatusApp();
  });

  test("P1: granted property returns exact live-vs-recorded status without internals", async () => {
    const token = await loginToken();
    const response = await request(`/api/v1/properties/${SEED_PROPERTY.id}/system-status`, token);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
    const body = await response.json() as {
      snapshot: typeof PROJECT_BUILD_SNAPSHOT;
      live: {
        app: { state: string; checkedAt: string; processStartedAt: string; build: typeof TEST_BUILD };
        database: { state: string; checkedAt: string; tenantContext: boolean; database: string };
        workers: { holdExpiry: string; availabilityProjection: string; arrivalPickupTask: string;
          reservationArrivalRoll: string; reservationDepartureRoll: string; businessDayRoll: string };
        valkey: { state: string; detail: string };
        ci: { state: string; detail: string };
      };
    };
    expect(body.snapshot).toEqual(PROJECT_BUILD_SNAPSHOT);
    expect(body.live.app).toEqual({
      state: "operational",
      checkedAt: expect.any(String),
      processStartedAt: RUNTIME_STATUS.processStartedAt,
      build: TEST_BUILD,
    });
    expect(Number.isFinite(Date.parse(body.live.app.checkedAt))).toBe(true);
    expect(body.live.database).toEqual({
      state: "operational",
      checkedAt: expect.any(String),
      tenantContext: true,
      database: expect.any(String),
    });
    expect(Number.isFinite(Date.parse(body.live.database.checkedAt))).toBe(true);
    expect(body.live.workers).toEqual({
      holdExpiry: "configured", availabilityProjection: "disabled", arrivalPickupTask: "disabled",
      reservationArrivalRoll: "configured", reservationDepartureRoll: "configured", businessDayRoll: "configured",
    });
    expect(body.live.valkey).toEqual({
      state: "not_connected",
      detail: "Valkey is present in local Compose but is not an application dependency yet.",
    });
    expect(body.live.ci).toEqual({
      state: "not_connected",
      detail: "External CI is not queried by the local runtime; use the linked GitHub pull request evidence.",
    });
    expect(founderStatusPrivacyLeaks(body, [PASSWORD, SECRET, DATABASE_URL, token])).toEqual([]);
  });

  test("P2: authentication, scope, property and database failures stay generic", async () => {
    expect((await request(`/api/v1/properties/${SEED_PROPERTY.id}/system-status`)).status).toBe(401);
    expect((await request("/api/v1/properties/not-a-uuid/system-status", await loginToken())).status).toBe(400);

    const noScope = await tokens.issue({ userId: crypto.randomUUID(), tenantId: SEED_TENANT.id, scopes: [] });
    expect((await request(`/api/v1/properties/${SEED_PROPERTY.id}/system-status`, noScope)).status).toBe(403);

    const ungranted = await request(`/api/v1/properties/${crypto.randomUUID()}/system-status`, await loginToken());
    expect(ungranted.status).toBe(403);
    expect(await ungranted.json()).toEqual(expect.objectContaining({
      type: "auth/property_forbidden",
      title: "Forbidden",
      status: 403,
    }));

    const unavailable = createApp({
      database: new Database({ async reserve(): Promise<never> { throw new Error("database-secret-detail"); } }),
      tenantResolver: new BearerTenantResolver(tokens),
      operatorApi: new OperatorHttpApi(new LocalLoginService(loginPool!, tokens), new AvailabilityService()),
    });
    const failed = await unavailable.handle(new Request(
      `http://yellow.test/api/v1/properties/${SEED_PROPERTY.id}/system-status`,
      { headers: { authorization: `Bearer ${await loginToken()}` } },
    ));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("database-secret-detail");
  });
});
