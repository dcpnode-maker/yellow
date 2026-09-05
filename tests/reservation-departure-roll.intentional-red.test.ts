import { describe, expect, test } from "bun:test";

const departureRoll = Bun.file(new URL(
  "../src/contexts/reservations/departure-roll.ts",
  import.meta.url,
));
const dueDepartureScopes = Bun.file(new URL(
  "../src/workers/postgres-due-departure-scopes.ts",
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

describe("Order 233 intentional red: governed property-local due-out roll", () => {
  test("the reservation departure-roll domain service exists", async () => {
    const domain = await optionalSource(departureRoll);

    expect([
      domain.exists,
      domain.source.includes("export class ReservationDepartureRollService"),
    ]).toEqual([true, true]);
  });

  test("the due-departure scope source and PostgreSQL adapter exist", async () => {
    const [domain, adapter] = await Promise.all([
      optionalSource(departureRoll),
      optionalSource(dueDepartureScopes),
    ]);

    expect([
      domain.source.includes("export interface DueDepartureScopeSource"),
      adapter.exists,
      adapter.source.includes("export class PostgresDueDepartureScopeSource"),
      adapter.source.includes("implements DueDepartureScopeSource"),
    ]).toEqual([true, true, true, true]);
  });

  test("the bounded departure-roll worker is composed by the server", async () => {
    const [domain, serverSource] = await Promise.all([
      optionalSource(departureRoll),
      server.text(),
    ]);

    expect([
      domain.source.includes("export class ReservationDepartureRollWorker"),
      serverSource.includes("YELLOW_RESERVATION_DEPARTURE_ROLL_WORKER"),
      serverSource.includes("new ReservationDepartureRollWorker("),
    ]).toEqual([true, true, true]);
  });

  test("production emits the existing reservation.due_out event", async () => {
    const domain = await optionalSource(departureRoll);

    expect([
      domain.source.includes('operation: "reservation.due_out"'),
      domain.source.includes('eventType: "reservation.due_out"'),
    ]).toEqual([true, true]);
  });
});
