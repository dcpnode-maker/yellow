import { describe, expect, test } from "bun:test";
import {
  canonicalPropertyAmenityKey,
  composePropertyProfileEvidence,
  type PropertyProfileObservation,
} from "../src/contexts/distribution/property-profile-candidate-evidence";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function observation(input: Partial<PropertyProfileObservation> & Pick<PropertyProfileObservation, "identity">): PropertyProfileObservation {
  return {
    source: {
      sourceUrl: "https://official.example/hotel",
      finalUrl: "https://official.example/hotel",
      httpStatus: 200,
      capturedAt: "2026-09-30T10:00:00.000Z",
      sourceUpdatedAt: null,
      contentSha256: HASH_A,
    },
    explicitAliases: [],
    name: "Aketa Dehradun",
    address: "Dehradun",
    amenities: [],
    images: [],
    sourcePath: "$.jsonld[0]",
    ...input,
    identity: { ...input.identity },
  };
}

const primary = { provider: "google.com", accountNamespace: null, externalId: "google:listing-1" };
const ota = { provider: "booking.com", accountNamespace: null, externalId: "https://www.booking.com/hotel/in/aketa.html" };

describe("property profile candidate evidence", () => {
  test("amenity mappings are deliberately narrow and retain unsupported source labels", () => {
    expect(canonicalPropertyAmenityKey("Free Wi-Fi")).toBe("wireless_internet");
    expect(canonicalPropertyAmenityKey("Air Conditioning")).toBe("air_conditioning");
    expect(canonicalPropertyAmenityKey("Free parking")).toBe("free_parking");
    expect(canonicalPropertyAmenityKey("Parking")).toBeNull();
    expect(canonicalPropertyAmenityKey("Heated private pool")).toBeNull();
  });

  test("provider and account namespaces prevent identifier collisions", () => {
    const result = composePropertyProfileEvidence({ observations: [
      observation({ identity: primary }),
      observation({ identity: { provider: "google.com", accountNamespace: "connection-2", externalId: "google:listing-1" } }),
      observation({ identity: { provider: "booking.com", accountNamespace: null, externalId: "google:listing-1" } }),
    ] });
    expect(result.issues).toEqual([]);
    expect(result.drafts).toHaveLength(3);
    expect(result.drafts.map(item => item.identities[0]?.provider).sort()).toEqual(["booking.com", "google.com", "google.com"]);
  });

  test("only explicit aliases connect identities; same-name properties stay separate", () => {
    const anchor = observation({ identity: primary, explicitAliases: [ota] });
    const sameName = observation({
      identity: { provider: "other.example", accountNamespace: null, externalId: "same-name" },
      source: { ...anchor.source, finalUrl: "https://other.example/locanda", contentSha256: HASH_B },
      name: "Aketa Dehradun",
    });
    const result = composePropertyProfileEvidence({ observations: [sameName, anchor] });
    expect(result.drafts).toHaveLength(2);
    const linked = result.drafts.find(item => item.identities.some(identity => identity.provider === "booking.com"));
    expect(linked?.identities).toHaveLength(2);
    expect(linked?.observations).toHaveLength(1);
  });

  test("latest capture is selected deterministically, full history and conflicts remain, provider time stays unknown", () => {
    const older = observation({
      identity: primary,
      source: { sourceUrl: "https://official.example/hotel", finalUrl: "https://official.example/hotel", httpStatus: 200,
        capturedAt: "2026-09-30T10:00:00.123456Z", sourceUpdatedAt: null, contentSha256: HASH_A },
      name: "Aketa Hotel",
      amenities: [{ canonicalKey: "pool", name: "Pool", value: true, scope: "unknown", sourcePath: "$.amenityFeature[0].value" }],
    });
    const newer = observation({
      identity: primary,
      source: { ...older.source, capturedAt: "2026-09-30T10:00:00.123457Z", contentSha256: HASH_B },
      name: "Hotel Aketa",
      amenities: [{ canonicalKey: "pool", name: "Pool", value: false, scope: "unknown", sourcePath: "$.amenityFeature[0].value" },
        { canonicalKey: null, name: "Gym", value: null, scope: "unknown", sourcePath: "$.amenityFeature[1].value" }],
      images: [{ url: "https://cdn.example/room.jpg?width=1200", width: null, height: 800, rightsStatus: "unknown", sourcePath: "$.image[0]" }],
    });
    const result = composePropertyProfileEvidence({ observations: [newer, older] });
    const draft = result.drafts[0]!;
    expect(draft.observations).toHaveLength(2);
    expect(draft.selected.name?.value).toBe("Hotel Aketa");
    expect(draft.selected.name?.sourceUpdatedAt).toBeNull();
    expect(draft.amenityEvidence.map(item => item.value)).toEqual([true, false, null]);
    expect(draft.selectedAmenities.find(item => item.canonicalKey === "pool")?.value).toBe(false);
    expect(draft.conflicts.map(item => [item.field, item.key])).toContainEqual(["amenity", "pool"]);
    expect(draft.conflicts.map(item => item.field)).toContain("name");
    expect(draft.imageEvidence[0]?.value).toEqual({
      url: "https://cdn.example/room.jpg?width=1200", width: null, height: 800, rightsStatus: "unknown",
    });
    expect(draft.authority).toBe("unverified-source-candidate");
  });

  test("ties in identical provenance are input-order independent and unmapped amenity conflicts normalize", () => {
    const common = {
      source: {
        sourceUrl: "https://official.example/hotel?id=1",
        finalUrl: "https://official.example/hotel?id=1",
        httpStatus: 200,
        capturedAt: "2026-09-30T10:00:00.123456Z",
        sourceUpdatedAt: null,
        contentSha256: HASH_A,
      },
      sourcePath: "$.jsonld[0]",
    };
    const alpha = observation({
      ...common, identity: primary, name: "Alpha", address: "Address",
      amenities: [{ canonicalKey: null, name: "Gym", value: true, scope: "unknown", sourcePath: "$.amenity[0]" }],
    });
    const zulu = observation({
      ...common, identity: primary, name: "Zulu", address: "Address",
      amenities: [{ canonicalKey: null, name: "GYM", value: false, scope: "unknown", sourcePath: "$.amenity[1]" }],
    });
    const forward = composePropertyProfileEvidence({ observations: [alpha, zulu] }).drafts[0]!;
    const reverse = composePropertyProfileEvidence({ observations: [zulu, alpha] }).drafts[0]!;
    expect(forward.selected.name?.value).toBe(reverse.selected.name?.value);
    expect(forward.selected.name?.value).toBe("Alpha");
    expect(forward.conflicts).toEqual(reverse.conflicts);
    expect(forward.conflicts).toContainEqual(expect.objectContaining({ field: "amenity", key: "unmapped:gym" }));
  });

  test("input mutation after composition cannot change the deep snapshot", () => {
    const raw = observation({ identity: primary, amenities: [{ canonicalKey: "pool", name: "Pool", value: true, scope: "unknown", sourcePath: "x" }] });
    const result = composePropertyProfileEvidence({ observations: [raw] });
    (raw.identity as { provider: string }).provider = "mutated";
    (raw.amenities[0] as { value: boolean | null }).value = false;
    expect(result.drafts[0]?.identities[0]?.provider).toBe("google.com");
    expect(result.drafts[0]?.amenityEvidence[0]?.value).toBe(true);
    expect(Object.isFrozen(result.drafts[0]?.observations[0]?.identity)).toBe(true);
  });

  test("invalid provenance is rejected as a whole instead of partially composing", () => {
    const valid = observation({ identity: primary });
    const invalid = observation({
      identity: { provider: " ", accountNamespace: null, externalId: "bad" },
    });
    const result = composePropertyProfileEvidence({ observations: [valid, invalid] });
    expect(result.drafts).toEqual([]);
    expect(result.issues).toContainEqual({ code: "invalid-identity", observationIndex: 1, path: "observations[1].identity" });
  });

  test("composer validates every URL boundary and rejects impossible calendar instants", () => {
    const base = observation({ identity: primary });
    for (const malformed of [
      { ...base, source: { ...base.source, sourceUrl: "javascript:alert(1)" } },
      { ...base, source: { ...base.source, finalUrl: "http://official.example/hotel" } },
      { ...base, source: { ...base.source, sourceUrl: "https://official.example/a\nb" } },
      { ...base, source: { ...base.source, finalUrl: "https://official.example/a b" } },
      { ...base, source: { ...base.source, finalUrl: "https://official.example/a\tb" } },
      { ...base, source: { ...base.source, finalUrl: "https://official.example/a\rb" } },
      { ...base, images: [{ url: "javascript:alert(1)", width: null, height: null, rightsStatus: "unknown" as const, sourcePath: "x" }] },
      { ...base, source: { ...base.source, capturedAt: "2026-02-30T10:00:00Z" } },
      { ...base, source: { ...base.source, sourceUpdatedAt: "2026-02-30T10:00:00Z" } },
    ]) {
      const result = composePropertyProfileEvidence({ observations: [malformed] });
      expect(result.drafts).toEqual([]);
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  test("rejects getter and cyclic input before reading any evidence", () => {
    const base = observation({ identity: primary });
    let getterCalls = 0;
    const withGetter = Object.defineProperty({}, "observations", {
      enumerable: true,
      get() { getterCalls += 1; return [base]; },
    });
    expect(composePropertyProfileEvidence(withGetter).drafts).toEqual([]);
    expect(getterCalls).toBe(0);

    const cyclic: Record<string, unknown> = { observations: [] };
    cyclic.self = cyclic;
    expect(composePropertyProfileEvidence(cyclic).drafts).toEqual([]);
  });
});
