import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";

import { HostedDepositProviderHttpApi, providerSecurity } from "../src/http/provider";
import { createApp } from "../src/app";
import { PaymentConflictError, type HostedDepositService, type PaymentService } from "../src/contexts/financials";

const SECRET = "order193-provider-callback-secret-32-bytes";
const NOW = 1_788_000_000_000;
const PATH = providerSecurity.CALLBACK_PATH;
const BODY = JSON.stringify({
  correlation: "11111111-1111-4111-8111-111111111111.66666666-6666-4666-8666-666666666666",
  providerReference: "provider-reference-193",
  outcome: "approved",
});

function signature(raw: string, path: string = PATH, timestamp = String(NOW), eventId = "event-order193-0001") {
  return createHmac("sha256", SECRET)
    .update(`local-deposit\nv1\n${path}\n${timestamp}\n${eventId}\n${raw}`).digest("hex");
}

function handoffToken(returnUrl: string) {
  const payload = { correlation:"11111111-1111-4111-8111-111111111111.66666666-6666-4666-8666-666666666666",
    amountMinor:"25000", currency:"INR", returnUrl, expiry:NOW + 60_000 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${createHmac("sha256", SECRET).update(`handoff.v1.${encoded}`).digest("hex")}`;
}

function callbackRequest(options: {
  raw?: string; path?: string; timestamp?: string; eventId?: string; signature?: string;
} = {}) {
  const raw = options.raw ?? BODY; const path = options.path ?? PATH;
  const timestamp = options.timestamp ?? String(NOW); const eventId = options.eventId ?? "event-order193-0001";
  return new Request(`http://127.0.0.1:3000${path}`, { method: "POST", body: raw, headers: {
    "content-type": "application/json", "x-yellow-provider": "local-deposit", "x-yellow-version": "v1",
    "x-yellow-timestamp": timestamp, "x-yellow-event-id": eventId,
    "x-yellow-signature": options.signature ?? signature(raw, path, timestamp, eventId),
  } });
}

function harness() {
  const calls: unknown[] = []; const receipts = new Map<string, { hash:string; result:Record<string, unknown> }>(); let begins = 0;
  type State = "ready" | "captured" | "declined" | "expired" | "revoked";
  let conflict = false; let terminalState: State = "ready";
  const payments = { async reconcile(inputValue: unknown) {
    const input = inputValue as { eventId:string; contentHash:string; outcome:"approved"|"declined" };
    calls.push(input); if (conflict) throw new PaymentConflictError("conflict");
    const prior = receipts.get(input.eventId);
    if (prior) {
      if (prior.hash !== input.contentHash) throw new PaymentConflictError("conflict");
      return { ...prior.result, replayed:true };
    }
    const result = { operationId: "22222222-2222-4222-8222-222222222222", paymentId: crypto.randomUUID(),
      phase: "capture", outcome: input.outcome, amountMinor: "25000", currency: "INR", replayed:false };
    receipts.set(input.eventId, { hash:input.contentHash, result }); return result;
  } } as unknown as PaymentService;
  const status = () => ({ tenantId: "11111111-1111-4111-8111-111111111111",
      requestId: "66666666-6666-4666-8666-666666666666", operationId: "22222222-2222-4222-8222-222222222222",
      propertyNode: "44444444-4444-4444-8444-444444444444", propertyName: "Yellow Test Hotel",
      folioReference: "FOL-193", amountMinor: "25000", currency: "INR",
      expiresAt: new Date(NOW + 60_000).toISOString(), state: "ready", capturedMinor: "0",
      appliedMinor: "0", remainingMinor: "0", generation: 1 });
  const hosted = {
    async status() { return { ...status(), state:terminalState }; },
    async statusByCorrelation() { return { ...status(), state: terminalState }; },
    async beginCaptureByCorrelation() { begins += 1; return { outcome: "indeterminate" }; },
    async operationActor() { return "33333333-3333-4333-8333-333333333333"; },
  } as unknown as HostedDepositService;
  const api = new HostedDepositProviderHttpApi({ hostedDeposits: hosted, payments, callbackSecret: SECRET,
    providerOrigin: "http://127.0.0.1:3001", guestOrigin: "http://127.0.0.1:3000", now: () => NOW });
  return { api, calls, begins: () => begins, effects:() => receipts.size,
    setConflict: () => { conflict = true; }, setState:(state:State) => { terminalState=state; } };
}

describe("Order193 signed provider callback", () => {
  test("accepts exact signed bytes once and delegates only to reconciliation", async () => {
    const h = harness();
    expect((await h.api.callback(callbackRequest())).status).toBe(201);
    expect(h.calls).toHaveLength(1);
    expect(h.begins()).toBe(1);
    h.setState("captured");
    expect((await h.api.callback(callbackRequest())).status).toBe(200);
    expect(h.calls).toHaveLength(2);
    expect(h.begins()).toBe(1);
  });

  test("declined callbacks replay exactly while changed content for the same event conflicts", async () => {
    const h = harness(); const declined = BODY.replace('"approved"', '"declined"');
    expect((await h.api.callback(callbackRequest({ raw:declined }))).status).toBe(201);
    h.setState("declined");
    expect((await h.api.callback(callbackRequest({ raw:declined }))).status).toBe(200);
    const changed = declined.replace("provider-reference-193", "provider-reference-193-changed");
    expect((await h.api.callback(callbackRequest({ raw:changed }))).status).toBe(409);
    expect(h.begins()).toBe(1); expect(h.effects()).toBe(1);
  });

  test("the HTTP composition preserves the exact raw callback body for verification", async () => {
    const h = harness(); const app = createApp({ hostedDepositRoutes: h.api, hostedDepositSurface: "guest" });
    expect((await app.handle(callbackRequest())).status).toBe(201);
    expect(h.calls).toHaveLength(1);
  });

  test("rejects altered bytes, path, time, id, signature and oversized input generically", async () => {
    const h = harness();
    const stale = String(NOW - 300_001); const future = String(NOW + 300_001);
    const cases = [
      callbackRequest({ raw: `${BODY} `, signature: signature(BODY) }),
      callbackRequest({ path: `${PATH}/altered`, signature: signature(BODY) }),
      callbackRequest({ path: `${PATH}?x=1`, signature: signature(BODY) }),
      callbackRequest({ timestamp: stale }), callbackRequest({ timestamp: future }),
      callbackRequest({ eventId: "short" }), callbackRequest({ signature: "0".repeat(64) }),
      callbackRequest({ raw: `{"padding":"${"x".repeat(providerSecurity.MAX_CALLBACK_BYTES)}"}` }),
    ];
    for (const request of cases) {
      const response = await h.api.callback(request); expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ type: "provider/callback_invalid", title: "Callback rejected", status: 400 });
    }
    expect(h.calls).toHaveLength(0);
  });

  test("streams only bounded bytes and rejects overflow or invalid UTF-8 without domain effects", async () => {
    const h = harness();
    const bodies = [
      new ReadableStream<Uint8Array>({ start(controller) {
        controller.enqueue(new Uint8Array(providerSecurity.MAX_CALLBACK_BYTES));
        controller.enqueue(new Uint8Array([1])); controller.close();
      } }),
      new ReadableStream<Uint8Array>({ start(controller) {
        controller.enqueue(new Uint8Array([0xc3, 0x28])); controller.close();
      } }),
    ];
    for (const body of bodies) {
      const response = await h.api.callback(new Request(`http://127.0.0.1:3000${PATH}`, { method: "POST", body,
        headers: { "x-yellow-provider":"local-deposit", "x-yellow-version":"v1", "x-yellow-timestamp":String(NOW),
          "x-yellow-event-id":"event-order193-stream", "x-yellow-signature":"0".repeat(64) } }));
      expect(response.status).toBe(400);
    }
    expect(h.calls).toHaveLength(0); expect(h.begins()).toBe(0);
  });

  test("maps a valid conflicting receipt to 409 without exposing tenant truth", async () => {
    const h = harness(); h.setConflict();
    const response = await h.api.callback(callbackRequest());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ type: "provider/callback_invalid", title: "Callback rejected", status: 409 });
  });

  test("handoff uses non-secret correlation and never carries the guest bearer", async () => {
    const h = harness(); const bearer = "11111111-1111-4111-8111-111111111111.raw-guest-secret";
    const response = await h.api.continue(new Request(`http://127.0.0.1:3000/pay/${bearer}/continue`), bearer);
    expect(response.status).toBe(303);
    const token = new URL(response.headers.get("location")!).searchParams.get("handoff")!;
    const encoded = token.slice(0, token.lastIndexOf("."));
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    expect(JSON.stringify(payload)).not.toContain(bearer);
    expect(payload.correlation).toBe("11111111-1111-4111-8111-111111111111.66666666-6666-4666-8666-666666666666");
    expect(Object.keys(payload).sort()).toEqual(["amountMinor", "correlation", "currency", "expiry", "returnUrl"]);
  });

  test("expired and revoked links cannot continue to the provider", async () => {
    const h = harness(); const bearer = "11111111-1111-4111-8111-111111111111.raw-guest-secret";
    for (const state of ["expired", "revoked"] as const) {
      h.setState(state);
      expect((await h.api.continue(new Request(`http://127.0.0.1/pay/${bearer}/continue`), bearer)).status).toBe(404);
    }
  });

  test("provider-only outcome needs no PMS services and can only emit a signed callback", async () => {
    let callback: Request | undefined;
    const provider = new HostedDepositProviderHttpApi({ callbackSecret: SECRET, now: () => NOW,
      providerOrigin:"http://127.0.0.1:3001", guestOrigin:"http://127.0.0.1:3000",
      sendCallback: async (request) => { callback = request; return new Response(null, { status:201 }); } });
    const source = harness().api; const bearer = "11111111-1111-4111-8111-111111111111.raw-guest-secret";
    const location = (await source.continue(new Request(`http://127.0.0.1/pay/${bearer}/continue`), bearer)).headers.get("location")!;
    const token = new URL(location).searchParams.get("handoff")!;
    expect((await provider.providerHandoff(token)).status).toBe(200);
    expect((await provider.providerOutcome(token, "approve")).status).toBe(303);
    expect(callback).toBeDefined(); expect(new URL(callback!.url).pathname).toBe(PATH);
    expect(JSON.parse(await callback!.clone().text())).toEqual(expect.objectContaining({ outcome:"approved" }));
  });

  test("provider page permits form return only to its exact validated guest origin", async () => {
    const provider = new HostedDepositProviderHttpApi({ callbackSecret:SECRET, now:() => NOW,
      providerOrigin:"http://127.0.0.1:3001", guestOrigin:"http://127.0.0.1:3000" });
    const app = createApp({ hostedDepositRoutes:provider, hostedDepositSurface:"provider" });
    const page = await app.handle(new Request("http://127.0.0.1:3001/provider/pay"));
    expect(page.headers.get("content-security-policy")).toContain(
      "form-action 'self' http://127.0.0.1:3000",
    );
    expect(page.headers.get("content-security-policy")).not.toContain("*");
    const health = await app.handle(new Request("http://127.0.0.1:3001/health"));
    expect(health.headers.get("content-security-policy")).toContain("form-action 'self'");
    expect(health.headers.get("content-security-policy")).not.toContain("http://127.0.0.1:3000");

    for (const returnUrl of [
      "http://127.0.0.1:3999/pay-return/blocked",
      "http://127.0.0.1:3000/not-pay-return/blocked",
      "http://127.0.0.1:3000/pay-return/blocked?leak=1",
      "http://127.0.0.1:3000/pay-return/blocked#fragment",
    ]) expect((await provider.providerHandoff(handoffToken(returnUrl))).status).toBe(400);
  });

  test("public provider and guest origins reject paths, credentials, foreign hosts and CSP input", () => {
    const invalid = [
      { providerOrigin:"http://127.0.0.1:3001/path" },
      { guestOrigin:"http://user:pass@127.0.0.1:3000" },
      { guestOrigin:"http://localhost:3000" },
      { guestOrigin:"http://127.0.0.1:3000; form-action *" },
    ];
    for (const origins of invalid) expect(() => new HostedDepositProviderHttpApi({ callbackSecret:SECRET,
      ...origins })).toThrow("must be an exact HTTP 127.0.0.1 origin");
  });

  test("provider response loss retries the same durable event and produces one effect", async () => {
    const source = harness(); const bearer = "11111111-1111-4111-8111-111111111111.raw-guest-secret";
    const location = (await source.api.continue(new Request(`http://127.0.0.1/pay/${bearer}/continue`), bearer)).headers.get("location")!;
    const token = new URL(location).searchParams.get("handoff")!; let sends=0; const identities:string[]=[];
    const provider = new HostedDepositProviderHttpApi({ callbackSecret:SECRET, now:() => NOW,
      providerOrigin:"http://127.0.0.1:3001",guestOrigin:"http://127.0.0.1:3000",
      sendCallback:async request => {
        identities.push(`${request.headers.get("x-yellow-event-id")}:${JSON.parse(await request.clone().text()).providerReference}`);
        const response = await source.api.callback(request); sends += 1;
        if (sends === 1) { source.setState("captured"); throw new Error("response lost after commit"); }
        return response;
      } });
    expect((await provider.providerOutcome(token,"approve")).status).toBe(404);
    expect((await provider.providerOutcome(token,"approve")).status).toBe(303);
    expect(identities[1]).toBe(identities[0]); expect(source.effects()).toBe(1); expect(source.begins()).toBe(1);
  });
});
