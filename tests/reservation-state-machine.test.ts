import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  RESERVATION_STATUSES,
  RESERVATION_TRANSITIONS,
  findReservationTransition,
  type ReservationStatus,
} from "../src/contexts/reservations/state-machine";

const stateMachines = readFileSync(
  new URL("../docs/STATE-MACHINES.md", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../migrations/0001_init.sql", import.meta.url),
  "utf8",
);

function canonicalReservationEdges() {
  const section = stateMachines.slice(
    stateMachines.indexOf("## 1. Reservation"),
    stateMachines.indexOf("## 2. Folio"),
  );

  return section
    .split("\n")
    .filter((line) => line.startsWith("|") && !line.includes("|---"))
    .slice(1)
    .flatMap((line) => {
      const [, fromCell, toCell, , eventCell] = line
        .split("|")
        .map((cell) => cell.trim().replaceAll("`", ""));

      return fromCell.split("/").map((from) => ({
        from,
        to: toCell,
        event: eventCell,
      }));
    })
    .sort(edgeSort);
}

function schemaReservationStatuses() {
  const table = migration.slice(
    migration.indexOf("CREATE TABLE reservation ("),
    migration.indexOf("CREATE INDEX reservation_board"),
  );
  const statusConstraint = table.match(
    /status\s+text\s+NOT NULL\s+DEFAULT\s+'reserved'\s+CHECK\s+\(status\s+IN\s*\(([^)]+)\)\)/s,
  );

  if (!statusConstraint) {
    throw new Error("reservation status constraint not found in immutable baseline");
  }

  return [...statusConstraint[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function edgeSort(
  left: { readonly from: string; readonly to: string; readonly event: string },
  right: { readonly from: string; readonly to: string; readonly event: string },
) {
  return `${left.from}\u0000${left.to}\u0000${left.event}`.localeCompare(
    `${right.from}\u0000${right.to}\u0000${right.event}`,
    "en",
  );
}

describe("reservation state contract", () => {
  test("derives the exact immutable-baseline statuses", () => {
    expect([...RESERVATION_STATUSES]).toEqual(schemaReservationStatuses());
    expect(Object.isFrozen(RESERVATION_STATUSES)).toBe(true);
  });

  test("matches every canonical Markdown transition and event exactly", () => {
    const runtimeEdges = RESERVATION_TRANSITIONS.map(({ from, to, event }) => ({
      from,
      to,
      event,
    })).sort(edgeSort);

    expect(runtimeEdges).toEqual(canonicalReservationEdges());
    expect(new Set(runtimeEdges.map(({ from, to }) => `${from}->${to}`)).size).toBe(
      runtimeEdges.length,
    );
  });

  test("is deeply immutable and gives every edge a stable guard identifier", () => {
    expect(Object.isFrozen(RESERVATION_TRANSITIONS)).toBe(true);
    for (const transition of RESERVATION_TRANSITIONS) {
      expect(Object.isFrozen(transition)).toBe(true);
      expect(transition.guard).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  test("fails closed for every transition absent from the canonical table", () => {
    const documentedPairs = new Set(
      canonicalReservationEdges().map(({ from, to }) => `${from}->${to}`),
    );

    for (const from of RESERVATION_STATUSES) {
      for (const to of RESERVATION_STATUSES) {
        const transition = findReservationTransition(from, to);
        if (!documentedPairs.has(`${from}->${to}`)) {
          expect(transition).toBeUndefined();
          continue;
        }

        expect(transition?.from).toBe(from);
        expect(transition?.to).toBe(to);
        expect(findReservationTransition(from, to)).toBe(transition);
      }
    }
  });

  test("keeps lookup inputs bounded to reservation statuses", () => {
    const from: ReservationStatus = RESERVATION_STATUSES[0];
    const to: ReservationStatus = RESERVATION_STATUSES[1];
    expect(findReservationTransition(from, to)).toBeDefined();
  });
});

