import { expect, test } from "bun:test";

const source = await Bun.file(new URL("../src/http/operator.ts", import.meta.url)).text();

test("Order 112: one actor-binding choke point owns every direct operator idempotency claim", () => {
  const expectedOperationArguments = [
    '"operator.inventory.projection.rebuild"',
    '"operator.inventory.rooms.bulk"',
    '"operator.inventory.blocks.open"',
    '"operator.inventory.blocks.close"',
    '"operator.inventory.holds.place"',
    '"operator.inventory.holds.release"',
    '"operator.inventory.offline_leases.place"',
    '"operator.inventory.offline_leases.release"',
    '"operator.inventory.policy.oos_sellability"',
    '"operator.inventory.restriction.create"',
    '"operator.rates.release.draft"',
    "operation",
    '"operator.rates.price.create"',
    '"operator.rates.price.supersede"',
    "idempotencyOperation",
    "idempotencyOperation",
  ];
  const actualOperationArguments = [...source.matchAll(
    /this\.#executeActorBoundIdempotent\(\s*context,\s*("[^"]+"|operation|idempotencyOperation)/g,
  )].map((match) => match[1]);
  expect(source.match(/this\.#idempotency\.execute\(/g) ?? []).toHaveLength(1);
  expect(source).toContain("async #executeActorBoundIdempotent");
  expect(source).toContain('if (typeof actorId !== "string" || !UUID.test(actorId))');
  expect(source).toContain("throw new OperatorActorContextError()");
  expect(source).toContain("request: { ...request, actorId }");
  expect(actualOperationArguments).toEqual(expectedOperationArguments);
});
