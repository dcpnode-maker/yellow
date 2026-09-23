import { describe, expect, test } from "bun:test";

const migration = Bun.file(
  new URL(
    "../migrations/0069_india_gst_accommodation_quoted_rate_applicability.sql",
    import.meta.url,
  ),
);
const recorder = Bun.file(
  new URL(
    "../src/contexts/tax-fiscal/india-gst-accommodation-quoted-rate-applicability-recorder.ts",
    import.meta.url,
  ),
);
const moduleSurface = Bun.file(
  new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url),
);

async function textOrEmpty(file: ReturnType<typeof Bun.file>): Promise<string> {
  return (await file.exists()) ? file.text() : "";
}

describe("Order 400 intentional red: persisted quoted-rate applicability", () => {
  test("migration0069 and the exact root, night, and component-rate tables are absent before production", async () => {
    const sql = await textOrEmpty(migration);

    expect(await migration.exists()).toBeTrue();
    expect(sql).toContain(
      "CREATE TABLE public.india_gst_accommodation_quoted_rate_applicability",
    );
    expect(sql).toContain(
      "CREATE TABLE public.india_gst_accommodation_quoted_rate_applicability_room_night",
    );
    expect(sql).toContain(
      "CREATE TABLE public.india_gst_accommodation_quoted_rate_component",
    );
  });

  test("the sole owner-mediated writer is absent before production", async () => {
    const sql = await textOrEmpty(migration);

    expect(sql).toContain(
      "FUNCTION public.record_india_gst_accommodation_quoted_rate_applicability(",
    );
  });

  test("the quoted-applicability recorder is absent before production", async () => {
    const source = await textOrEmpty(recorder);

    expect(await recorder.exists()).toBeTrue();
    expect(source).toContain(
      "export class IndiaGstAccommodationQuotedRateApplicabilityRecorderService",
    );
    expect(source).toContain("async record(");
  });

  test("the recorder boundary export is absent before production", async () => {
    const index = await moduleSurface.text();

    expect(index).toContain(
      'from "./india-gst-accommodation-quoted-rate-applicability-recorder"',
    );
  });
});
