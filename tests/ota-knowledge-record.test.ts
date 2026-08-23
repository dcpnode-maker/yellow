import { describe, expect, test } from "bun:test";

import {
  canonicalOtaKnowledgeJson,
  normalizeOtaKnowledgeRecord,
  OTA_INTEGRATION_PATTERNS,
  OTA_RESEARCH_AUTHORITY,
  OtaKnowledgeError,
} from "../src/contexts/distribution";

function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    recordId: "booking-ari-2026-08-23",
    schemaVersion: 1,
    channel: { group: "Booking Holdings", brand: "Booking.com", role: "ota" },
    topic: "connectivity",
    claim: "The official interface documents certified rate, inventory and restriction writes.",
    evidenceState: "verified",
    source: {
      type: "official_api",
      title: "Rates and Availability API",
      url: "https://developers.example.test/connectivity/ari",
      retrievedAt: "2026-08-23T16:42:00.000+05:30",
    },
    observedAt: "2026-08-23T16:42:00.000+05:30",
    effectiveFrom: null,
    effectiveTo: null,
    reviewDueAt: "2026-11-23T09:00:00.000+05:30",
    confidenceBasisPoints: 9_800,
    applicability: {
      scope: "global",
      regions: ["Global", "Asia"],
      propertyTypes: ["hotel"],
      shopperContextKeys: [],
    },
    capability: {
      accessClass: "supplier_api_write",
      integrationPattern: "push_ari",
      authorization: "certification",
      documentedRead: true,
      documentedWrite: true,
      certificationRequired: true,
      version: "2026-08-23",
      granularity: ["stay_date", "rate_plan"],
      constraints: ["property entitlement required"],
      fallbacks: ["recommendation_only", "manual_extranet"],
    },
    unknowns: ["property-specific commercial terms"],
    rights: {
      permittedUses: ["retrieval", "research", "product_design"],
      containsPersonalData: false,
      containsContractData: false,
    },
    ...overrides,
  };
}

function nested(source: Record<string, unknown>, key: string, values: Record<string, unknown>): Record<string, unknown> {
  return { ...source, [key]: { ...(source[key] as Record<string, unknown>), ...values } };
}

function expectRecursivelyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectRecursivelyFrozen(child);
}

describe("Order 092 OTA research evidence contract", () => {
  test("P1: verified push-ARI research normalizes without execution authority", () => {
    const input = record();
    const before = structuredClone(input);
    const result = normalizeOtaKnowledgeRecord(input);
    expect(result).toMatchObject({
      recordId: "booking-ari-2026-08-23",
      schemaVersion: 1,
      evidenceState: "verified",
      confidenceBasisPoints: 9_800,
      source: { type: "official_api", retrievedAt: "2026-08-23T16:42:00.000+05:30" },
      capability: {
        integrationPattern: "push_ari",
        accessClass: "supplier_api_write",
        version: "2026-08-23",
      },
      authority: OTA_RESEARCH_AUTHORITY,
    });
    expect(result.applicability.regions).toEqual(["Asia", "Global"]);
    expect(result.capability.granularity).toEqual(["rate_plan", "stay_date"]);
    expect(result.capability.fallbacks).toEqual(["manual_extranet", "recommendation_only"]);
    expect(result.rights.permittedUses).toEqual(["product_design", "research", "retrieval"]);
    expectRecursivelyFrozen(result);
    expect(input).toEqual(before);
  });

  test("P2: archetypes are exact and buyer, lead and observations cannot escalate", () => {
    expect(OTA_INTEGRATION_PATTERNS).toContain("lead_marketplace");
    expect(OTA_INTEGRATION_PATTERNS).not.toContain("generic_ota");

    const lead = normalizeOtaKnowledgeRecord(nested(nested(nested(record({
      recordId: "furnished-finder-lead-2026-08-23",
      channel: { group: "Furnished Finder", brand: "Furnished Finder", role: "other" },
      topic: "other",
    }), "source", {
      type: "official_help",
      title: "Integrated property manager policy",
      url: "https://support.example.test/lead-marketplace",
    }), "capability", {
      accessClass: "partner_manual",
      integrationPattern: "lead_marketplace",
      authorization: "account_permission",
      documentedRead: true,
      documentedWrite: false,
      certificationRequired: false,
      version: null,
      granularity: ["lead", "listing", "month"],
    }), "applicability", { scope: "property_type", regions: ["United States"], propertyTypes: ["mid_term_rental"] }));
    expect(lead.capability.integrationPattern).toBe("lead_marketplace");
    expect(lead.authority.liveExecutionAuthority).toBe(false);

    const buyer = nested(record(), "capability", {
      accessClass: "api_read_book",
      integrationPattern: "buyer_distribution",
      authorization: "commercial_agreement",
      documentedRead: true,
      documentedWrite: false,
      version: "v1",
    });
    expect(normalizeOtaKnowledgeRecord(buyer).capability.integrationPattern).toBe("buyer_distribution");

    const metasearch = nested(record(), "capability", {
      accessClass: "pull_or_ad_feed",
      integrationPattern: "metasearch_feed",
      authorization: "commercial_agreement",
      documentedRead: true,
      documentedWrite: false,
      certificationRequired: false,
      version: "feed-v2",
    });
    expect(normalizeOtaKnowledgeRecord(metasearch).capability.integrationPattern).toBe("metasearch_feed");

    const invalid = [
      nested(lead as unknown as Record<string, unknown>, "capability", { accessClass: "supplier_api_write" }),
      nested(lead as unknown as Record<string, unknown>, "capability", { documentedWrite: true }),
      nested(buyer, "capability", { accessClass: "supplier_api_write" }),
      nested(nested(record(), "source", { type: "public_journey" }), "capability", { accessClass: "supplier_api_write" }),
      nested(record({ evidenceState: "inferred" }), "capability", { documentedWrite: true }),
      nested(record(), "capability", { authorization: "public" }),
      nested(record(), "capability", { version: null }),
    ];
    for (const candidate of invalid) expect(() => normalizeOtaKnowledgeRecord(candidate)).toThrow(OtaKnowledgeError);
  });

  test("P3: hostile shapes, dates, URLs, bounds and sensitive flags fail closed", () => {
    const extra = record({ unsupported: true });
    const missing = record();
    delete missing.recordId;
    const invalid = [
      extra,
      missing,
      record({ recordId: "UPPER CASE" }),
      record({ observedAt: "2026-02-30T12:00:00.000Z" }),
      record({ reviewDueAt: "2026-08-22T00:00:00.000Z" }),
      record({ effectiveFrom: "2026-09-01T00:00:00.000Z", effectiveTo: "2026-08-01T00:00:00.000Z" }),
      nested(record(), "source", { url: "http://developers.example.test/ari" }),
      nested(record(), "source", { url: "https://user:secret@developers.example.test/ari" }),
      nested(record(), "source", { url: "https://developers.example.test/ari#fragment" }),
      nested(record(), "source", { unsupported: true }),
      nested(record(), "applicability", { regions: ["Asia", "Asia"] }),
      nested(record(), "capability", { fallbacks: Array.from({ length: 33 }, (_, index) => `fallback-${index}`) }),
      nested(record(), "rights", { containsPersonalData: true }),
      nested(record(), "rights", { containsContractData: true }),
      record({ claim: "unsafe\u0000claim" }),
      record({ confidenceBasisPoints: 10_001 }),
    ];
    for (const candidate of invalid) expect(() => normalizeOtaKnowledgeRecord(candidate)).toThrow(OtaKnowledgeError);
  });

  test("P4: canonical JSON is stable, complete and materially discriminating", () => {
    const left = normalizeOtaKnowledgeRecord(record());
    const rightInput = record();
    (rightInput.applicability as Record<string, unknown>).regions = ["Asia", "Global"];
    (rightInput.capability as Record<string, unknown>).granularity = ["rate_plan", "stay_date"];
    (rightInput.rights as Record<string, unknown>).permittedUses = ["product_design", "research", "retrieval"];
    const right = normalizeOtaKnowledgeRecord(rightInput);
    expect(canonicalOtaKnowledgeJson(left)).toBe(canonicalOtaKnowledgeJson(right));
    expect(canonicalOtaKnowledgeJson(left)).not.toBe(canonicalOtaKnowledgeJson(
      normalizeOtaKnowledgeRecord(record({ claim: "A materially different atomic claim." })),
    ));
    const parsed = JSON.parse(canonicalOtaKnowledgeJson(left));
    expect(parsed).toMatchObject({
      source: { url: "https://developers.example.test/connectivity/ari" },
      applicability: { scope: "global" },
      unknowns: ["property-specific commercial terms"],
      authority: {
        researchOnly: true,
        liveExecutionAuthority: false,
        tenantContractAuthority: false,
        adapterCapabilityAuthority: false,
      },
    });
    expect(canonicalOtaKnowledgeJson(left)).not.toMatch(/credential|password|token|execute|publish/i);
  });
});
