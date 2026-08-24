import { expect, test } from "bun:test";

const source = await Bun.file(new URL("../src/http/operator.ts", import.meta.url)).text();

test("Order 112: one actor-binding choke point owns every direct operator idempotency claim", () => {
  expect(source.match(/this\.#idempotency\.execute\(/g) ?? []).toHaveLength(1);
  expect(source).toContain("async #executeActorBoundIdempotent");
  expect(source).toContain("actorId: context.identity.actorId");
  expect(source.match(/this\.#executeActorBoundIdempotent\(/g) ?? []).toHaveLength(16);
});
