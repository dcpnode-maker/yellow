import { describe, expect, test } from "bun:test";

import { createApp } from "../src/app";
import type { OperatorHttpApi } from "../src/http/operator";
import type { Database, TenantResolver, Tx } from "../src/kernel";
import { containsSensitiveOverwatchContent, focusFor, navigationFor, OverwatchRequestError, OverwatchService, reservationOperationFor } from "../src/overwatch";

function mountedOverwatch(service?: OverwatchService, overrides: Partial<OperatorHttpApi> = {}) {
  const tx = (() => Promise.resolve([])) as unknown as Tx;
  const database = {
    async withTenantTransaction<T>(_tenantId: string, operation: (transaction: Tx) => Promise<T>): Promise<T> {
      return operation(tx);
    },
  } as unknown as Database;
  const tenantResolver: TenantResolver = {
    async resolve() {
      return {
        tenantId: "00000000-0000-0000-0000-000000599001",
        actorId: "00000000-0000-0000-0000-000000599002",
        scopes: [],
      };
    },
  };
  const operatorApi = {
    unauthorized: () => new Response("Unauthorized", { status: 401 }),
    failure: (_request: Request, error: unknown) => new Response(error instanceof Error ? error.message : "Unknown failure", { status: 500 }),
    ...overrides,
  } as unknown as OperatorHttpApi;
  return createApp({ database, tenantResolver, operatorApi, jarvis: service });
}

function ask(message: string): Request {
  return new Request("http://yellow.test/api/v1/jarvis:ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

describe("Overwatch guided navigation", () => {
  test.each([
    ["Show today's arrivals", "today"],
    ["आजचे आगमन दाखवा", "today"],
    ["ಇಂದಿನ ಆಗಮನಗಳನ್ನು ತೋರಿಸಿ", "today"],
    ["ఈరోజు రాకలను చూపించు", "today"],
    ["Show guest profile history", "guests"],
    ["अतिथि प्रोफाइल", "guests"],
    ["ಅತಿಥಿ ಪ್ರೊಫೈಲ್", "guests"],
    ["అతిథి ప్రొఫైల్", "guests"],
    ["Explain the confirmation requirement for a rate change", "rates"],
  ] as const)("routes %s to %s", (message, expected) => {
    expect(navigationFor(message)).toBe(expected);
  });

  test("keeps the no-provider fallback non-operational", async () => {
    const reply = await new OverwatchService(undefined).respond({ message: "Change the rate for tomorrow" });
    expect(reply.navigation).toBe("rates");
    expect(reply.requiresConfirmation).toBe(true);
    expect(reply.answer).toContain("not configured");
  });

  test.each([
    ["Show today's arrivals", "due_in"],
    ["आजचे आगमन दाखवा", "due_in"],
    ["ಇಂದಿನ ನಿರ್ಗಮನಗಳನ್ನು ತೋರಿಸಿ", "due_out"],
    ["ఈరోజు రాకలను చూపించు", "due_in"],
  ] as const)("keeps %s focused on %s", (message, expected) => {
    expect(focusFor(message)).toBe(expected);
  });

  test.each([
    "guest@example.test",
    "+91 98765 43210",
    "4111 1111 1111 1111",
    "passport A1234567",
    "booking reference ABC-123",
  ])("recognizes sensitive content before an external model call: %s", (message) => {
    expect(containsSensitiveOverwatchContent(message)).toBeTrue();
  });

  test("rejects sensitive prompt and history locally", async () => {
    const service = new OverwatchService("not-used");
    await expect(service.respond({ message: "Show arrivals for guest@example.test" })).rejects.toBeInstanceOf(OverwatchRequestError);
    await expect(service.respond({ message: "Show arrivals", history: [{ role: "user", text: "card number 4111 1111 1111 1111" }] })).rejects.toBeInstanceOf(OverwatchRequestError);
  });

  test("bounds a caller's demo request budget", async () => {
    const service = new OverwatchService(undefined);
    for (let attempt = 0; attempt < 12; attempt += 1) await service.respond({ message: "Show arrivals" }, "test-caller");
    await expect(service.respond({ message: "Show arrivals" }, "test-caller")).rejects.toMatchObject({ status: 429 });
  });

  test("uses the next configured key only after a retryable provider failure", async () => {
    const attempted: string[] = [];
    const service = new OverwatchService(["quota-exhausted", "available"], "gemini-3.6-flash", async (_input, init) => {
      attempted.push(String(new Headers(init?.headers).get("x-goog-api-key")));
      if (attempted.length === 1) return new Response("quota", { status: 429 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Yellow online" }] } }] }), { status: 200 });
    });
    await expect(service.respond({ message: "Hello" })).resolves.toMatchObject({ answer: "Yellow online" });
    expect(attempted).toEqual(["quota-exhausted", "available"]);
  });

  test("does not rotate credentials for a non-retryable provider response", async () => {
    const attempted: string[] = [];
    const service = new OverwatchService(["bad-model", "unused"], "gemini-3.6-flash", async (_input, init) => {
      attempted.push(String(new Headers(init?.headers).get("x-goog-api-key")));
      return new Response("not found", { status: 404 });
    });
    await service.respond({ message: "Hello" });
    expect(attempted).toEqual(["bad-model"]);
  });

  test("uses the verified low-latency Flash Lite model by default", async () => {
    let endpoint = "";
    const service = new OverwatchService("available", undefined, async (input) => {
      endpoint = String(input);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Yellow online" }] } }] }), { status: 200 });
    });
    await expect(service.respond({ message: "Hello" })).resolves.toMatchObject({ answer: "Yellow online" });
    expect(endpoint).toContain("models/gemini-flash-lite-latest:generateContent");
  });

  test("keeps the legacy Jarvis route as a mounted transport to Overwatch", async () => {
    const response = await mountedOverwatch(new OverwatchService(undefined)).handle(ask("Show today's arrivals"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ navigation: "today", focus: "due_in" });
  });

  test("mounts reservation guidance without writing, then delegates only to canonical reservation routes", async () => {
    let commits = 0;
    let edits = 0;
    let cancellations = 0;
    let reinstatements = 0;
    const app = mountedOverwatch(new OverwatchService(undefined), {
      commitReservation: async () => {
        commits += 1;
        return new Response(JSON.stringify({ reservationId: "reservation-1", confirmationNo: "Y-101", status: "reserved" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      },
      modifyReservation: async () => {
        edits += 1;
        return new Response(JSON.stringify({ reservationId: "reservation-1", replayed: false }), {
          headers: { "content-type": "application/json" },
        });
      },
      cancelReservation: async () => {
        cancellations += 1;
        return new Response(JSON.stringify({ reservation: { reservationId: "reservation-1", previousStatus: "reserved", status: "cancelled", cancellationNo: "CXL-1", cancelledAt: "2026-09-23T10:00:00.000Z", releasedClaimCount: 1, policyDecision: "allowed", approvalId: null, penaltyJournalId: null } }), { headers: { "content-type": "application/json", "idempotency-replayed": "false" } });
      },
      reinstateReservation: async () => {
        reinstatements += 1;
        return new Response(JSON.stringify({ reservation: { reservationId: "reservation-1", previousStatus: "cancelled", status: "reserved", reclaimedClaimCount: 1 } }), { headers: { "content-type": "application/json", "idempotency-replayed": "false" } });
      },
    });
    const guided = await app.handle(ask("Create a new reservation"));
    expect(guided.status).toBe(200);
    expect(await guided.json()).toMatchObject({
      navigation: "reservations",
      reservationOperation: "create",
      requiresConfirmation: true,
    });
    expect(commits).toBe(0);
    expect(edits).toBe(0);
    expect(cancellations).toBe(0);
    expect(reinstatements).toBe(0);

    for (const [message, operation] of [
      ["Cancel reservation", "cancel"],
      ["Reinstate reservation", "reinstate"],
      ["Mark reservation as no-show", "no_show"],
    ] as const) {
      const response = await app.handle(ask(message));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ reservationOperation: operation, requiresConfirmation: true });
    }
    expect(cancellations).toBe(0);
    expect(reinstatements).toBe(0);

    const committed = await app.handle(new Request("http://yellow.test/api/v1/reservations:commit", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "stable-create-key" },
      body: JSON.stringify({ propertyNode: "property-a" }),
    }));
    expect(committed.status).toBe(201);
    expect(commits).toBe(1);
    expect(edits).toBe(0);

    expect(reservationOperationFor("Edit reservation")).toBe("edit");
    const edited = await app.handle(new Request("http://yellow.test/api/v1/properties/property-a/reservations/reservation-1", {
      method: "PATCH",
      headers: { "content-type": "application/json", "idempotency-key": "stable-edit-key" },
      body: JSON.stringify({ expected: { status: "reserved" }, changes: { notes: "Late arrival" } }),
    }));
    expect(edited.status).toBe(200);
    expect(commits).toBe(1);
    expect(edits).toBe(1);

    const cancelled = await app.handle(new Request("http://yellow.test/api/v1/properties/property-a/reservations/reservation-1/cancel", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "stable-cancel-key" },
      body: JSON.stringify({ reason: "Guest requested" }),
    }));
    expect(cancelled.status).toBe(200);
    expect(cancellations).toBe(1);
    expect(reinstatements).toBe(0);

    const reinstated = await app.handle(new Request("http://yellow.test/api/v1/properties/property-a/reservations/reservation-1/reinstate", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "stable-reinstate-key" },
      body: "{}",
    }));
    expect(reinstated.status).toBe(200);
    expect(cancellations).toBe(1);
    expect(reinstatements).toBe(1);

    const inventedNoShow = await app.handle(new Request("http://yellow.test/api/v1/properties/property-a/reservations/reservation-1/no-show", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "forbidden-no-show-key" },
      body: "{}",
    }));
    expect(inventedNoShow.status).toBe(404);
    expect(cancellations).toBe(1);
    expect(reinstatements).toBe(1);
  });

  test("keeps privacy rejection mounted on the compatibility route", async () => {
    const response = await mountedOverwatch(new OverwatchService("not-used")).handle(ask("Show guest@example.test"));
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ title: "Private data blocked", status: 400 });
  });

  test("does not expose a competing Overwatch route and names unavailable service correctly", async () => {
    const app = mountedOverwatch();
    const unavailable = await app.handle(ask("Show arrivals"));
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).toBe("Overwatch is unavailable");

    const competing = await app.handle(new Request("http://yellow.test/api/v1/overwatch:ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Show arrivals" }),
    }));
    expect(competing.status).toBe(404);
  });
});
