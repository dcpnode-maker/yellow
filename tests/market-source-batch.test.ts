import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeMarketSourceBatch } from "../scripts/research/market-source-batch";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const posix = process.platform === "win32" ? test.skip : test;

function fixture(sources = ["booking-mcp"]) {
  return {
    schemaVersion: "yellow.market-source-batch/v1",
    policy: {
      tenantId: "tenant-demo", managedPropertyId: "property-demo",
      permissionScope: "market-research", entitlement: "synthetic-only",
      propertyTimezone: "Asia/Dubai", lookaheadMonths: 3,
      selectedSources: sources, competitorScope: ["demo-compset"],
      destination: "Dubai, United Arab Emirates",
      guests: { rooms: 1, adults: 2, childAges: [] }, currency: "AED",
      pointOfSaleMarket: "ae", language: "en", lengthsOfStayNights: [1],
    },
    run: { now: "2026-09-08T19:00:00Z", maxBatchSize: 2, maxRequestsThisRun: 2 },
  };
}
function bookingCapture() {
  return {
    source: "booking-mcp",
    collectedAt: "2026-09-08T18:25:45Z",
    query: {
      destination: "Dubai, United Arab Emirates", checkInDate: "2026-09-15",
      checkOutDate: "2026-09-16", adults: 2, rooms: 1, childrenAges: [],
      currency: "AED", pointOfSaleMarket: "AE", language: "en",
    },
    payload: { accommodations: [{
      id: 1234, name: "Synthetic Hotel", price: { book: 109.25, currency: "AED" },
      url: "https://www.booking.com/hotel/ae/synthetic.html?private_token=DROP-ME",
      hidden: "SHOULD_NOT_LEAVE_PAYLOAD",
    }] },
  };
}
function files(input: unknown) {
  const root = mkdtempSync(join(tmpdir(), "yellow-source-batch-")); roots.push(root);
  const inputPath = join(root, "input.json"); const output = join(root, "output");
  writeFileSync(inputPath, JSON.stringify(input), { mode: 0o600 });
  return { input: inputPath, output };
}

describe("Order RMS-20260908B source batch", () => {
  posix("ingests actual-shaped provider captures without allowing raw data or source money to become authority", async () => {
    const capture = bookingCapture();
    const paths = files({ ...fixture(), captures: [capture, capture] });
    const receipt = await executeMarketSourceBatch({ ...paths, mode: "ingest" });
    expect(receipt.status).toBe("completed");
    expect(receipt.candidates).toBe(1);
    expect(receipt.duplicateCapturesSkipped).toBe(1);
    expect(receipt.actualProviderHttpRequests).toBe(0);
    expect(receipt.operationalWrites).toBe(false);
    expect(receipt.arrivalEndExclusive).toBe("2026-12-08");
    const observations = readFileSync(join(paths.output, "observations.json"), "utf8");
    expect(observations).toContain("10925");
    expect(observations).toContain('"automaticPricingEligible": false');
    expect(observations).not.toContain("SHOULD_NOT_LEAVE_PAYLOAD");
    expect(observations).not.toContain("DROP-ME");
    expect(statSync(paths.output).mode & 0o777).toBe(0o700);
    expect(statSync(join(paths.output, "observations.json")).mode & 0o777).toBe(0o600);
    await expect(executeMarketSourceBatch({ ...paths, mode: "ingest" })).rejects.toThrow("output_already_exists");
  });

  posix("rejects an unselected source, wrong occupancy and arrivals beyond the selected horizon before outputs", async () => {
    for (const mutate of [
      (x: ReturnType<typeof bookingCapture>) => { x.source = "trivago-mcp"; },
      (x: ReturnType<typeof bookingCapture>) => { x.query.adults = 3; },
      (x: ReturnType<typeof bookingCapture>) => { x.query.checkInDate = "2026-12-08"; x.query.checkOutDate = "2026-12-09"; },
    ]) {
      const capture = bookingCapture(); mutate(capture);
      const paths = files({ ...fixture(), captures: [capture] });
      await expect(executeMarketSourceBatch({ ...paths, mode: "ingest" })).rejects.toBeInstanceOf(Error);
      expect(() => statSync(paths.output)).toThrow();
    }
  });

  posix("retains unknown-time Google observations without inventing source freshness or a nightly basis", async () => {
    const base = bookingCapture();
    const paths = files({ ...fixture(["google-visible"]), captures: [{
      source: "google-visible", collectedAt: null, query: base.query,
      payload: { captureContext: base.query, properties: [{ name: "Synthetic Google Hotel", offers: [{
        advertiser: "Synthetic OTA", price: { raw: "AED 314", currency: "AED", basis: "unknown" },
      }] }] },
    }] });
    const receipt = await executeMarketSourceBatch({ ...paths, mode: "ingest" });
    expect(receipt.candidates).toBe(1);
    const output = readFileSync(join(paths.output, "observations.json"), "utf8");
    expect(output).toContain("unknown-collection-time");
    expect(output).toContain('"collectedAt": null');
    expect(output).toContain('"basis": "unknown"');
  });

  posix("empty client source selection plans no work and performs no read", async () => {
    const paths = files(fixture([]));
    const receipt = await executeMarketSourceBatch({ ...paths, mode: "plan", fetch: (() => { throw new Error("unexpected-network"); }) as unknown as typeof fetch });
    expect(receipt.plannedQueries).toBe(0);
    expect(receipt.selectedQueries).toBe(0);
    expect(receipt.actualProviderHttpRequests).toBe(0);
  });

  posix("holds an incomplete visible search context without reporting usable market data", async () => {
    const base = bookingCapture();
    const paths = files({ ...fixture(["google-visible"]), captures: [{
      source: "google-visible", collectedAt: null, query: base.query,
      payload: { captureContext: { checkInDate: base.query.checkInDate }, properties: [{
        name: "Unverified Google Hotel", offers: [{ advertiser: "Synthetic OTA",
          price: { raw: "AED 314", currency: "AED", basis: "unknown" },
        }],
      }] },
    }] });
    const receipt = await executeMarketSourceBatch({ ...paths, mode: "ingest" });
    expect(receipt.status).toBe("blocked");
    expect(receipt.heldCaptures).toBe(1);
    expect(receipt.candidates).toBe(0);
    expect(receipt.actualProviderHttpRequests).toBe(0);
    expect(readFileSync(join(paths.output, "observations.json"), "utf8")).toContain("query-mismatch");
  });

  posix("Google live mode requires an explicit selected source and missing credentials do zero network work", async () => {
    const paths = files({ ...fixture(["google-hotels-serpapi"]), google: { propertyDetailLimit: 0, noCache: false } });
    const receipt = await executeMarketSourceBatch({ ...paths, mode: "google-live", now: () => "2026-09-08T19:00:00Z", fetch: (() => { throw new Error("unexpected-network"); }) as unknown as typeof fetch });
    expect(receipt.status).toBe("blocked");
    expect(receipt.readFailures).toEqual([{ source: "google-hotels-serpapi", kind: "missing-credential" }]);
    expect(receipt.actualProviderHttpRequests).toBe(0);
    const unselected = files({ ...fixture(), google: { propertyDetailLimit: 0, noCache: false } });
    await expect(executeMarketSourceBatch({ ...unselected, mode: "google-live", now: () => "2026-09-08T19:00:00Z" })).rejects.toThrow("google_source_not_selected");
  });

  posix("stops a Google batch after its first failed provider request and never persists the API key or error body", async () => {
    let calls = 0;
    const paths = files({ ...fixture(["google-hotels-serpapi"]), google: { propertyDetailLimit: 0, noCache: false } });
    const receipt = await executeMarketSourceBatch({
      ...paths, mode: "google-live", apiKey: "DO-NOT-PERSIST-KEY", now: () => "2026-09-08T19:00:00Z",
      fetch: (async () => { calls += 1; return new Response("DO-NOT-PERSIST-BODY", { status: 429 }); }) as unknown as typeof fetch,
    });
    expect(calls).toBe(1);
    expect(receipt.actualProviderHttpRequests).toBe(1);
    expect(receipt.status).toBe("blocked");
    for (const file of receipt.outputs) {
      const text = readFileSync(join(paths.output, file), "utf8");
      expect(text).not.toContain("DO-NOT-PERSIST");
    }
  });

  posix("Google live budgets executable Google work when the client also selected MCP sources", async () => {
    let calls = 0;
    const input = fixture(["booking-mcp", "google-hotels-serpapi"]);
    input.run.maxRequestsThisRun = 1;
    const paths = files({ ...input, google: { propertyDetailLimit: 0, noCache: false } });
    const receipt = await executeMarketSourceBatch({
      ...paths, mode: "google-live", apiKey: "synthetic-key", now: () => "2026-09-08T19:00:00Z",
      fetch: (async () => { calls += 1; return new Response("bounded failure", { status: 429 }); }) as unknown as typeof fetch,
    });
    expect(receipt.selectedQueries).toBe(1);
    expect(receipt.maximumProviderHttpRequests).toBe(1);
    expect(calls).toBe(1);
    expect(receipt.actualProviderHttpRequests).toBe(1);
    expect(receipt.status).toBe("blocked");
    const plan = JSON.parse(readFileSync(join(paths.output, "plan.json"), "utf8"));
    expect(plan.batches[0].requests[0].source).toBe("google-hotels-serpapi");
  });

  posix("rejects future collection times and unknown input configuration without effects", async () => {
    const future = bookingCapture(); future.collectedAt = "2026-09-09T01:00:00Z";
    const paths = files({ ...fixture(), captures: [future] });
    await expect(executeMarketSourceBatch({ ...paths, mode: "ingest" })).rejects.toThrow("capture_time_after_run");
    const extra = files({ ...fixture(), proxyUrl: "https://example.invalid" });
    await expect(executeMarketSourceBatch({ ...extra, mode: "plan" })).rejects.toThrow("unknown_input_field");
  });
});
