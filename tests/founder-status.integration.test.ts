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
import { Database, PostgresIdempotency } from "../src/kernel";
import { PROJECT_BUILD_SNAPSHOT, type OperatorRuntimeStatus } from "../src/project-status";
import { APPROVED_REVIEW_FILES, INDEPENDENTLY_REVIEWED_THROUGH_ORDER } from "../src/generated/review-coverage";
import { deriveIndependentReviewCoverage, parseApprovedOrders } from "../scripts/derive-review-coverage";
import { REVIEW_EMAIL, runReviewSeed } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_FOUNDER_STATUS_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_FOUNDER_STATUS === "1";
const SECRET = "yellow-order-064-founder-status-secret-long-enough";
const PASSWORD = "YellowLocal2026!";
const RUNTIME_STATUS: OperatorRuntimeStatus = Object.freeze({
  workbenchEnabled: true,
  holdExpiryWorkerEnabled: true,
  availabilityProjectionWorkerEnabled: false,
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
    expect(PROJECT_BUILD_SNAPSHOT.roadmap.latestBuiltOrder).toBe(155);
    expect(PROJECT_BUILD_SNAPSHOT.review.gate3Debt).toBe(0);
    expect(PROJECT_BUILD_SNAPSHOT.review.state).toBe("built_unverified");
    expect(PROJECT_BUILD_SNAPSHOT.roadmap.currentOrder).toBe(156);
    expect(PROJECT_BUILD_SNAPSHOT.roadmap.activePhase).toBe(5);
    expect(PROJECT_BUILD_SNAPSHOT.roadmap.phaseCount).toBe(13);
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
        remaining: "PR #78 is open and unmerged; no deployment is claimed.",
      },
      {
        order: 154,
        state: "independently_approved",
        summary: "Order 154 reviewed runtime-DML union independently approved.",
        remaining: "The reviewed union is unmerged; no deployment is claimed.",
      },
      {
        order: 155,
        state: "independently_approved",
        summary: "Order 155 resolved-question normalization independently checked.",
        remaining: "The governance-only order is unmerged.",
      },
      {
        order: 156,
        state: "proof_in_progress",
        summary: "Q166 option 1 authorized for a dedicated extension registrar.",
        remaining: "Implementation and independent Tier-3 proof are in progress; no product completion is claimed.",
      },
    ]);
    expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBe(91);
    expect(PROJECT_BUILD_SNAPSHOT.phases).toHaveLength(13);
    expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ number }) => Number(number))).toEqual([...Array(13).keys()]);
    expect(PROJECT_BUILD_SNAPSHOT.phases[0]?.state).toBe("reviewed");
    expect(PROJECT_BUILD_SNAPSHOT.phases[1]?.state).toBe("reviewed");
    expect(PROJECT_BUILD_SNAPSHOT.phases[2]?.state).toBe("reviewed");
    expect(PROJECT_BUILD_SNAPSHOT.phases[3]?.state).toBe("reviewed");
    expect(PROJECT_BUILD_SNAPSHOT.phases[4]?.state).toBe("built_unverified");
    expect(PROJECT_BUILD_SNAPSHOT.phases[5]?.state).toBe("active");
    expect(PROJECT_BUILD_SNAPSHOT.phases.slice(6).every(({ state }) => state === "planned")).toBe(true);
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
    expect(html).toContain('id="review-progress"');
    expect(html).toContain('id="status-reviewed"');
    expect(html).toContain('id="status-current-work"');
    expect(html).toContain("Recorded coordination evidence");
    expect(html).toContain("Recorded build snapshot");
    expect(html).toContain("Live service checks");
    expect(css).toContain(".status-health-grid");
    expect(css).toContain(':root[data-theme="pixel"]');
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
        app: { state: string; checkedAt: string; processStartedAt: string };
        database: { state: string; checkedAt: string; tenantContext: boolean; database: string };
        workers: { holdExpiry: string; availabilityProjection: string };
        valkey: { state: string; detail: string };
        ci: { state: string; detail: string };
      };
    };
    expect(body.snapshot).toEqual(PROJECT_BUILD_SNAPSHOT);
    expect(body.live.app).toEqual({
      state: "operational",
      checkedAt: expect.any(String),
      processStartedAt: RUNTIME_STATUS.processStartedAt,
    });
    expect(Number.isFinite(Date.parse(body.live.app.checkedAt))).toBe(true);
    expect(body.live.database).toEqual({
      state: "operational",
      checkedAt: expect.any(String),
      tenantContext: true,
      database: expect.any(String),
    });
    expect(Number.isFinite(Date.parse(body.live.database.checkedAt))).toBe(true);
    expect(body.live.workers).toEqual({ holdExpiry: "configured", availabilityProjection: "disabled" });
    expect(body.live.valkey).toEqual({
      state: "not_connected",
      detail: "Valkey is present in local Compose but is not an application dependency yet.",
    });
    expect(body.live.ci).toEqual({
      state: "not_connected",
      detail: "External CI is not queried by the local runtime; use the linked GitHub pull request evidence.",
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/password|secret|token|DATABASE_URL|postgres:\/\/|\/home\/|C:\\\\|\.git|handoff\//i);
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
