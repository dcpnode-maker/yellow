import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { buildColleagueSharePacket, renderColleagueSharePacketHtml } from "../src/demo/share-packet";

describe("colleague share packet", () => {
  test("builds a truthful internal review packet without founder notification", () => {
    const packet = buildColleagueSharePacket();

    expect(packet.product).toBe("Yellow PMS");
    expect(packet.audience).toBe("internal-colleague-review");
    expect(packet.readyToShare).toBe(false);
    expect(packet.notifyFounder).toBe(false);
    expect(packet.status).toBe("not_ready");
    expect(packet.provedCount).toBeGreaterThanOrEqual(11);
    expect(packet.remainingGateCount).toBe(2);
    expect(packet.links.map((link) => link.route)).toEqual([
      "/",
      "/api/v1/demo/readiness",
      "/api/v1/demo/public-runtime-proof",
      "/api/v1/demo/proof-bundle",
      "/api/v1/demo/property-config",
      "/api/v1/demo/workflow-rehearsal",
      "/api/v1/demo/ai-rehearsal",
      "/api/v1/demo/gemini-live-proof",
      "/api/v1/demo/governed/housekeeping/condition",
      "/api/v1/demo/governed/check-in",
      "/api/v1/demo/governed/cashier/post-charge",
      "/api/v1/demo/governed/cashier/settle-payment",
      "/api/v1/demo/governed/checkout/complete",
      "/api/v1/demo/governed/group-block/status",
      "/api/v1/demo/governed/group-block/pickup",
      "/api/v1/demo/governed/group-block/wash",
      "/api/v1/demo/governed/group-block/rooming-list/import",
      "/api/v1/demo/governed/room-move",
      "/api/v1/demo/front-desk-board",
      "/api/v1/demo/group-blocks/manager",
    ]);
    expect(packet.walkthrough).toHaveLength(8);
    expect(packet.remainingGates.join(" ")).toContain("Public HTTPS URL");
    expect(packet.notificationPolicy).toContain("Notify the founder only after");
  });

  test("serves the packet JSON and human HTML route", async () => {
    const jsonResponse = await app.handle(new Request("http://localhost/api/v1/demo/share-packet"));
    const htmlResponse = await app.handle(new Request("http://localhost/share"));
    const json = await jsonResponse.json();
    const html = await htmlResponse.text();

    expect(jsonResponse.status).toBe(200);
    expect(htmlResponse.status).toBe(200);
    expect(jsonResponse.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(htmlResponse.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(json.readyToShare).toBe(false);
    expect(json.notifyFounder).toBe(false);
    expect(html).toContain("Yellow PMS colleague review packet");
    expect(html).toContain("Notify founder: <strong>false</strong>");
    expect(html).toContain("/api/v1/demo/proof-bundle");
    expect(html).toContain("/api/v1/demo/public-runtime-proof");
    expect(html).toContain("/api/v1/demo/ai-rehearsal");
    expect(html).toContain("/api/v1/demo/gemini-live-proof");
    expect(html).toContain("/api/v1/demo/governed/housekeeping/condition");
    expect(html).toContain("/api/v1/demo/governed/check-in");
    expect(html).toContain("/api/v1/demo/governed/cashier/post-charge");
    expect(html).toContain("/api/v1/demo/governed/cashier/settle-payment");
    expect(html).toContain("/api/v1/demo/governed/checkout/complete");
    expect(html).toContain("/api/v1/demo/governed/group-block/status");
    expect(html).toContain("/api/v1/demo/governed/group-block/pickup");
    expect(html).toContain("/api/v1/demo/governed/group-block/wash");
    expect(html).toContain("/api/v1/demo/governed/group-block/rooming-list/import");
    expect(html).toContain("/api/v1/demo/governed/room-move");
    expect(html).toContain("Remaining gates");
    expect(html).not.toMatch(/<script|style=|<style/i);
  });

  test("escapes rendered packet content", () => {
    const html = renderColleagueSharePacketHtml({
      ...buildColleagueSharePacket(),
      notificationPolicy: "<bad>",
    });

    expect(html).toContain("&lt;bad&gt;");
    expect(html).not.toContain("<bad>");
  });
});
