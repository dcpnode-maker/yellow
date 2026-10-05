import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

import { describe, expect, test } from "bun:test";

import {
  MARKET_REGIONAL_ADMISSION_LIMITS,
  OVERTURE_REGIONAL_TRUSTED_MANIFEST,
  tryAdmitMarketRegionalArtifact,
} from "../src/contexts/distribution/market-regional-admission";

const encoder = new TextEncoder();

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "overture-point-001",
    name: "فندق الرياض",
    longitude: 46.6753,
    latitude: 24.7136,
    addresses: null,
    websites: ["https://hotel.example/stay"],
    categories: { primary: "hotel", alternate: null },
    operatingStatus: null,
    confidence: null,
    sources: null,
    sourceObject: OVERTURE_REGIONAL_TRUSTED_MANIFEST.sourceObjects[0],
    ...overrides,
  };
}

function artifact(overrides: Record<string, unknown> = {}) {
  return {
    format: "yellow/overture-region/v2",
    coordinateMethod: "source-wkb-point",
    release: "2026-08-19.0",
    sourceSchema: "v1.18.0",
    method: "publisher-range-extract",
    capturedAt: "2026-09-13T08:00:00.000Z",
    region: { minimumLatitude: 24.5, maximumLatitude: 25, minimumLongitude: 46.5, maximumLongitude: 47 },
    limit: 500,
    moreAvailable: false,
    rows: [row()],
    query: "SELECT source WKB points\nFROM read_parquet(?)\nLIMIT 501",
    sourceObjects: OVERTURE_REGIONAL_TRUSTED_MANIFEST.sourceObjects,
    tool: {
      duckdbVersion: "1.5.5",
      wheelSha256: OVERTURE_REGIONAL_TRUSTED_MANIFEST.wheelSha256,
      httpfsSha256: OVERTURE_REGIONAL_TRUSTED_MANIFEST.httpfsSha256,
    },
    ...overrides,
  };
}

function bytes(value: Record<string, unknown> = artifact()): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function expected(value: Uint8Array, overrides: Record<string, unknown> = {}) {
  return {
    logicalId: "overture-riyadh-20260913",
    byteLength: value.byteLength,
    sha256: createHash("sha256").update(value).digest("hex"),
    region: { minimumLatitude: 24.5, maximumLatitude: 25, minimumLongitude: 46.5, maximumLongitude: 47 },
    ...overrides,
  };
}

const failure = {
  ok: false,
  error: { code: "invalid_market_regional_admission", message: "Market regional artifact admission is invalid." },
} as const;

describe("Order472 immutable regional artifact admission", () => {
  test("snapshots bytes, hashes the exact input, and binds trusted identity, region, manifest, and tool pins", async () => {
    const input = bytes();
    const result = await tryAdmitMarketRegionalArtifact(input, expected(input));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected admission");
    expect(result.value.identity).toEqual(expected(input));
    expect(result.value.artifact.records[0]?.provenance.recordId).toBe("overture-point-001");
    expect(result.value.artifact.source.sourceObjects).toEqual(OVERTURE_REGIONAL_TRUSTED_MANIFEST.sourceObjects);
    expect(result.value.artifact.source.tool).toEqual({
      duckdbVersion: "1.5.5",
      wheelSha256: OVERTURE_REGIONAL_TRUSTED_MANIFEST.wheelSha256,
      httpfsSha256: OVERTURE_REGIONAL_TRUSTED_MANIFEST.httpfsSha256,
    });
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.identity)).toBe(true);
    expect(Object.isFrozen(result.value.artifact)).toBe(true);

    const padded = new Uint8Array(input.byteLength + 16);
    padded.set(input, 7);
    const view = padded.subarray(7, 7 + input.byteLength);
    const viewResult = await tryAdmitMarketRegionalArtifact(view, expected(view));
    expect(viewResult.ok).toBe(true);

    const nodeBuffer = Buffer.from(input);
    expect((await tryAdmitMarketRegionalArtifact(nodeBuffer, expected(nodeBuffer))).ok).toBe(true);
  });

  test("refuses mismatched trusted length, hash, region, truncation, and bounded growth", async () => {
    const input = bytes();
    for (const metadata of [
      expected(input, { byteLength: input.byteLength + 1 }),
      expected(input, { sha256: "0".repeat(64) }),
      expected(input, { region: { minimumLatitude: 24.4, maximumLatitude: 25, minimumLongitude: 46.5, maximumLongitude: 47 } }),
    ]) expect(await tryAdmitMarketRegionalArtifact(input, metadata)).toEqual(failure);
    expect(await tryAdmitMarketRegionalArtifact(input.subarray(0, input.byteLength - 1), expected(input))).toEqual(failure);
    const oversized = new Uint8Array(MARKET_REGIONAL_ADMISSION_LIMITS.maximumArtifactBytes + 1);
    expect(await tryAdmitMarketRegionalArtifact(oversized, expected(oversized))).toEqual(failure);
  });

  test("refuses malformed UTF-8, BOM, v1, forged publisher object UUIDs, and tool substitutions", async () => {
    const malformed = Uint8Array.of(0xff, 0xfe);
    expect(await tryAdmitMarketRegionalArtifact(malformed, expected(malformed))).toEqual(failure);
    const valid = bytes();
    const bom = Uint8Array.from([0xef, 0xbb, 0xbf, ...valid]);
    expect(await tryAdmitMarketRegionalArtifact(bom, expected(bom))).toEqual(failure);
    const v1 = bytes(artifact({ format: "yellow/overture-region/v1" }));
    expect(await tryAdmitMarketRegionalArtifact(v1, expected(v1))).toEqual(failure);
    const forged = OVERTURE_REGIONAL_TRUSTED_MANIFEST.sourceObjects.map((url, index) => index === 0
      ? url.replace("c7e47654-8483-5b8f-b183-7ba73334f7a5", "00000000-0000-4000-8000-000000000000") : url);
    const substituted = bytes(artifact({ sourceObjects: forged, rows: [row({ sourceObject: forged[0] })] }));
    expect(await tryAdmitMarketRegionalArtifact(substituted, expected(substituted))).toEqual(failure);
    const wrongTool = bytes(artifact({ tool: { duckdbVersion: "1.5.5", wheelSha256: "0".repeat(64), httpfsSha256: OVERTURE_REGIONAL_TRUSTED_MANIFEST.httpfsSha256 } }));
    expect(await tryAdmitMarketRegionalArtifact(wrongTool, expected(wrongTool))).toEqual(failure);
  });

  test("isolates mutable input and rejects SharedArrayBuffer and hostile metadata without invoking accessors", async () => {
    const input = bytes();
    const mutableExpected = expected(input);
    const pending = tryAdmitMarketRegionalArtifact(input, mutableExpected);
    input.fill(0);
    mutableExpected.logicalId = "mutated-after-admission";
    mutableExpected.region.minimumLatitude = -90;
    const snapshot = await pending;
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) throw new Error("expected copied input admission");
    expect(snapshot.value.artifact.records).toHaveLength(1);
    expect(snapshot.value.identity.logicalId).toBe("overture-riyadh-20260913");
    expect(snapshot.value.identity.region.minimumLatitude).toBe(24.5);

    let reads = 0;
    const hostile = expected(bytes());
    Object.defineProperty(hostile, "sha256", { enumerable: true, get: () => { reads += 1; return "0".repeat(64); } });
    expect(await tryAdmitMarketRegionalArtifact(bytes(), hostile)).toEqual(failure);
    expect(reads).toBe(0);

    if (typeof SharedArrayBuffer !== "undefined") {
      const shared = new Uint8Array(new SharedArrayBuffer(32));
      expect(await tryAdmitMarketRegionalArtifact(shared, expected(shared))).toEqual(failure);

      const shadowedShared = new Uint8Array(new SharedArrayBuffer(bytes().byteLength));
      shadowedShared.set(bytes());
      const shadowedExpected = expected(shadowedShared);
      Object.defineProperty(shadowedShared, "buffer", { value: new ArrayBuffer(0) });
      Object.defineProperty(shadowedShared, "byteLength", { get: () => shadowedShared.byteLength });
      expect(await tryAdmitMarketRegionalArtifact(shadowedShared, shadowedExpected)).toEqual(failure);
    }

    const shadowedNormal = bytes();
    const shadowedNormalExpected = expected(shadowedNormal);
    let byteLengthReads = 0;
    Object.defineProperty(shadowedNormal, "byteLength", { get: () => { byteLengthReads += 1; throw new Error("shadow getter"); } });
    Object.defineProperty(shadowedNormal, "buffer", { get: () => { throw new Error("shadow getter"); } });
    expect((await tryAdmitMarketRegionalArtifact(shadowedNormal, shadowedNormalExpected)).ok).toBe(true);
    expect(byteLengthReads).toBe(0);

    const dynamicLength = bytes();
    const dynamicLengthExpected = expected(dynamicLength);
    let dynamicLengthReads = 0;
    Object.defineProperty(dynamicLength, "byteLength", {
      get: () => { dynamicLengthReads += 1; return dynamicLengthReads === 1 ? 0 : Number.MAX_SAFE_INTEGER; },
    });
    expect((await tryAdmitMarketRegionalArtifact(dynamicLength, dynamicLengthExpected)).ok).toBe(true);
    expect(dynamicLengthReads).toBe(0);

    const detachable = bytes();
    const detachedExpected = expected(detachable);
    let detached = false;
    try {
      structuredClone(detachable.buffer, { transfer: [detachable.buffer] });
      detached = detachable.byteLength === 0;
    } catch {
      // The runtime need not expose transferable ArrayBuffers; normal inputs remain covered above.
    }
    if (detached) expect(await tryAdmitMarketRegionalArtifact(detachable, detachedExpected)).toEqual(failure);
  });
});
