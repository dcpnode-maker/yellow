import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");

describe("Order 105 operator folio workbench", () => {
  test("P0: the absent Folios workbench surface is explicit", () => {
    expect(html).toContain('data-view="folios"');
    expect(html).toContain('id="folio-statement-lookup-form"');
  });
});
