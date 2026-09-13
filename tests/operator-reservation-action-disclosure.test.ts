import { describe, expect, test } from "bun:test";

import type { AvailabilityService } from "../src/contexts/inventory";
import { RESERVATION_STATUSES, type ReservationStatus } from "../src/contexts/reservations";
import type { LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000046401";
const PROPERTY = "00000000-0000-0000-0000-000000046402";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000046403";
const RESERVATION = "00000000-0000-0000-0000-000000046404";
const ACTOR = "00000000-0000-0000-0000-000000046405";
const READ_SCOPE = "reservations.lifecycle:read";
const WRITE_SCOPE = "reservations.lifecycle:write";

const property = Object.freeze({ id: PROPERTY, name: "Disclosure", timezone: "UTC", currency: "USD" });
const otherProperty = Object.freeze({ ...property, id: OTHER_PROPERTY });

interface DetailActions {
  readonly canModify: boolean;
  readonly canCancel: boolean;
  readonly canReinstate: boolean;
  readonly canOpenPrimaryFolio: boolean;
  readonly canManageAlerts: boolean;
}

interface Fixture {
  readonly api: OperatorHttpApi;
  readonly detailCalls: unknown[];
  readonly lifecycleCalls: string[];
}

function fixture(status: ReservationStatus, alertsAvailable = true): Fixture {
  const detailCalls: unknown[] = [];
  const lifecycleCalls: string[] = [];
  const detail = {
    async findById(_tx: Tx, input: unknown) {
      detailCalls.push(input);
      return { reservationId: RESERVATION, confirmationNo: "O464", status, folios: [] };
    },
  };
  const lifecycle = {
    async findByConfirmation() { lifecycleCalls.push("find"); return {}; },
    async modify() { lifecycleCalls.push("modify"); return {}; },
    async cancel() { lifecycleCalls.push("cancel"); return {}; },
    async reinstate() { lifecycleCalls.push("reinstate"); return {}; },
  };
  const dependencies = Array<unknown>(48).fill(undefined);
  dependencies[0] = {} as LocalLoginService;
  dependencies[1] = {} as AvailabilityService;
  dependencies[16] = lifecycle;
  dependencies[22] = detail;
  dependencies[47] = alertsAvailable ? { async create() { return {}; }, async deactivate() { return {}; } } : undefined;
  return {
    api: Reflect.construct(OperatorHttpApi, dependencies) as OperatorHttpApi,
    detailCalls,
    lifecycleCalls,
  };
}

function context(
  scopes: readonly string[],
  readGrants: readonly { readonly id: string }[],
  writeGrants: readonly { readonly id: string }[],
  grantQueries: string[],
  headers: HeadersInit = {},
): TenantRequestContext {
  const tx = ((_: TemplateStringsArray, ...values: unknown[]) => {
    const scope = values.find((value) => value === READ_SCOPE || value === WRITE_SCOPE);
    if (scope === READ_SCOPE) {
      grantQueries.push(READ_SCOPE);
      return Promise.resolve(readGrants.map((grant) => ({ ...property, ...grant })));
    }
    if (scope === WRITE_SCOPE) {
      grantQueries.push(WRITE_SCOPE);
      return Promise.resolve(writeGrants.map((grant) => ({ ...property, ...grant })));
    }
    throw new Error("unexpected property grant query");
  }) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request("http://yellow.test/api/v1/properties/reservations", { headers }),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

async function actionsFor(
  status: ReservationStatus,
  scopes: readonly string[],
  readGrants: readonly { readonly id: string }[],
  writeGrants: readonly { readonly id: string }[],
  alertsAvailable = true,
): Promise<{ readonly response: Response; readonly actions?: DetailActions; readonly fixture: Fixture; readonly grantQueries: string[] }> {
  const current = fixture(status, alertsAvailable);
  const grantQueries: string[] = [];
  const response = await current.api.reservationDetail(
    context(scopes, readGrants, writeGrants, grantQueries), PROPERTY, RESERVATION,
  );
  return response.status === 200
    ? { response, actions: (await response.json() as { actions: DetailActions }).actions, fixture: current, grantQueries }
    : { response, fixture: current, grantQueries };
}

describe("Order 464 reservation action disclosure", () => {
  test("same-property lifecycle writer receives exactly the existing status matrix without a detail write", async () => {
    const expected: Readonly<Record<ReservationStatus, Pick<DetailActions, "canModify" | "canCancel" | "canReinstate">>> = {
      quote: { canModify: false, canCancel: false, canReinstate: false },
      reserved: { canModify: true, canCancel: true, canReinstate: false },
      waitlist: { canModify: false, canCancel: false, canReinstate: false },
      due_in: { canModify: true, canCancel: true, canReinstate: false },
      in_house: { canModify: true, canCancel: false, canReinstate: false },
      due_out: { canModify: true, canCancel: false, canReinstate: false },
      checked_out: { canModify: false, canCancel: false, canReinstate: false },
      cancelled: { canModify: false, canCancel: false, canReinstate: true },
      no_show: { canModify: false, canCancel: false, canReinstate: true },
    };
    for (const status of RESERVATION_STATUSES) {
      const result = await actionsFor(status, [READ_SCOPE, WRITE_SCOPE], [property], [property]);
      expect(result.response.status).toBe(200);
      expect(result.actions).toEqual({
        ...expected[status],
        canOpenPrimaryFolio: false,
        canManageAlerts: true,
      });
      expect(result.fixture.detailCalls).toEqual([{ tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION }]);
      expect(result.fixture.lifecycleCalls).toEqual([]);
      expect(result.grantQueries).toEqual([READ_SCOPE, WRITE_SCOPE]);
    }
  });

  test("reader and writer for another property can read only when read-granted, and never receive lifecycle controls", async () => {
    const reader = await actionsFor("reserved", [READ_SCOPE], [property], []);
    expect(reader.response.status).toBe(200);
    expect(reader.actions).toEqual({
      canModify: false, canCancel: false, canReinstate: false, canOpenPrimaryFolio: false, canManageAlerts: false,
    });
    expect(reader.fixture.lifecycleCalls).toEqual([]);
    expect(reader.grantQueries).toEqual([READ_SCOPE]);

    const otherPropertyWriter = await actionsFor("cancelled", [READ_SCOPE, WRITE_SCOPE], [property], [otherProperty]);
    expect(otherPropertyWriter.response.status).toBe(200);
    expect(otherPropertyWriter.actions).toEqual({
      canModify: false, canCancel: false, canReinstate: false, canOpenPrimaryFolio: false, canManageAlerts: false,
    });
    expect(otherPropertyWriter.fixture.lifecycleCalls).toEqual([]);
    expect(otherPropertyWriter.grantQueries).toEqual([READ_SCOPE, WRITE_SCOPE]);

    const concealed = await actionsFor("reserved", [READ_SCOPE, WRITE_SCOPE], [otherProperty], [property]);
    expect(concealed.response.status).toBe(404);
    expect(concealed.fixture.detailCalls).toEqual([]);
    expect(concealed.fixture.lifecycleCalls).toEqual([]);
    expect(concealed.grantQueries).toEqual([READ_SCOPE]);
  });

  test("detail disclosure does not weaken existing direct command denials", async () => {
    const current = fixture("reserved");
    const noScopeQueries: string[] = [];
    const noScope = await current.api.modifyReservation(
      context([READ_SCOPE], [property], [], noScopeQueries, { "idempotency-key": "order464-reader-denial" }),
      PROPERTY,
      RESERVATION,
      { expected: { notes: null }, changes: { notes: "No permission" } },
    );
    expect(noScope.status).toBe(403);
    expect(noScopeQueries).toEqual([]);
    expect(current.lifecycleCalls).toEqual([]);

    const otherPropertyQueries: string[] = [];
    const otherPropertyDenied = await current.api.modifyReservation(
      context([READ_SCOPE, WRITE_SCOPE], [property], [otherProperty], otherPropertyQueries,
        { "idempotency-key": "order464-other-property-denial" }),
      PROPERTY,
      RESERVATION,
      { expected: { notes: null }, changes: { notes: "No permission" } },
    );
    expect(otherPropertyDenied.status).toBe(403);
    expect(otherPropertyQueries).toEqual([WRITE_SCOPE]);
    expect(current.lifecycleCalls).toEqual([]);
  });

  test("alert availability remains an additional condition, not lifecycle command authority", async () => {
    const unavailableAlerts = await actionsFor("reserved", [READ_SCOPE, WRITE_SCOPE], [property], [property], false);
    expect(unavailableAlerts.response.status).toBe(200);
    expect(unavailableAlerts.actions).toEqual({
      canModify: true, canCancel: true, canReinstate: false, canOpenPrimaryFolio: false, canManageAlerts: false,
    });
    expect(unavailableAlerts.fixture.lifecycleCalls).toEqual([]);
  });
});
