import { describe, expect, test } from "bun:test";

import {
  MARKET_REGIONAL_ARTIFACT_LIMITS,
  tryAdaptMarketRegionalArtifact,
} from "../src/contexts/distribution/market-regional-artifact";
import type { MarketDiscoveryRecord } from "../src/contexts/distribution/market-discovery";

function sourceObjects(): string[] {
  return Array.from({ length: 16 }, (_, index) => {
    const part = String(index).padStart(5, "0");
    const suffix = String(index).padStart(12, "0");
    return `https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-${part}-00000000-0000-4000-8000-${suffix}-c000.zstd.parquet`;
  });
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "overture-place-001",
    name: "فندق النخلة 🏨",
    longitude: 55.2708,
    latitude: 25.2048,
    addresses: [{ freeform: "دبي، الإمارات العربية المتحدة", postcode: "" }],
    websites: ["https://hotel.example/stay"],
    categories: { primary: "hotel", alternate: ["lodging"] },
    operatingStatus: "open",
    confidence: 0.8,
    sources: [{ dataset: "places", record: "source-001", property: "" }],
    sourceObject: sourceObjects()[0],
    ...overrides,
  };
}

function artifact(overrides: Record<string, unknown> = {}) {
  return {
    format: "yellow/overture-region/v2",
    release: "2026-08-19.0",
    sourceSchema: "v1.18.0",
    method: "publisher-range-extract",
    coordinateMethod: "source-wkb-point",
    capturedAt: "2026-09-13T06:00:00.000Z",
    region: { minimumLatitude: 25, maximumLatitude: 26, minimumLongitude: 55, maximumLongitude: 56 },
    limit: 500,
    moreAvailable: false,
    rows: [row()],
    query: "SELECT bounded publisher fields\nFROM read_parquet(?)\nWHERE longitude BETWEEN ? AND ?",
    sourceObjects: sourceObjects(),
    tool: {
      duckdbVersion: "1.5.5",
      wheelSha256: "a".repeat(64),
      httpfsSha256: "b".repeat(64),
    },
    ...overrides,
  };
}

function adapt(value: Record<string, unknown> = artifact()) {
  return tryAdaptMarketRegionalArtifact(JSON.stringify(value));
}

describe("Order472 bounded Overture regional artifacts", () => {
  test("normalizes fixed Overture provenance while preserving bounded raw source evidence", () => {
    const result = adapt();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected valid artifact");
    expect(result.value.records).toEqual([{
      provenance: {
        source: "overture",
        release: "2026-08-19.0",
        schema: "v1.18.0",
        recordId: "overture-place-001",
        attribution: "Overture Maps Foundation; source-specific attribution: https://docs.overturemaps.org/attribution/",
      },
      name: "فندق النخلة 🏨",
      coordinates: { latitude: 25.2048, longitude: 55.2708 },
      address: null,
      websites: ["https://hotel.example/stay"],
      categories: ["hotel", "lodging"],
      operatingStatus: "unknown",
    }]);
    expect(result.value.rawRows[0]?.operatingStatus).toBe("open");
    expect(result.value.rawRows[0]?.addresses).toEqual([{ freeform: "دبي، الإمارات العربية المتحدة", postcode: "" }]);
    expect(result.value.rawRows[0]?.sources).toEqual([{ dataset: "places", record: "source-001", property: "" }]);
    expect(result.value.completeness).toEqual({
      scope: "publisher-range-extract-all-places", status: "complete", sourceRows: 1, returnedRecords: 1, rejectedRows: 0,
    });
    expect(result.value.fieldExclusions).toEqual([{ rowIndex: 0, field: "address", reason: "raw-evidence-only" }]);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.records)).toBe(true);
    expect(Object.isFrozen(result.value.rawRows)).toBe(true);
    expect(Object.isFrozen(result.value.source.sourceObjects)).toBe(true);
  });

  test("fails closed for malformed JSON, bounds, envelope drift, and unapproved source objects", () => {
    for (const content of ["{", "[]", "x".repeat(MARKET_REGIONAL_ARTIFACT_LIMITS.maximumUtf8Bytes + 1)]) {
      expect(tryAdaptMarketRegionalArtifact(content)).toEqual({ ok: false, error: {
        code: "invalid_market_regional_artifact", message: "Market regional artifact is invalid.",
      } });
    }
    expect(adapt(artifact({ extra: true }))).toMatchObject({ ok: false });
    expect(adapt(artifact({ format: "yellow/overture-region/v1" }))).toMatchObject({ ok: false });
    expect(adapt(artifact({ coordinateMethod: "bbox-minimum" }))).toMatchObject({ ok: false });
    const missingCoordinateMethod: Record<string, unknown> = artifact();
    delete missingCoordinateMethod.coordinateMethod;
    expect(adapt(missingCoordinateMethod)).toMatchObject({ ok: false });
    expect(adapt(artifact({ moreAvailable: true }))).toMatchObject({ ok: false });
    expect(adapt(artifact({ region: { minimumLatitude: 0, maximumLatitude: 1.0001, minimumLongitude: 0, maximumLongitude: 1 } }))).toMatchObject({ ok: false });
    expect(adapt(artifact({ sourceObjects: sourceObjects().slice(0, 15) }))).toMatchObject({ ok: false });
    expect(adapt(artifact({ sourceObjects: sourceObjects().map((item) => item.replace("part-00000", "part-00016")) }))).toMatchObject({ ok: false });
    const unapprovedRow = adapt(artifact({ rows: [row({ sourceObject: "https://untrusted.example/part-00000-c000.zstd.parquet" })] }));
    expect(unapprovedRow.ok).toBe(true);
    if (!unapprovedRow.ok) throw new Error("expected row rejection");
    expect(unapprovedRow.value.rejectedRows).toEqual([{ rowIndex: 0, code: "invalid_core_row" }]);
  });

  test("returns cap-plus-one artifacts as incomplete and never claims rejected rows are full coverage", () => {
    const rows = Array.from({ length: 501 }, (_, index) => row({
      id: `overture-${String(index).padStart(3, "0")}`,
      sourceObject: sourceObjects()[index % sourceObjects().length],
    }));
    const incomplete = adapt(artifact({ moreAvailable: true, rows }));
    expect(incomplete.ok).toBe(true);
    if (!incomplete.ok) throw new Error("expected cap-plus-one artifact");
    expect(incomplete.value.records).toHaveLength(500);
    expect(incomplete.value.rawRows).toHaveLength(500);
    expect(incomplete.value.completeness).toEqual({
      scope: "publisher-range-extract-all-places", status: "incomplete", sourceRows: 501, returnedRecords: 500, rejectedRows: 0,
    });

    const rejected = adapt(artifact({ rows: [row(), row({ id: "overture-place-001", name: "conflicting" })] }));
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) throw new Error("expected rejected-row artifact");
    expect(rejected.value.records).toHaveLength(0);
    expect(rejected.value.rejectedRows).toEqual([
      { rowIndex: 0, code: "duplicate_source_record_id" },
      { rowIndex: 1, code: "duplicate_source_record_id" },
    ]);
    expect(rejected.value.completeness.status).toBe("incomplete");

    const sentinelRows = Array.from({ length: 501 }, (_, index) => row({
      id: `sentinel-${String(index).padStart(3, "0")}`,
      sourceObject: sourceObjects()[index % sourceObjects().length],
    }));
    sentinelRows[500] = row({ id: "sentinel-000", sourceObject: sourceObjects()[0] });
    const sentinelConflict = adapt(artifact({ moreAvailable: true, rows: sentinelRows }));
    expect(sentinelConflict.ok).toBe(true);
    if (!sentinelConflict.ok) throw new Error("expected sentinel conflict result");
    expect(sentinelConflict.value.records).toHaveLength(499);
    expect(sentinelConflict.value.rejectedRows).toEqual([
      { rowIndex: 0, code: "duplicate_source_record_id" },
      { rowIndex: 500, code: "duplicate_source_record_id" },
    ]);
  });

  test("enforces the inclusive non-wrapping artifact rectangle before returning a normalized record", () => {
    const edge = adapt(artifact({
      region: { minimumLatitude: -90, maximumLatitude: -90, minimumLongitude: -180, maximumLongitude: -180 },
      rows: [row({ latitude: -90, longitude: -180 })],
    }));
    expect(edge.ok).toBe(true);
    if (!edge.ok) throw new Error("expected inclusive geographic edge");
    expect(edge.value.records).toHaveLength(1);

    const outside = adapt(artifact({ rows: [row({ latitude: 24.9999 })] }));
    expect(outside.ok).toBe(true);
    if (!outside.ok) throw new Error("expected out-of-region rejection");
    expect(outside.value.rejectedRows).toEqual([{ rowIndex: 0, code: "invalid_core_row" }]);
    expect(outside.value.completeness.status).toBe("incomplete");
  });

  test("drops unsafe optional websites with non-sensitive exclusions and rejects malformed core rows", () => {
    const secret = "query-token-must-not-escape";
    const optional = adapt(artifact({ rows: [row({
      websites: ["http://hotel.example/", `https://hotel.example/?token=${secret}`, 7, "https://hotel.example/safe"],
      categories: null,
    })] }));
    expect(optional.ok).toBe(true);
    if (!optional.ok) throw new Error("expected optional exclusions");
    expect(optional.value.records[0]?.websites).toEqual(["https://hotel.example/safe"]);
    expect(optional.value.records[0]?.categories).toEqual([]);
    expect(optional.value.fieldExclusions).toEqual([
      { rowIndex: 0, field: "website", reason: "unsafe-or-invalid-optional-value" },
      { rowIndex: 0, field: "website", reason: "unsafe-or-invalid-optional-value" },
      { rowIndex: 0, field: "website", reason: "unsafe-or-invalid-optional-value" },
      { rowIndex: 0, field: "address", reason: "raw-evidence-only" },
    ]);
    expect(JSON.stringify(optional.value)).not.toContain(secret);

    const malformed = adapt(artifact({ rows: [row({ latitude: 91 }), row({ name: "bad\ud800" }), row({ unexpected: true })] }));
    expect(malformed.ok).toBe(true);
    if (!malformed.ok) throw new Error("expected rejected core rows");
    expect(malformed.value.records).toEqual([]);
    expect(malformed.value.rejectedRows).toEqual([
      { rowIndex: 0, code: "invalid_core_row" },
      { rowIndex: 1, code: "invalid_core_row" },
      { rowIndex: 2, code: "invalid_core_row" },
    ]);
    expect(malformed.value.completeness.status).toBe("incomplete");
  });

  test("does not accept caller property authority, mutable outputs, or raw duplicate IDs", () => {
    const unauthorized = adapt(artifact({ propertyId: "caller-controlled-property", rows: [row()] }));
    expect(unauthorized).toMatchObject({ ok: false });
    const result = adapt();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected artifact");
    expect("tenantId" in result.value).toBe(false);
    expect("propertyId" in result.value).toBe(false);
    expect("requiresConfirmation" in result.value).toBe(false);
    expect(() => (result.value.records as unknown as MarketDiscoveryRecord[]).push({} as never)).toThrow();
    expect(() => (result.value.rawRows as unknown as unknown[]).push({})).toThrow();
  });
});
