import { describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readFileSync } from "node:fs";

import {
  APPROVED_SCENARIO_HASHES,
  SCENARIO_REVIEW_AS_OF_DATE,
  SCENARIO_REVIEW_VERSION,
  runScenarioReviewSeed,
} from "../scripts/seed-scenario-review";
import { compileScenarioFoundation } from "../scripts/generate-scenario-foundations";

describe("Order181 two-hotel scenario review seed contract", () => {
  test("approved manifests and fixed review boundary are exact", () => {
    const india = compileScenarioFoundation(JSON.parse(readFileSync(
      new URL("../fixtures/scenario-foundations/v1/india.json", import.meta.url), "utf8")) as unknown);
    const canada = compileScenarioFoundation(JSON.parse(readFileSync(
      new URL("../fixtures/scenario-foundations/v1/canada.json", import.meta.url), "utf8")) as unknown);
    expect({ [india.scenarioKey]: india.sourceHashSha256, [canada.scenarioKey]: canada.sourceHashSha256 })
      .toEqual(APPROVED_SCENARIO_HASHES);
    expect([india.dailyDemandInputs.length, canada.dailyDemandInputs.length]).toEqual([1_096, 1_096]);
    expect(SCENARIO_REVIEW_AS_OF_DATE).toBe("2026-08-26");
    expect(SCENARIO_REVIEW_VERSION).toBe("order181-v1");
  });

  const databaseUrl = process.env.YELLOW_SCENARIO_REVIEW_DATABASE_URL;
  if (process.env.YELLOW_REQUIRE_SCENARIO_REVIEW === "1" && !databaseUrl) {
    throw new Error("YELLOW_SCENARIO_REVIEW_DATABASE_URL is required by the Order181 proof");
  }
  const databaseTest = databaseUrl ? test : test.skip;
  databaseTest("fresh isolated database materialises exact cardinalities and exact replay", async () => {
    const first = await runScenarioReviewSeed({ databaseUrl: databaseUrl!, logger: () => undefined });
    expect(first.properties.map(({ propertyName, unitTypes, rooms, ratePlans, ratePrices,
      reservations, folios, charges }) => ({ propertyName, unitTypes, rooms, ratePlans, ratePrices,
      reservations, folios, charges }))).toEqual([
      { propertyName: "Riverstone Test Hotel", unitTypes: 5, rooms: 40, ratePlans: 8,
        ratePrices: 40, reservations: 1_096, folios: 12, charges: 12 },
      { propertyName: "Harbourlight Test Lodge", unitTypes: 5, rooms: 40, ratePlans: 8,
        ratePrices: 40, reservations: 1_096, folios: 12, charges: 12 },
    ]);
    const second = await runScenarioReviewSeed({ databaseUrl: databaseUrl!, logger: () => undefined });
    expect(second).toEqual(first);

    const sql = new SQL(databaseUrl!, { max: 1 });
    try {
      const proof = await sql<Array<{
        scenario_properties: number; grants: number; occupancy: number;
        reservation_facts: number; reservation_events: number; idempotency: number;
        journals: number; postings: number; unbalanced: number;
        payments: number; documents: number; groups: number; channels: number;
      }>>`
        SELECT
          (SELECT count(*)::int FROM org_node WHERE config @> '{"scenario_review":{"version":"order181-v1"}}') AS scenario_properties,
          (SELECT count(*)::int FROM user_role ur JOIN org_node p ON p.id=ur.scope_node AND p.tenant_id=ur.tenant_id WHERE p.config @> '{"scenario_review":{"version":"order181-v1"}}') AS grants,
          (SELECT count(*)::int FROM space_occupancy o JOIN reservation_segment s ON s.id=o.slot_ref AND s.tenant_id=o.tenant_id JOIN reservation r ON r.id=s.reservation_id AND r.tenant_id=s.tenant_id JOIN org_node p ON p.id=r.property_node AND p.tenant_id=r.tenant_id WHERE p.config @> '{"scenario_review":{"version":"order181-v1"}}') AS occupancy,
          (SELECT count(*)::int FROM fact_log f JOIN reservation r ON r.id=f.entity_id AND r.tenant_id=f.tenant_id JOIN org_node p ON p.id=r.property_node AND p.tenant_id=r.tenant_id WHERE p.config @> '{"scenario_review":{"version":"order181-v1"}}' AND f.entity_type='reservation') AS reservation_facts,
          (SELECT count(*)::int FROM outbox o JOIN org_node p ON p.id=o.property_node AND p.tenant_id=o.tenant_id WHERE p.config @> '{"scenario_review":{"version":"order181-v1"}}' AND o.aggregate_type='reservation') AS reservation_events,
          (SELECT count(*)::int FROM api_idempotency WHERE operation IN (
            'profiles.party.create', 'reservation.commit', 'reservation.cancel',
            'financials.folio.open', 'financials.charge.post'
          )) AS idempotency,
          (SELECT count(*)::int FROM journal j JOIN org_node p ON p.id=j.property_node AND p.tenant_id=j.tenant_id WHERE p.config @> '{"scenario_review":{"version":"order181-v1"}}') AS journals,
          (SELECT count(*)::int FROM posting_line l JOIN journal j ON j.id=l.journal_id AND j.tenant_id=l.tenant_id JOIN org_node p ON p.id=j.property_node AND p.tenant_id=j.tenant_id WHERE p.config @> '{"scenario_review":{"version":"order181-v1"}}') AS postings,
          (SELECT count(*)::int FROM (SELECT l.journal_id FROM posting_line l JOIN journal j ON j.id=l.journal_id AND j.tenant_id=l.tenant_id JOIN org_node p ON p.id=j.property_node AND p.tenant_id=j.tenant_id WHERE p.config @> '{"scenario_review":{"version":"order181-v1"}}' GROUP BY l.journal_id HAVING sum(l.amount_minor)<>0) bad) AS unbalanced,
          (SELECT count(*)::int FROM payment) AS payments,
          (SELECT count(*)::int FROM document) AS documents,
          (SELECT count(*)::int FROM reservation_group g JOIN org_node p ON p.id=g.property_node AND p.tenant_id=g.tenant_id WHERE p.config @> '{"scenario_review":{"version":"order181-v1"}}') AS groups,
          (SELECT count(*)::int FROM channel) AS channels
      `;
      expect(proof[0]).toEqual({
        scenario_properties: 2,
        grants: 6,
        occupancy: 256,
        reservation_facts: 4_128,
        reservation_events: 4_128,
        idempotency: 4_178,
        journals: 24,
        postings: 48,
        unbalanced: 0,
        payments: 0,
        documents: 0,
        groups: 0,
        channels: 0,
      });

      const riverstone = first.properties[0];
      if (!riverstone) throw new Error("Riverstone proof result is absent");
      await sql`UPDATE org_node SET name='Divergent Riverstone' WHERE id=${riverstone.propertyId}::uuid`;
      try {
        await expect(runScenarioReviewSeed({ databaseUrl: databaseUrl!, logger: () => undefined }))
          .rejects.toThrow("property collides with non-canonical order181-v1 data");
      } finally {
        await sql`UPDATE org_node SET name='Riverstone Test Hotel' WHERE id=${riverstone.propertyId}::uuid`;
      }
      const afterDrift = await runScenarioReviewSeed({ databaseUrl: databaseUrl!, logger: () => undefined });
      expect(afterDrift).toEqual(first);
    } finally {
      await sql.close({ timeout: 0 });
    }
  }, 600_000);
});
