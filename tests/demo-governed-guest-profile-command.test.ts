import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { executeGovernedGuestProfileUpdate } from "../src/demo/governed-guest-profile-command";

describe("governed guest profile command and operator UI", () => {
  test("refuses without exact confirmation before database work", async () => {
    const result = await executeGovernedGuestProfileUpdate({
      confirmationNo: "L3R-HX-0126",
      primaryGuestName: "Sara Khan",
      databaseUrl: "postgres://unused/unused",
    });

    expect(result.confirmed).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.proof).toBeNull();
  });

  test("reports missing database configuration after confirmation", async () => {
    const result = await executeGovernedGuestProfileUpdate({
      confirmationNo: "L3R-HX-0126",
      sharerName: "Aarav Mehta",
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
    });

    expect(result.confirmed).toBe(true);
    expect(result.databaseConfigured).toBe(false);
    expect(result.executed).toBe(false);
  });

  test("serves root as a staff flow instead of a JSON link wall", async () => {
    const app = createApp();
    const response = await app.handle(new Request("http://localhost/"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Check in Sara, edit guests, add sharer.");
    expect(html).toContain("action=\"/ui/check-in\"");
    expect(html).toContain("action=\"/ui/guest-profile\"");
    expect(html).toContain("action=\"/ui/room-move\"");
    expect(html).not.toContain("Operating journey JSON</a>");
  });

  test("operator form refuses unconfirmed guest edits without mutation", async () => {
    const app = createApp();
    const form = new FormData();
    form.set("confirmationNo", "L3R-HX-0126");
    form.set("primaryGuestName", "Sara Khan");
    const response = await app.handle(new Request("http://localhost/ui/guest-profile", {
      method: "POST",
      body: form,
    }));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Guest profile");
    expect(html).toContain("Exact confirmation phrase is required");
  });
});
