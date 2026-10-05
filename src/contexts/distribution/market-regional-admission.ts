/**
 * Pure byte admission for a server-owned regional-artifact catalog entry. This
 * callable cannot authenticate its caller: `expected` is deployment metadata that
 * the future server loader, not a browser request, must select and own.
 */
import {
  MARKET_REGIONAL_ARTIFACT_LIMITS,
  type MarketRegionalArtifact,
  type MarketRegionalArtifactResult,
  type MarketRegionalSourceMetadata,
  tryAdaptMarketRegionalArtifact,
} from "./market-regional-artifact";

export const MARKET_REGIONAL_ADMISSION_LIMITS = Object.freeze({
  maximumArtifactBytes: MARKET_REGIONAL_ARTIFACT_LIMITS.maximumUtf8Bytes,
  maximumLogicalIdScalars: 128,
  requiredSourceObjects: 16,
});

export const OVERTURE_REGIONAL_TRUSTED_MANIFEST = Object.freeze({
  sourceObjects: Object.freeze([
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00000-c7e47654-8483-5b8f-b183-7ba73334f7a5-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00001-01525d53-9fbf-5f59-aa2a-c557934aeb8a-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00002-06d0251d-44ae-5400-ab29-cb4457570b0d-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00003-9e8cf04e-9fcc-5346-af85-9883ac4821d8-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00004-e1b1066c-7a59-5692-b21d-7e03fafaf0a4-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00005-c7ae3183-76f1-5b61-bf21-1bc92b346aff-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00006-b9b7213b-ab21-565f-b7f2-a76b5761049c-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00007-738c130e-9a4b-5d01-b521-a3d872c8cef9-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00008-48f1e796-6516-5a3b-b151-9c452711a6cd-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00009-75d418fc-b352-5e47-8ce5-3bc2ca931c6e-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00010-828dba08-070e-5e87-b87c-239c122a6836-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00011-2adaedca-dc2e-5b18-9021-4627dfef54bc-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00012-09c98cd6-92ec-5fdb-9b89-0e796ab59604-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00013-9e35ed5a-ddda-5467-ac77-0d15242eb9fc-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00014-5fafa875-a2eb-5f25-80ec-8c003f666ae6-c000.zstd.parquet",
    "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-08-19.0/theme=places/type=place/part-00015-9dc40db3-3b1d-5e75-b9b5-1c218b3f1743-c000.zstd.parquet",
  ]),
  wheelSha256: "6826504277dba513c0c5d71d828456c94d729c9d2482f94b2e289f90a9167e28",
  httpfsSha256: "65661c40463e74751993e8a7cb7b4c8906be9218319616a0bdfc1b4ae9ffdf9a",
} as const);

export interface MarketRegionalExpectedArtifact {
  readonly logicalId: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly region: Readonly<{
    readonly minimumLatitude: number;
    readonly maximumLatitude: number;
    readonly minimumLongitude: number;
    readonly maximumLongitude: number;
  }>;
}

export interface MarketRegionalAdmission {
  readonly identity: MarketRegionalExpectedArtifact;
  readonly artifact: MarketRegionalArtifact;
}

export type MarketRegionalAdmissionResult = Readonly<
  | { readonly ok: true; readonly value: MarketRegionalAdmission }
  | { readonly ok: false; readonly error: Readonly<{
    readonly code: "invalid_market_regional_admission";
    readonly message: "Market regional artifact admission is invalid.";
  }> }
>;

const CONTROL = /[\u0000-\u001f\u007f]/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteLength")?.get;
const TYPED_ARRAY_BYTE_OFFSET = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteOffset")?.get;

type PlainRecord = Record<string, unknown>;

class AdmissionValidationError extends TypeError {}

function fail(message: string): never {
  throw new AdmissionValidationError(message);
}

function staticFailure(): MarketRegionalAdmissionResult {
  return Object.freeze({ ok: false as const, error: Object.freeze({
    code: "invalid_market_regional_admission" as const,
    message: "Market regional artifact admission is invalid." as const,
  }) });
}

function ownPlain(value: unknown, field: string, maximumKeys: number): PlainRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fail(`${field} must be a plain object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fail(`${field} must be a plain object`);
  const keys = Reflect.ownKeys(value);
  if (keys.length > maximumKeys || keys.some((key) => typeof key !== "string")) return fail(`${field} has too many fields`);
  const result: PlainRecord = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set || !descriptor.enumerable) {
      return fail(`${field} must not contain accessors`);
    }
    result[key as string] = descriptor.value;
  }
  return result;
}

function exactKeys(value: PlainRecord, keys: readonly string[], field: string): void {
  const allowed = new Set(keys);
  if (Object.keys(value).some((key) => !allowed.has(key)) || keys.some((key) => !Object.hasOwn(value, key))) {
    fail(`${field} has unexpected or missing fields`);
  }
}

function text(value: unknown, field: string, maximum: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum * 2 || value.trim().length === 0 || CONTROL.test(value)) {
    return fail(`${field} is invalid`);
  }
  let scalars = 0;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return fail(`${field} is not well-formed Unicode`);
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return fail(`${field} is not well-formed Unicode`);
    scalars += 1;
  }
  return scalars <= maximum ? value : fail(`${field} exceeds its scalar bound`);
}

function coordinate(value: unknown, field: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) return fail(`${field} is invalid`);
  return value;
}

function snapshotExpected(value: unknown): MarketRegionalExpectedArtifact {
  const row = ownPlain(value, "expected artifact", 4);
  exactKeys(row, ["logicalId", "byteLength", "sha256", "region"], "expected artifact");
  if (typeof row.byteLength !== "number" || !Number.isSafeInteger(row.byteLength) || row.byteLength <= 0
    || row.byteLength > MARKET_REGIONAL_ADMISSION_LIMITS.maximumArtifactBytes) return fail("expected artifact length is invalid");
  if (typeof row.sha256 !== "string" || !SHA256.test(row.sha256)) return fail("expected artifact hash is invalid");
  const region = ownPlain(row.region, "expected artifact region", 4);
  exactKeys(region, ["minimumLatitude", "maximumLatitude", "minimumLongitude", "maximumLongitude"], "expected artifact region");
  const snapshotRegion = Object.freeze({
    minimumLatitude: coordinate(region.minimumLatitude, "expected artifact region.minimumLatitude", -90, 90),
    maximumLatitude: coordinate(region.maximumLatitude, "expected artifact region.maximumLatitude", -90, 90),
    minimumLongitude: coordinate(region.minimumLongitude, "expected artifact region.minimumLongitude", -180, 180),
    maximumLongitude: coordinate(region.maximumLongitude, "expected artifact region.maximumLongitude", -180, 180),
  });
  if (snapshotRegion.minimumLatitude > snapshotRegion.maximumLatitude || snapshotRegion.minimumLongitude > snapshotRegion.maximumLongitude
    || snapshotRegion.maximumLatitude - snapshotRegion.minimumLatitude > 1 || snapshotRegion.maximumLongitude - snapshotRegion.minimumLongitude > 1) {
    return fail("expected artifact region is invalid");
  }
  return Object.freeze({
    logicalId: text(row.logicalId, "expected artifact logicalId", MARKET_REGIONAL_ADMISSION_LIMITS.maximumLogicalIdScalars),
    byteLength: row.byteLength,
    sha256: row.sha256,
    region: snapshotRegion,
  });
}

function snapshotBytes(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)) return fail("artifact bytes must be Uint8Array");
  if (!TYPED_ARRAY_BUFFER || !TYPED_ARRAY_BYTE_LENGTH || !TYPED_ARRAY_BYTE_OFFSET) return fail("TypedArray intrinsics are unavailable");
  // Own properties on a typed-array instance can shadow these names. Read the
  // intrinsic slots directly once, then copy from that exact non-shared view.
  const backing = TYPED_ARRAY_BUFFER.call(value);
  const byteLength = TYPED_ARRAY_BYTE_LENGTH.call(value);
  const byteOffset = TYPED_ARRAY_BYTE_OFFSET.call(value);
  if (typeof SharedArrayBuffer !== "undefined" && backing instanceof SharedArrayBuffer) return fail("shared artifact bytes are not admitted");
  if (!(backing instanceof ArrayBuffer) || byteLength === 0 || byteLength > MARKET_REGIONAL_ADMISSION_LIMITS.maximumArtifactBytes) {
    return fail("artifact bytes are invalid");
  }
  const source = new Uint8Array(backing, byteOffset, byteLength);
  const copy = new Uint8Array(byteLength);
  copy.set(source);
  return copy;
}

function sha256(bytes: Uint8Array): Promise<string> {
  const digestInput = Uint8Array.from(bytes).buffer;
  return crypto.subtle.digest("SHA-256", digestInput).then((digest) =>
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""));
}

function decodeUtf8(bytes: Uint8Array): string {
  if (bytes.byteLength >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return fail("artifact bytes contain a BOM");
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return fail("artifact bytes are not UTF-8");
  }
}

function equalRegion(left: MarketRegionalExpectedArtifact["region"], right: MarketRegionalSourceMetadata["region"]): boolean {
  return left.minimumLatitude === right.minimumLatitude && left.maximumLatitude === right.maximumLatitude
    && left.minimumLongitude === right.minimumLongitude && left.maximumLongitude === right.maximumLongitude;
}

function exactManifest(source: MarketRegionalSourceMetadata): boolean {
  return source.sourceObjects.length === OVERTURE_REGIONAL_TRUSTED_MANIFEST.sourceObjects.length
    && source.sourceObjects.every((url, index) => url === OVERTURE_REGIONAL_TRUSTED_MANIFEST.sourceObjects[index])
    && source.tool.duckdbVersion === "1.5.5"
    && source.tool.wheelSha256 === OVERTURE_REGIONAL_TRUSTED_MANIFEST.wheelSha256
    && source.tool.httpfsSha256 === OVERTURE_REGIONAL_TRUSTED_MANIFEST.httpfsSha256;
}

function admittedArtifact(value: MarketRegionalArtifactResult<MarketRegionalArtifact>): MarketRegionalArtifact {
  if (!value.ok || !exactManifest(value.value.source)) return fail("artifact provenance is invalid");
  return value.value;
}

/**
 * Admits only an already-supplied byte snapshot against server-owned expected metadata.
 * It performs no filesystem, HTTP, database, or caller authentication work.
 */
export async function tryAdmitMarketRegionalArtifact(bytes: unknown, expected: unknown): Promise<MarketRegionalAdmissionResult> {
  try {
    // Both mutable inputs are snapshotted before the first await.
    const ownedBytes = snapshotBytes(bytes);
    const identity = snapshotExpected(expected);
    const digest = await sha256(ownedBytes);
    if (ownedBytes.byteLength !== identity.byteLength || digest !== identity.sha256) return staticFailure();
    const artifact = admittedArtifact(tryAdaptMarketRegionalArtifact(decodeUtf8(ownedBytes)));
    if (!equalRegion(identity.region, artifact.source.region)) return staticFailure();
    return Object.freeze({ ok: true as const, value: Object.freeze({ identity, artifact }) });
  } catch {
    return staticFailure();
  }
}
