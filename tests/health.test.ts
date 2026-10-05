import { describe, expect, it } from "bun:test";

import { app } from "../src/app";

describe("GET /health", () => {
  it("reports process liveness without external dependencies", async () => {
    const response = await app.handle(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
