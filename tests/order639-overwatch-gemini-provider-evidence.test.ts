import { describe, expect, test } from "bun:test";

const overwatch = await Bun.file("src/overwatch/index.ts").text();
const probe = await Bun.file("tools/probe-colleague-demo-readiness.ts").text();

describe("Order 639 Overwatch Gemini provider evidence", () => {
  test("Overwatch replies expose only non-secret provider metadata", () => {
    expect(overwatch).toContain('readonly provider: "gemini" | "local_fallback" | "not_configured";');
    expect(overwatch).toContain("provider: \"gemini\"");
    expect(overwatch).toContain("provider: \"local_fallback\"");
    expect(overwatch).toContain("provider: \"not_configured\"");
    expect(overwatch).toContain("readonly model: string | null;");
    expect(overwatch).not.toContain("apiKey,");
  });

  test("the colleague-readiness probe requires the live Gemini path", () => {
    expect(probe).toContain('name: "Overwatch Gemini provider evidence"');
    expect(probe).toContain('geminiOverwatch.provider === "gemini"');
    expect(probe).toContain('geminiOverwatch.model === "gemini-flash-lite-latest"');
  });
});
