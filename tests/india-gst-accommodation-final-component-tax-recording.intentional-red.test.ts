import { describe, expect, test } from "bun:test";
import * as taxFiscal from "../src/contexts/tax-fiscal";

const migration = Bun.file(new URL(
  "../migrations/0069_india_gst_accommodation_final_component_tax.sql",
  import.meta.url,
));
const recorder = Bun.file(new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-final-component-tax-recorder.ts",
  import.meta.url,
));

describe("Order 367 intentional red: persisted final component-tax evidence", () => {
  test("migration, recorder, export, three tables and sole writer capability are absent before implementation", async () => {
    const migrationText = await migration.text().catch(() => "");
    expect({
      migration: await migration.exists(),
      recorder: await recorder.exists(),
      export: typeof (taxFiscal as Record<string, unknown>)
        .IndiaGstAccommodationFinalComponentTaxRecorderService === "function",
      rootTable: migrationText.includes(
        "india_gst_accommodation_final_component_tax",
      ),
      roomNightTable: migrationText.includes(
        "india_gst_accommodation_final_component_tax_room_night",
      ),
      componentTable: migrationText.includes(
        "india_gst_accommodation_final_component_tax_component",
      ),
      writerCapability: migrationText.includes(
        "record_india_gst_accommodation_final_component_tax",
      ),
    }).toEqual({
      migration: true,
      recorder: true,
      export: true,
      rootTable: true,
      roomNightTable: true,
      componentTable: true,
      writerCapability: true,
    });
  });
});
