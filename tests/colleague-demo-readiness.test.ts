import { describe, expect, it } from "bun:test";

import { app } from "../src/app";
import { COLLEAGUE_DEMO_READINESS, renderDemoReadinessHtml } from "../src/demo/colleague-readiness";
import { SECURITY_HEADERS } from "../src/http/security-headers";

describe("colleague demo readiness contract", () => {
  it("serves a truthful not-ready JSON contract until every demo gate is proved", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/readiness"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toBe(SECURITY_HEADERS["content-security-policy"]);
    const body = await response.json();
    expect(body.status).toBe("not_ready");
    expect(body.shareNotificationAllowed).toBe(false);
    expect(body.requirements.map((requirement: { id: string }) => requirement.id)).toEqual([
      "synthetic-property",
      "hotel-operating-workflows",
      "mobile-first-ux",
      "overwatch-gemini",
      "confirmation-gated-actions",
    ]);
    expect(body.confirmationPolicy.operationalActionsRequireExplicitConfirmation).toBe(true);
    expect(JSON.stringify(body)).toContain("Order 620");
    expect(JSON.stringify(body)).toContain("Order 621");
    expect(JSON.stringify(body)).toContain("Order 623");
    expect(JSON.stringify(body)).toContain("Order 625");
    expect(JSON.stringify(body)).toContain("Order 627");
    expect(JSON.stringify(body)).toContain("Order 629");
    expect(JSON.stringify(body)).toContain("Order 631");
    expect(JSON.stringify(body)).toContain("Order 633");
    expect(JSON.stringify(body)).toContain("Order 635");
    expect(JSON.stringify(body)).toContain("Order 637");
    expect(JSON.stringify(body)).toContain("Order 638");
    expect(JSON.stringify(body)).toContain("Order 639");
    expect(JSON.stringify(body)).toContain("Order 640");
    expect(JSON.stringify(body)).toContain("Order 641");
    expect(JSON.stringify(body)).toContain("Order 642");
    expect(JSON.stringify(body)).toContain("Order 643");
    expect(JSON.stringify(body)).toContain("Order 645");
    expect(JSON.stringify(body)).toContain("Order 646");
    expect(JSON.stringify(body)).toContain("Order 648");
    expect(JSON.stringify(body)).toContain("Order 649");
    expect(JSON.stringify(body)).toContain("Order 650");
    expect(JSON.stringify(body)).toContain("Order 651");
    expect(JSON.stringify(body)).toContain("Order 652");
    expect(JSON.stringify(body)).toContain("Order 653");
    expect(JSON.stringify(body)).toContain("Order 654");
    expect(JSON.stringify(body)).toContain("Order 655");
    expect(JSON.stringify(body)).toContain("Order 656");
    expect(JSON.stringify(body)).toContain("Order 657");
    expect(JSON.stringify(body)).toContain("Order 658");
    expect(JSON.stringify(body)).toContain("Order 659");
    expect(JSON.stringify(body)).toContain("Order 660");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/colleague-scenario");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/property-config");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/front-desk-board");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/performance");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/operating-journey");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/proof-bundle");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/public-runtime-proof");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/workflow-rehearsal");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/ai-rehearsal");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/gemini-live-proof");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/governed/housekeeping/condition");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/governed/check-in");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/governed/cashier/post-charge");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/action-safety-matrix");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/actions/confirm");
    expect(JSON.stringify(body)).toContain("/api/v1/demo/sandbox/actions/execute");
    expect(JSON.stringify(body)).toContain("/api/v1/overwatch/provider");
    expect(JSON.stringify(body)).toContain("liveGeminiProved:false");
    expect(JSON.stringify(body)).toContain("/assets/demo.css");
    expect(JSON.stringify(body)).toContain("375×812");
    expect(JSON.stringify(body)).toContain("Gemini explicitly not connected");
  });

  it("serves a CSP-safe mobile-readable root shell without scripts or inline styles", async () => {
    const response = await app.handle(new Request("http://localhost/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">");
    expect(html).toContain("Yellow Grand Demo Hotel");
    expect(html).toContain("Check in Sara, edit guests, add sharer.");
    expect(html).toContain("L3R-HX-0126");
    expect(html).toContain("303 · Deluxe King · inspected");
    expect(html).toContain("Arrival check-in");
    expect(html).toContain("Confirm check-in");
    expect(html).toContain("Edit primary guest name");
    expect(html).toContain("Add sharer");
    expect(html).toContain("Move room");
    expect(html).toContain("action=\"/ui/check-in\"");
    expect(html).toContain("action=\"/ui/guest-profile\"");
    expect(html).toContain("action=\"/ui/room-move\"");
    expect(html).toContain("CONFIRM YELLOW OPERATION");
    expect(html).toContain("/overview");
    expect(html).toContain("/assets/demo.css");
    expect(html).not.toContain("Operating journey JSON</a>");
    expect(html).not.toMatch(/<script|style=|<style/i);
  });

  it("serves the local mobile shell stylesheet under CSP self", async () => {
    const response = await app.handle(new Request("http://localhost/assets/demo.css"));
    const css = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
    expect(css).toContain("glass");
    expect(css).toContain("--neon");
    expect(css).not.toContain("@import");
  });

  it("escapes readiness content before rendering HTML", () => {
    const html = renderDemoReadinessHtml({
      ...COLLEAGUE_DEMO_READINESS,
      syntheticProperty: {
        ...COLLEAGUE_DEMO_READINESS.syntheticProperty,
        name: "<bad>",
      },
    });

    expect(html).toContain("&lt;bad&gt;");
    expect(html).not.toContain("<bad>");
  });
});
