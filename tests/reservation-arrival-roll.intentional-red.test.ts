import { describe, expect, test } from "bun:test";

const arrivalRoll = Bun.file(new URL(
  "../src/contexts/reservations/arrival-roll.ts",
  import.meta.url,
));
const dueArrivalScopes = Bun.file(new URL(
  "../src/workers/postgres-due-arrival-scopes.ts",
  import.meta.url,
));
const server = Bun.file(new URL("../src/server.ts", import.meta.url));

async function optionalSource(file: ReturnType<typeof Bun.file>): Promise<{
  readonly exists: boolean;
  readonly source: string;
}> {
  const exists = await file.exists();
  return { exists, source: exists ? await file.text() : "" };
}

describe("Order 232 intentional red: governed property-local due-in roll", () => {
  test("the reservation arrival-roll domain service exists", async () => {
    const domain = await optionalSource(arrivalRoll);

    expect([
      domain.exists,
      domain.source.includes("export class ReservationArrivalRollService"),
    ]).toEqual([true, true]);
  });

  test("the due-arrival scope source and PostgreSQL adapter exist", async () => {
    const [domain, adapter] = await Promise.all([
      optionalSource(arrivalRoll),
      optionalSource(dueArrivalScopes),
    ]);

    expect([
      domain.source.includes("export interface DueArrivalScopeSource"),
      adapter.exists,
      adapter.source.includes("export class PostgresDueArrivalScopeSource"),
      adapter.source.includes("implements DueArrivalScopeSource"),
    ]).toEqual([true, true, true, true]);
  });

  test("the bounded arrival-roll worker is composed by the server", async () => {
    const [domain, serverSource] = await Promise.all([
      optionalSource(arrivalRoll),
      server.text(),
    ]);

    expect([
      domain.source.includes("export class ReservationArrivalRollWorker"),
      serverSource.includes("YELLOW_RESERVATION_ARRIVAL_ROLL_WORKER"),
      serverSource.includes("new ReservationArrivalRollWorker("),
    ]).toEqual([true, true, true]);
  });

  test("production emits the existing reservation.due_in event", async () => {
    const domain = await optionalSource(arrivalRoll);

    expect([
      domain.source.includes('operation: "reservation.due_in"'),
      domain.source.includes('eventType: "reservation.due_in"'),
    ]).toEqual([true, true]);
  });
});
