import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  executeMarketJsonIntake,
  MARKET_JSON_INTAKE_LIMITS,
  normalizeMarketJsonIntake,
  normalizeMarketJsonIntakeBytes,
  type MarketJsonIntakeError,
} from "../scripts/research/market-json-intake";

const temporaryRoots: string[] = [];
afterEach(() => { for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const query = {
  destination: "Dubai, United Arab Emirates",
  checkInDate: "2026-10-05",
  checkOutDate: "2026-10-08",
  adults: 2,
  rooms: 1,
  childrenAges: [] as number[],
  currency: "AED",
  pointOfSaleMarket: "AE",
  language: "en",
};

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "yellow.market-json-intake/v1",
    source: "booking-mcp",
    query: { ...query },
    collectedAt: "2026-10-04T13:15:10Z",
    payload: { accommodations: [{
      id: "stay-001",
      name: "Example Hotel",
      url: "https://www.booking.com/hotel/ae/example.html?token=SECRET-IN-URL",
      price: { book: 1234.5, currency: "AED" },
      taxesAndFeesText: null,
      unrecognizedPrivateField: "DO-NOT-OUTPUT",
    }] },
    ...overrides,
  };
}

function expectIntakeError(action: () => unknown, code: string) {
  try { action(); } catch (error) {
    expect((error as MarketJsonIntakeError).code).toBe(code);
    return;
  }
  throw new Error(`expected intake error ${code}`);
}

describe("Order705 bounded market JSON intake", () => {
  test("normalizes a Booking-shaped capture to allowlisted fields, exact minor units, and provenance", () => {
    const normalized = normalizeMarketJsonIntake(envelope());
    expect(normalized.status).toBe("complete");
    expect(normalized.operationalWrites).toBe(false);
    expect(normalized.automaticPricingEligible).toBe(false);
    expect(normalized.collectedAt).toBe("2026-10-04T13:15:10Z");
    expect(normalized.query).toEqual(query);
    expect(normalized.candidates).toHaveLength(1);
    expect(normalized.candidates[0]?.price).toEqual({ raw: "1234.5", amountMinor: "123450", currency: "AED", basis: "reported-book-price" });
    expect(normalized.candidates[0]?.comparisonAuthority).toBe("search-candidate-only");
    expect(normalized.candidates[0]?.automaticPricingEligible).toBe(false);
    expect(normalized.candidates[0]?.sourceUpdatedAt).toBeNull();
    expect(normalized.candidates[0]?.taxesAndFeesText).toBeNull();
    expect(normalized.candidates[0]?.taxesIncluded).toBeNull();
    expect(normalized.candidates[0]?.feesIncluded).toBeNull();
    const output = JSON.stringify(normalized);
    expect(output).not.toContain("DO-NOT-OUTPUT");
    expect(output).not.toContain("SECRET-IN-URL");
  });

  test("rejects malformed JSON, oversized bytes, unknown source, envelope/query fields, and invalid time", () => {
    expectIntakeError(() => normalizeMarketJsonIntakeBytes(new TextEncoder().encode("{")), "invalid_input_json");
    expectIntakeError(() => normalizeMarketJsonIntakeBytes(new Uint8Array(MARKET_JSON_INTAKE_LIMITS.maxInputBytes + 1)), "input_too_large");
    expectIntakeError(() => normalizeMarketJsonIntake(envelope({ source: "unverified-mobile" })), "unknown_source");
    expectIntakeError(() => normalizeMarketJsonIntake(envelope({ extraCredential: "secret" })), "invalid_envelope_fields");
    expectIntakeError(() => normalizeMarketJsonIntake(envelope({ query: { ...query, tenantId: "private" } })), "invalid_query_fields");
    expectIntakeError(() => normalizeMarketJsonIntake(envelope({ collectedAt: "2026-02-30T13:15:10Z" })), "invalid_capture_metadata");
  });

  test("keeps source context mismatches and invalid money as explicit blocked issues", () => {
    const mismatch = normalizeMarketJsonIntake(envelope({ payload: { accommodations: [{
      accommodation_id: "a1", accommodation_name: "Hotel", arrival: "2026-10-06", departure: "2026-10-08",
      currency: "AED", price_per_night: "AED 100",
    }] }, source: "trivago-mcp" }));
    expect(mismatch.status).toBe("blocked");
    expect(mismatch.candidates).toHaveLength(0);
    expect(mismatch.issues.map((issue) => issue.code)).toContain("query-mismatch");

    const badPrice = normalizeMarketJsonIntake(envelope({ payload: { accommodations: [{
      id: "a1", name: "Hotel", price: { book: 100, currency: "USD" },
    }] } }));
    expect(badPrice.status).toBe("blocked");
    expect(badPrice.issues.map((issue) => issue.code)).toContain("invalid-price");
  });

  test("preserves Google-visible query/collection timestamps and unknown nightly basis", () => {
    const googleQuery = { ...query, pointOfSaleMarket: "AE" };
    const visible = normalizeMarketJsonIntake(envelope({
      source: "google-visible",
      collectedAt: null,
      query: googleQuery,
      payload: { captureContext: { ...googleQuery, queriedAt: "2026-10-04T13:10:00Z" }, properties: [{
        name: "Visible Hotel", offers: [{ advertiser: "Example OTA", price: { raw: "AED 99", currency: "AED", basis: "unknown" } }],
      }] },
    }));
    expect(visible.status).toBe("partial");
    expect(visible.collectedAt).toBeNull();
    expect(visible.issues.map((issue) => issue.code)).toContain("unknown-collection-time");
    expect(visible.candidates[0]?.queriedAt).toBe("2026-10-04T13:10:00Z");
    expect(visible.candidates[0]?.price.basis).toBe("unknown");
    expect(visible.candidates[0]?.price.amountMinor).toBe("9900");
  });

  test("caps normalized records using the existing adapter bound", () => {
    const accommodations = Array.from({ length: MARKET_JSON_INTAKE_LIMITS.maxCandidates + 1 }, (_, index) => ({
      id: `property-${index}`, name: `Hotel ${index}`, price: { book: 100 + index, currency: "AED" },
    }));
    const normalized = normalizeMarketJsonIntake(envelope({ payload: { accommodations } }));
    expect(normalized.status).toBe("partial");
    expect(normalized.candidates).toHaveLength(MARKET_JSON_INTAKE_LIMITS.maxCandidates);
    expect(normalized.issues.map((issue) => issue.code)).toContain("candidate-limit");
  });

  test("supports stdin and bounded regular local file modes with JSON-only stdout", async () => {
    const text = `${JSON.stringify(envelope())}\n`;
    const fromStdin = await executeMarketJsonIntake({ argv: [], stdin: new TextEncoder().encode(text) });
    expect(JSON.parse(fromStdin).candidates).toHaveLength(1);

    const root = mkdtempSync(join(tmpdir(), "yellow-order705-"));
    temporaryRoots.push(root);
    const inputPath = join(root, "capture.json");
    writeFileSync(inputPath, text, { mode: 0o600 });
    const fromFile = await executeMarketJsonIntake({ argv: ["--input", inputPath] });
    expect(fromFile).toBe(fromStdin);
    await expect(executeMarketJsonIntake({ argv: ["--input", inputPath, "--extra"] })).rejects.toMatchObject({ code: "invalid_cli_arguments" });
    await expect(executeMarketJsonIntake({ argv: ["--input", root] })).rejects.toMatchObject({ code: "input_file_not_regular" });
  });

  test("CLI emits only normalized JSON on stdout and sanitized diagnostics on stderr", () => {
    const script = join(import.meta.dir, "../scripts/research/market-json-intake.ts");
    const root = mkdtempSync(join(tmpdir(), "yellow-order705-cli-"));
    temporaryRoots.push(root);
    const goodPath = join(root, "good.json");
    const badPath = join(root, "bad.json");
    writeFileSync(goodPath, JSON.stringify(envelope()), { mode: 0o600 });
    writeFileSync(badPath, "DO-NOT-PRINT-THIS", { mode: 0o600 });
    const good = Bun.spawnSync({ cmd: [process.execPath, script, "--input", goodPath], stdout: "pipe", stderr: "pipe" });
    expect(good.exitCode).toBe(0);
    const stdout = good.stdout.toString();
    expect(JSON.parse(stdout).candidates[0].propertyName).toBe("Example Hotel");
    expect(stdout).not.toContain("DO-NOT-OUTPUT");
    expect(stdout).not.toContain("SECRET-IN-URL");
    expect(good.stderr.toString()).toBe("");

    const bad = Bun.spawnSync({ cmd: [process.execPath, script, "--input", badPath], stdout: "pipe", stderr: "pipe" });
    expect(bad.exitCode).toBe(1);
    expect(bad.stdout.toString()).toBe("");
    expect(bad.stderr.toString()).toContain("invalid_input_json");
    expect(bad.stderr.toString()).not.toContain("DO-NOT-PRINT-THIS");
  });
});
