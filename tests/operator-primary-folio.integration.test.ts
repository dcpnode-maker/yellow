import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  FolioConflictError,
  FolioNotFoundError,
  FolioValidationError,
} from "../src/contexts/financials";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000017101";
const ACTOR = "00000000-0000-0000-0000-000000017102";
const PROPERTY = "00000000-0000-0000-0000-000000017103";
const RESERVATION = "00000000-0000-0000-0000-000000017104";
const FOLIO = "00000000-0000-0000-0000-000000017105";

function operatorWithFolios(folios: unknown): OperatorHttpApi {
  return new OperatorHttpApi(
    {} as never,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, folios as never,
  );
}

function operatorWithReservationDetail(detail: unknown): OperatorHttpApi {
  return new OperatorHttpApi(
    {} as never,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    detail as never,
  );
}

function context(request: Request, scopes: readonly string[], granted = true): TenantRequestContext {
  const tx = (async () => granted
    ? [{ id: PROPERTY, name: "Yellow", timezone: "UTC", currency: "USD" }]
    : []) as unknown as Tx;
  return {
    request,
    tenantId: TENANT,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
    tx,
  };
}

function request(key = "order171-open-primary", correlationId = "00000000-0000-0000-0000-000000017106") {
  return new Request("http://yellow.test/", {
    method: "POST",
    headers: { "idempotency-key": key, "x-correlation-id": correlationId },
  });
}

describe("Order 171 primary-folio backend adapter", () => {
  test("P0: the narrow permission, POST route and runtime wiring exist", () => {
    const operator = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
    const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    const server = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
    const seed = readFileSync(new URL("../scripts/seed-review.ts", import.meta.url), "utf8");
    expect(operator).toContain('const FOLIO_OPEN_SCOPE = "financials.folios:open"');
    expect(app).toContain('/reservations/:reservation/primary-folio');
    expect(server).toContain("new FolioService({ events, idempotency: new PostgresIdempotency() })");
    expect(seed).toContain('{ code: "financials.folios:open", description: "Open reservation primary folios" }');
  });

  test("P1: open/read/charge authority is separate and the response strips account identity", async () => {
    let captured: Record<string, unknown> | null = null;
    const operator = operatorWithFolios({
      async openPrimary(_tx: Tx, input: Record<string, unknown>) {
        captured = input;
        return {
          folioId: FOLIO,
          accountId: "00000000-0000-0000-0000-000000017199",
          reservationId: RESERVATION,
          folioNo: "FOL-1",
          windowNo: 1,
          changed: true,
          replayed: false,
        };
      },
    });
    for (const scopes of [["financials.folios:read"], ["financials.charges:write"]]) {
      const denied = await operator.openPrimaryFolio(context(request(), scopes), PROPERTY, RESERVATION, {});
      expect(denied.status).toBe(403);
    }
    const response = await operator.openPrimaryFolio(
      context(request(), ["financials.folios:open"]), PROPERTY, RESERVATION, {},
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("idempotency-replayed")).toBe("false");
    expect(captured as unknown).toEqual({
      tenantId: TENANT,
      reservationId: RESERVATION,
      idempotencyKey: "order171-open-primary",
      envelope: {
        actorId: ACTOR,
        tenantId: TENANT,
        propertyNode: PROPERTY,
        requestId: "00000000-0000-0000-0000-000000017106",
        operation: "folio.opened",
      },
    });
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      changed: true,
      folioId: FOLIO,
      folioNo: "FOL-1",
      replayed: false,
      reservationId: RESERVATION,
      windowNo: 1,
    });
    expect(text).not.toContain("account");
    expect(text).not.toContain("party");
  });

  test("P1/P4: malformed shape, identifiers, key and property grant fail before the domain", async () => {
    let calls = 0;
    const operator = operatorWithFolios({ async openPrimary() { calls += 1; throw new Error("must not run"); } });
    const cases: Array<[Request, string, string, unknown, boolean]> = [
      [request(), "not-a-property", RESERVATION, {}, true],
      [request(), PROPERTY, "not-a-reservation", {}, true],
      [request("short"), PROPERTY, RESERVATION, {}, true],
      [request(), PROPERTY, RESERVATION, { accountId: ACTOR }, true],
      [request(), PROPERTY, RESERVATION, [], true],
      [request(), PROPERTY, RESERVATION, {}, false],
    ];
    for (const [candidate, property, reservation, body, granted] of cases) {
      const response = await operator.openPrimaryFolio(
        context(candidate, ["financials.folios:open"], granted), property, reservation, body,
      );
      expect([400, 403]).toContain(response.status);
    }
    expect(calls).toBe(0);
  });

  test("P1: existing and replayed server truth returns 200 without changing the safe shape", async () => {
    const operator = operatorWithFolios({
      async openPrimary() {
        return {
          folioId: FOLIO, accountId: ACTOR, reservationId: RESERVATION, folioNo: "FOL-9",
          windowNo: 1, changed: false, replayed: true,
        };
      },
    });
    const response = await operator.openPrimaryFolio(
      context(request(), ["financials.folios:open"]), PROPERTY, RESERVATION, {},
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("idempotency-replayed")).toBe("true");
    expect(await response.json()).toEqual({
      changed: false, folioId: FOLIO, folioNo: "FOL-9", replayed: true,
      reservationId: RESERVATION, windowNo: 1,
    });
  });

  test("P1/P4: domain failures map to stable financial errors without leaking details", async () => {
    const operator = operatorWithFolios({ async openPrimary() { throw new Error("unused"); } });
    const mapped = [
      [new FolioValidationError("secret validation"), 400, "request/invalid"],
      [new FolioNotFoundError("secret identity"), 404, "financials/not_found"],
      [new FolioConflictError("secret relationship"), 409, "financials/conflict"],
    ] as const;
    for (const [error, status, type] of mapped) {
      const response = operator.failure(request(), error);
      expect(response.status).toBe(status);
      const text = await response.text();
      expect(JSON.parse(text)).toMatchObject({ status, type });
      expect(text).not.toContain("secret");
    }
  });

  test("P1: reservation detail derives canOpenPrimaryFolio from exact scope, grant, folios and status", async () => {
    const statuses = ["reserved", "due_in", "in_house", "due_out", "cancelled"] as const;
    for (const status of statuses) {
      for (const openScope of [false, true]) {
        for (const openGranted of [false, true]) {
          for (const hasFolio of [false, true]) {
            const operator = operatorWithReservationDetail({
              async findById() {
                return {
                  reservationId: RESERVATION,
                  status,
                  folios: hasFolio ? [{ folioId: FOLIO }] : [],
                };
              },
            });
            const tx = ((_: TemplateStringsArray, ...values: unknown[]) => {
              const requestedOpenGrant = values.includes("financials.folios:open");
              return Promise.resolve(!requestedOpenGrant || openGranted
                ? [{ id: PROPERTY, name: "Yellow", timezone: "UTC", currency: "USD" }]
                : []);
            }) as unknown as Tx;
            const scopes = ["reservations.lifecycle:read", ...(openScope ? ["financials.folios:open"] : [])];
            const requestContext: TenantRequestContext = {
              request: new Request(`http://yellow.test/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}`),
              tenantId: TENANT,
              identity: { tenantId: TENANT, actorId: ACTOR, scopes },
              tx,
            };
            const response = await operator.reservationDetail(requestContext, PROPERTY, RESERVATION);
            expect(response.status).toBe(200);
            const result = await response.json() as { actions: { canOpenPrimaryFolio: boolean } };
            const eligibleStatus = status === "reserved" || status === "due_in" ||
              status === "in_house" || status === "due_out";
            expect(result.actions.canOpenPrimaryFolio)
              .toBe(openScope && openGranted && !hasFolio && eligibleStatus);
          }
        }
      }
    }
  });
});
