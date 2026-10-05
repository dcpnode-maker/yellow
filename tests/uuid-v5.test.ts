import { describe, expect, test } from "bun:test";
import { uuidV5 } from "../scripts/lib/uuid-v5";

describe("UUIDv5", () => {
  test("matches the standard DNS vector", async () => {
    expect(await uuidV5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "www.example.com"))
      .toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
  });

  test("derives the canonical Yellow tenant and property IDs", async () => {
    const tenant = await uuidV5("6ba7b811-9dad-11d1-80b4-00c04fd430c8", "https://yellow.local/seed/tenant/yellow-demo");
    expect(tenant).toBe("6d9b7ce2-2d14-5576-b8c3-80f06501a603");
    expect(await uuidV5(tenant, "org-node/yellow_demo.property")).toBe("4518a22f-b455-54c6-a50a-4584383749b9");
  });

  test("rejects non-canonical or malformed namespaces", async () => {
    await expect(uuidV5("6BA7B810-9DAD-11D1-80B4-00C04FD430C8", "name")).rejects.toThrow("Malformed namespace UUID");
    await expect(uuidV5("not-a-uuid", "name")).rejects.toThrow("Malformed namespace UUID");
  });
});
