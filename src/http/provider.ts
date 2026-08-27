import { createHmac, timingSafeEqual } from "node:crypto";
import {
  HostedDepositConflictError,
  HostedDepositNotFoundError,
  HostedDepositService,
  PaymentConflictError,
  PaymentService,
} from "../contexts/financials";
import { SECURITY_HEADERS } from "./security-headers";

const MAX_CALLBACK_BYTES = 8_192;
const CALLBACK_PATH = "/api/v1/provider/local-deposit/callback";
const SAFE_ID = /^[!-~]{8,200}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CURRENCY = /^[A-Z]{3}$/;
const POSITIVE = /^[1-9][0-9]*$/;

interface CallbackBody {
  readonly correlation: string;
  readonly providerReference: string;
  readonly outcome: "approved" | "declined";
}

function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function constantEqual(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function publicHeaders(contentType = "application/json; charset=utf-8"): HeadersInit {
  return { ...SECURITY_HEADERS, "content-type": contentType, "cache-control": "no-store, max-age=0",
    pragma: "no-cache", "referrer-policy": "no-referrer", "cross-origin-resource-policy": "same-origin" };
}

function generic(status = 400): Response {
  return Response.json({ type: "provider/callback_invalid", title: "Callback rejected", status },
    { status, headers: publicHeaders() });
}

async function boundedBody(request: Request): Promise<Uint8Array | null> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_CALLBACK_BYTES)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_CALLBACK_BYTES) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
  } catch { return null; }
  if (size < 2) return null;
  const body = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

function parseCallback(raw: string): CallbackBody | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const allowed = ["correlation","providerReference","outcome"];
  if (Object.keys(body).length !== allowed.length || Object.keys(body).some((key) => !allowed.includes(key)) ||
      typeof body.correlation !== "string" || !/^[0-9a-f-]{36}\.[0-9a-f-]{36}$/.test(body.correlation) ||
      typeof body.providerReference !== "string" || !SAFE_ID.test(body.providerReference) ||
      (body.outcome !== "approved" && body.outcome !== "declined")) return null;
  return body as unknown as CallbackBody;
}

export interface ProviderHttpOptions {
  readonly hostedDeposits?: HostedDepositService;
  readonly payments?: PaymentService;
  readonly callbackSecret: string;
  readonly providerOrigin?: string;
  readonly guestOrigin?: string;
  readonly callbackOrigin?: string;
  readonly now?: () => number;
  readonly sendCallback?: (request: Request) => Promise<Response>;
}

export class HostedDepositProviderHttpApi {
  readonly #hosted?: HostedDepositService;
  readonly #payments?: PaymentService;
  readonly #secret: string;
  readonly #providerOrigin: string;
  readonly #guestOrigin: string;
  readonly #callbackOrigin: string;
  readonly #now: () => number;
  readonly #sendCallback: (request: Request) => Promise<Response>;

  constructor(options: ProviderHttpOptions) {
    if (options.callbackSecret.length < 32) throw new Error("Hosted deposit callback secret must be at least 32 characters");
    this.#hosted = options.hostedDeposits; this.#payments = options.payments; this.#secret = options.callbackSecret;
    this.#providerOrigin = options.providerOrigin ?? "http://127.0.0.1:3001";
    this.#guestOrigin = options.guestOrigin ?? "http://127.0.0.1:3000";
    this.#callbackOrigin = options.callbackOrigin ?? this.#guestOrigin;
    this.#now = options.now ?? Date.now;
    this.#sendCallback = options.sendCallback ?? ((request) => fetch(request, { redirect: "manual" }));
  }

  async guestStatus(request: Request, bearer: string): Promise<Response> {
    try {
      const status = await this.#hosted!.status(bearer);
      const safe = { propertyName: status.propertyName, folioReference: status.folioReference,
        amountMinor: status.amountMinor, currency: status.currency, expiresAt: status.expiresAt,
        state: status.state, capturedMinor: status.capturedMinor, appliedMinor: status.appliedMinor,
        remainingMinor: status.remainingMinor, generation: status.generation };
      return Response.json(safe, { headers: publicHeaders() });
    } catch (error) {
      if (error instanceof HostedDepositNotFoundError) return generic(404);
      return generic(409);
    }
  }

  async guestStatusByCorrelation(request: Request, correlation: string): Promise<Response> {
    try {
      const status = await this.#hosted!.statusByCorrelation(correlation);
      const safe = { propertyName: status.propertyName, folioReference: status.folioReference,
        amountMinor: status.amountMinor, currency: status.currency, expiresAt: status.expiresAt,
        state: status.state, capturedMinor: status.capturedMinor, appliedMinor: status.appliedMinor,
        remainingMinor: status.remainingMinor, generation: status.generation };
      return Response.json(safe, { headers: publicHeaders() });
    } catch (error) {
      if (error instanceof HostedDepositNotFoundError) return generic(404);
      return generic(409);
    }
  }

  async continue(request: Request, bearer: string): Promise<Response> {
    try {
      const status = await this.#hosted!.status(bearer);
      if (status.state !== "ready" && status.state !== "processing") throw new HostedDepositConflictError("not payable");
      const expiry = Math.min(this.#now() + 5 * 60_000, new Date(status.expiresAt).getTime());
      const correlation = `${status.tenantId}.${status.requestId}`;
      const returnUrl = `${this.#guestOrigin}/pay-return/${encodeURIComponent(correlation)}`;
      const payload = { correlation, amountMinor: status.amountMinor,
        currency: status.currency, returnUrl, expiry };
      const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const signature = hmac(this.#secret, `handoff.v1.${encoded}`);
      return new Response(null, { status: 303, headers: { ...publicHeaders(), location:
        `${this.#providerOrigin}/provider/pay?handoff=${encoded}.${signature}` } });
    } catch { return generic(404); }
  }

  async providerHandoff(token: string): Promise<Response> {
    const payload = this.#verifyHandoff(token);
    if (!payload) return generic(400);
    return Response.json({ amountMinor: payload.amountMinor, currency: payload.currency, expiry: payload.expiry },
      { headers: publicHeaders() });
  }

  async providerOutcome(token: string, outcome: unknown): Promise<Response> {
    const payload = this.#verifyHandoff(token);
    if (!payload || !["approve","decline","cancel","timeout"].includes(String(outcome))) return generic(400);
    if (outcome === "cancel" || outcome === "timeout") {
      return new Response(null, { status: 303, headers: { ...publicHeaders(), location: payload.returnUrl } });
    }
    try {
      const retryIdentity = hmac(this.#secret, `provider-outcome.v1.${token}.${String(outcome)}`);
      const body: CallbackBody = { correlation: payload.correlation,
        providerReference: `local-deposit-${retryIdentity}`,
        outcome: outcome === "approve" ? "approved" : "declined" };
      const raw = JSON.stringify(body); const timestamp = String(this.#now()); const eventId = `evt-${retryIdentity}`;
      const signature = hmac(this.#secret, `local-deposit\nv1\n${CALLBACK_PATH}\n${timestamp}\n${eventId}\n${raw}`);
      const callback = new Request(`${this.#callbackOrigin}${CALLBACK_PATH}`, { method: "POST", body: raw,
        headers: { "content-type": "application/json", "x-yellow-provider": "local-deposit",
          "x-yellow-version": "v1", "x-yellow-timestamp": timestamp, "x-yellow-event-id": eventId,
          "x-yellow-signature": signature } });
      const response = await this.#sendCallback(callback);
      if (response.status >= 400) return generic(response.status);
      return new Response(null, { status: 303, headers: { ...publicHeaders(), location: payload.returnUrl } });
    } catch (error) {
      return generic(error instanceof HostedDepositConflictError || error instanceof PaymentConflictError ? 409 : 404);
    }
  }

  async callback(request: Request): Promise<Response> {
    const rawBytes = await boundedBody(request);
    if (!rawBytes) return generic(400);
    const url = new URL(request.url);
    const provider = request.headers.get("x-yellow-provider"); const version = request.headers.get("x-yellow-version");
    const timestamp = request.headers.get("x-yellow-timestamp") ?? "";
    const eventId = request.headers.get("x-yellow-event-id") ?? ""; const signature = request.headers.get("x-yellow-signature") ?? "";
    if (provider !== "local-deposit" || version !== "v1" || url.pathname !== CALLBACK_PATH || url.search !== "" || !/^\d{13}$/.test(timestamp) ||
        !SAFE_ID.test(eventId) || Math.abs(this.#now() - Number(timestamp)) > 5 * 60_000) return generic(400);
    let raw: string;
    try { raw = new TextDecoder("utf-8", { fatal: true }).decode(rawBytes); } catch { return generic(400); }
    const expected = hmac(this.#secret, `local-deposit\nv1\n${CALLBACK_PATH}\n${timestamp}\n${eventId}\n${raw}`);
    if (!constantEqual(signature, expected)) return generic(400);
    const body = parseCallback(raw);
    if (!body) return generic(400);
    try {
      const status = await this.#hosted!.statusByCorrelation(body.correlation);
      if (status.state === "ready" || status.state === "processing") {
        const started = await this.#hosted!.beginCaptureByCorrelation(body.correlation);
        if (started.outcome !== "indeterminate") throw new PaymentConflictError("capture is not pending reconciliation");
      } else if (status.state !== "captured" && status.state !== "declined") {
        throw new PaymentConflictError("hosted request is not payable");
      }
      const result = await this.#payments!.reconcile({ tenantId: status.tenantId, operationId: status.operationId,
        eventId, contentHash: new Bun.CryptoHasher("sha256").update(raw).digest("hex"),
        providerReference: body.providerReference, phase: "capture", outcome: body.outcome,
        amountMinor: status.amountMinor, currency: status.currency,
        envelope: { actorId: await this.#hosted!.operationActor(status.tenantId, status.operationId),
          tenantId: status.tenantId, propertyNode: status.propertyNode,
          requestId: crypto.randomUUID(), operation: "payment.reconciled" } });
      return Response.json(result, { status: result.replayed ? 200 : 201, headers: publicHeaders() });
    } catch (error) {
      if (error instanceof PaymentConflictError) return generic(409);
      return generic(404);
    }
  }

  #verifyHandoff(token: string): { correlation: string; amountMinor: string; currency: string; returnUrl: string; expiry: number } | null {
    if (token.length > 2048) return null;
    const dot = token.lastIndexOf("."); if (dot < 1) return null;
    const encoded = token.slice(0, dot); const signature = token.slice(dot + 1);
    if (!constantEqual(signature, hmac(this.#secret, `handoff.v1.${encoded}`))) return null;
    try {
      const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>;
      if (Object.keys(value).sort().join(",") !== "amountMinor,correlation,currency,expiry,returnUrl" ||
          typeof value.correlation !== "string" || typeof value.amountMinor !== "string" || !POSITIVE.test(value.amountMinor) ||
          typeof value.currency !== "string" || !CURRENCY.test(value.currency) || typeof value.expiry !== "number" ||
          value.expiry < this.#now() || value.expiry > this.#now() + 5 * 60_000 || typeof value.returnUrl !== "string" ||
          !value.returnUrl.startsWith(`${this.#guestOrigin}/pay-return/`)) return null;
      return value as unknown as { correlation: string; amountMinor: string; currency: string; returnUrl: string; expiry: number };
    } catch { return null; }
  }

}

export const providerSecurity = Object.freeze({ MAX_CALLBACK_BYTES, CALLBACK_PATH });

const GUEST_ASSETS = {
  html: new URL("./guest/index.html", import.meta.url), css: new URL("./guest/guest.css", import.meta.url),
  js: new URL("./guest/guest.js", import.meta.url),
} as const;
const PROVIDER_ASSETS = {
  html: new URL("./provider/index.html", import.meta.url), css: new URL("./provider/provider.css", import.meta.url),
  js: new URL("./provider/provider.js", import.meta.url),
} as const;
function asset(url: URL, contentType: string): Response {
  return new Response(Bun.file(url), { headers: publicHeaders(contentType) });
}
export const hostedDepositAssets = Object.freeze({
  guestHtml: () => asset(GUEST_ASSETS.html, "text/html; charset=utf-8"),
  guestCss: () => asset(GUEST_ASSETS.css, "text/css; charset=utf-8"),
  guestJs: () => asset(GUEST_ASSETS.js, "text/javascript; charset=utf-8"),
  providerHtml: () => asset(PROVIDER_ASSETS.html, "text/html; charset=utf-8"),
  providerCss: () => asset(PROVIDER_ASSETS.css, "text/css; charset=utf-8"),
  providerJs: () => asset(PROVIDER_ASSETS.js, "text/javascript; charset=utf-8"),
});
