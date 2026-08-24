import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

describe("Order 102 operator Party profiles", () => {
  test("P0: Party search, create and explicit duplicate review exist in booking", () => {
    expect(html).toContain('id="party-profile-search-form"');
    expect(html).toContain('id="party-profile-results"');
    expect(html).toContain('id="party-profile-create-form"');
    expect(html).toContain('id="party-duplicate-review"');
    expect(script).toContain("searchPartyProfiles");
    expect(script).toContain("renderPartyDuplicateReview");
  });
});
