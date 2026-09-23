import { expect, test } from "bun:test";
import { CommercialTaxonomyService, parseCommercialTaxonomy, resolveCommercialAttribution } from "../src/contexts/reporting";
import type { Tx } from "../src/kernel";

const TENANT = "00000000-0000-4000-8000-000000000001";
const PROPERTY = "00000000-0000-4000-8000-000000000002";
const TATA = "00000000-0000-4000-8000-000000000003";
const TATA_PARENT = "00000000-0000-4000-8000-000000000004";
const DELUXE = "00000000-0000-4000-8000-000000000005";

const CONTENT = Object.freeze({
  demandGroups: [
    { code: "CORP", label: "Corporate", segments: [{ code: "NEGOTIATED", label: "Negotiated corporate" }] },
    { code: "OTA", label: "Online travel agencies", segments: [{ code: "OTA_RETAIL", label: "Retail OTA" }] },
    { code: "GROUPS", label: "Groups and MICE", segments: [
      { code: "CORP_GROUP", label: "Corporate group" }, { code: "SOCIAL", label: "Social group" },
      { code: "DEFENCE", label: "Defence group" }, { code: "INCENTIVE", label: "Incentive group" },
    ] },
  ],
  distributionGroups: [
    { code: "DIRECT", label: "Direct", sources: [{ code: "WEBSITE", label: "Website", channelCodes: ["DIRECT_WEB"] }] },
    { code: "OTA", label: "OTA", sources: [
      { code: "BOOKING", label: "Booking.com", channelCodes: ["BOOKING_COM"] },
      { code: "AGODA", label: "Agoda", channelCodes: ["AGODA"] },
    ] },
  ],
  companies: [
    { code: "TATA_GROUP", label: "Tata Group", partyId: TATA_PARENT, parentCode: null },
    { code: "TATA_MUMBAI", label: "Tata Mumbai", partyId: TATA, parentCode: "TATA_GROUP" },
  ],
  roomClasses: [{ code: "DELUXE", label: "Deluxe", unitTypeIds: [DELUXE] }],
  marketMappings: [
    { marketCode: "CORP_NEG", segmentCode: "NEGOTIATED" },
    { marketCode: "OTA", segmentCode: "OTA_RETAIL" },
    { marketCode: "MICE_SOCIAL", segmentCode: "SOCIAL" },
  ],
});

test("commercial attribution preserves MSG to MS and independent intersections", () => {
  const taxonomy = parseCommercialTaxonomy(CONTENT, 7);
  const result = resolveCommercialAttribution(taxonomy, {
    marketCode: "corp_neg", sourceCode: "booking", channelCode: "booking_com",
    bookerPartyId: TATA, unitTypeId: DELUXE,
  });
  expect(result).toMatchObject({ version: 7,
    demand: { group: { code: "CORP" }, segment: { code: "NEGOTIATED" } },
    distribution: { group: { code: "OTA" }, source: { code: "BOOKING" }, channelCode: { code: "BOOKING_COM" } },
    account: { company: { code: "TATA_MUMBAI" } }, product: { roomClass: { code: "DELUXE" }, unitTypeId: { code: DELUXE } },
  });
  expect(result.demand.segment.reason).toBeNull();
  expect(result.distribution.source.reason).toBeNull();
});

test("commercial attribution emits stable Unmapped leaves and never guesses", () => {
  const taxonomy = parseCommercialTaxonomy(CONTENT, 2);
  const missing = resolveCommercialAttribution(taxonomy, {});
  expect(missing.demand.segment).toEqual({ code: "UNMAPPED", label: "Unmapped", reason: "MISSING_INPUT" });
  expect(missing.account.company.reason).toBe("MISSING_INPUT");
  const unknown = resolveCommercialAttribution(taxonomy, {
    marketCode: "UNKNOWN", sourceCode: "EXPEDIA", bookerPartyId: PROPERTY, unitTypeId: PROPERTY,
  });
  expect(unknown.demand.segment.reason).toBe("NO_MAPPING");
  expect(unknown.distribution.source.reason).toBe("NO_MAPPING");
  expect(unknown.account.company.reason).toBe("NO_MAPPING");
  expect(unknown.product.roomClass.reason).toBe("NO_MAPPING");
});

test("commercial taxonomy rejects duplicate mappings, unknown demand parents and company cycles", () => {
  expect(() => parseCommercialTaxonomy({ ...CONTENT,
    marketMappings: [...CONTENT.marketMappings, { marketCode: "OTA", segmentCode: "NEGOTIATED" }] }, 1))
    .toThrow("duplicate OTA");
  expect(() => parseCommercialTaxonomy({ ...CONTENT,
    marketMappings: [{ marketCode: "BAD", segmentCode: "NOT_A_SEGMENT" }] }, 1))
    .toThrow("unknown segment NOT_A_SEGMENT");
  expect(() => parseCommercialTaxonomy({ ...CONTENT, companies: [
    { code: "A", label: "A", partyId: TATA, parentCode: "B" },
    { code: "B", label: "B", partyId: TATA_PARENT, parentCode: "A" },
  ] }, 1)).toThrow("contains a cycle");
});

test("commercial taxonomy rejects conflicting source and channel evidence", () => {
  const taxonomy = parseCommercialTaxonomy(CONTENT, 1);
  expect(() => resolveCommercialAttribution(taxonomy, { sourceCode: "BOOKING", channelCode: "AGODA" }))
    .toThrow("source BOOKING conflicts with channel AGODA");
  expect(() => resolveCommercialAttribution(taxonomy, { sourceCode: "EXPEDIA", channelCode: "BOOKING_COM" }))
    .toThrow("source EXPEDIA is not configured");
  expect(() => resolveCommercialAttribution(taxonomy, { sourceCode: "WEBSITE", channelCode: "UNKNOWN" }))
    .toThrow("channel UNKNOWN is not configured");
  expect(resolveCommercialAttribution(taxonomy, { channelCode: "UNKNOWN" }).distribution.channelCode.reason)
    .toBe("NO_MAPPING");
  expect(() => resolveCommercialAttribution(taxonomy, { sourceCode: "bad/source", channelCode: "BOOKING_COM" }))
    .toThrow("must both be valid configured codes");
  expect(() => resolveCommercialAttribution(taxonomy, { sourceCode: "WEBSITE", channelCode: "bad/channel" }))
    .toThrow("must both be valid configured codes");
  expect(() => resolveCommercialAttribution(taxonomy,
    { sourceCode: 42 as unknown as string, channelCode: "BOOKING_COM" }))
    .toThrow("must both be valid configured codes");
  expect(resolveCommercialAttribution(taxonomy, { sourceCode: "bad/source" }).distribution.source.reason)
    .toBe("NO_MAPPING");
});

test("commercial taxonomy reserves Unmapped and refuses hidden structural fields", () => {
  expect(() => parseCommercialTaxonomy({ ...CONTENT, demandGroups: [
    { code: "UNMAPPED", label: "Bad", segments: [{ code: "BAD", label: "Bad" }] },
  ] }, 1)).toThrow("reserved code UNMAPPED");
  expect(() => parseCommercialTaxonomy({ ...CONTENT, demandGroups: [
    { code: "CORP", label: "Corporate", segments: [{ code: "NEGOTIATED", label: "Negotiated", parentCode: "OTA" }] },
  ] }, 1)).toThrow("unsupported field parentCode");
  const taxonomy = parseCommercialTaxonomy(CONTENT, 1);
  const unknownUnit = resolveCommercialAttribution(taxonomy, { unitTypeId: PROPERTY });
  expect(unknownUnit.product.unitTypeId.reason).toBe("NO_MAPPING");
});

test("commercial taxonomy load is tenant/property/effective scoped and refuses overlap", async () => {
  let query = "";
  const tx = (async (strings: TemplateStringsArray) => {
    query = strings.raw.join("?");
    return [{ version: 4, content: CONTENT }];
  }) as unknown as Tx;
  const loaded = await new CommercialTaxonomyService().load(tx, { tenantId: TENANT, propertyNode: PROPERTY });
  expect(loaded.version).toBe(4);
  expect(query).toContain("current_setting('app.tenant_id', true)");
  expect(query).toContain("effective @> transaction_timestamp()");
  expect(query).toContain("LIMIT 2");

  const overlap = (async () => [{ version: 4, content: CONTENT }, { version: 3, content: CONTENT }]) as unknown as Tx;
  await expect(new CommercialTaxonomyService().load(overlap, { tenantId: TENANT, propertyNode: PROPERTY }))
    .rejects.toThrow("overlapping active versions");
});

test("commercial taxonomy rejects malformed scope identifiers before SQL", async () => {
  let touched = false;
  const tx = (async () => { touched = true; return []; }) as unknown as Tx;
  await expect(new CommercialTaxonomyService().load(tx, { tenantId: "not-a-uuid", propertyNode: PROPERTY }))
    .rejects.toThrow("must be UUIDs");
  expect(touched).toBe(false);
});
