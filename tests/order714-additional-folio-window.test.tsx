import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "bun:test";
import type { FolioStatement, ReservationDetail } from "../frontend/yellow/src/yellow-api";
import { AdditionalFolioWindow } from "../frontend/yellow/src/workspaces/AdditionalFolioWindow";
import {
  createAdditionalFolioWindowController,
  normalizeAdditionalFolioName,
  validateAdditionalFolioReceipt,
  type AdditionalFolioFetch,
} from "../frontend/yellow/src/workspaces/additional-folio-window";

const propertyId = "71400000-0000-4000-8000-000000000001";
const reservationId = "71400000-0000-4000-8000-000000000002";
const sourceFolioId = "71400000-0000-4000-8000-000000000003";
const createdFolioId = "71400000-0000-4000-8000-000000000004";
const accountId = "71400000-0000-4000-8000-000000000005";
const sourceReference = "FOL-714-1";
const createdReference = "FOL-714-2";

const receipt = (overrides: Record<string, unknown> = {}) => ({
  folioId: createdFolioId, reservationId, folioNo: createdReference, windowNo: 2,
  name: "Business", status: "open", currency: "USD", changed: true, replayed: false,
  ...overrides,
});
const folio = (id: string, reference: string, name: string, windowNo: number, status = "open") => ({
  id, reference, name, windowNo, status, currency: "USD",
});
const reservationDetail = (created = false, sourceStatus = "open") => ({
  reservation: {
    reservationId, primaryPartyId: "71400000-0000-4000-8000-000000000006", confirmationNo: "SYN-714",
    status: "in_house", bookerPartyId: null, groupId: null, channelCode: null, marketCode: null,
    sourceCode: null, originCode: null, currency: "USD", guaranteePolicyId: null, eta: null, etd: null,
    notes: null, createdAt: "2026-09-25T00:00:00Z", cancelledAt: null, cancelReason: null, cancellationNo: null,
    guests: [], segments: [],
    folios: [
      { folioId: sourceFolioId, accountId, folioNo: sourceReference, name: "Primary", status: sourceStatus, windowNo: 1 },
      ...(created ? [{ folioId: createdFolioId, accountId, folioNo: createdReference, name: "Business", status: "open", windowNo: 2 }] : []),
    ], alerts: [], travel: [], history: [],
  },
  actions: { canModify: false, canCancel: false, canReinstate: false, canOpenPrimaryFolio: false, canManageAlerts: false },
}) as ReservationDetail;
const statement = (isCreated: boolean, withCharge = false) => {
  const selected = isCreated ? folio(createdFolioId, createdReference, "Business", 2) : folio(sourceFolioId, sourceReference, "Primary", 1);
  return {
    reservationId,
    folio: selected,
    siblingWindows: isCreated
      ? [
        { id: sourceFolioId, windowNo: 1, reference: sourceReference, name: "Primary", status: "open", balanceMinor: "0" },
        { id: createdFolioId, windowNo: 2, reference: createdReference, name: "Business", status: "open", balanceMinor: withCharge ? "500" : "0" },
      ]
      : [{ id: sourceFolioId, windowNo: 1, reference: sourceReference, name: "Primary", status: "open", balanceMinor: "0" }],
    balanceMinor: withCharge ? "500" : "0", stayTotalMinor: withCharge ? "500" : "0",
    generation: "714-generation", rows: withCharge ? [{ journalId: "posted-after-create", amountMinor: "500" }] : [],
    chargeOptions: [], chargeAvailability: { allowed: true, reason: null },
  } as unknown as FolioStatement;
};
const response = (status: number, value?: unknown, replayed?: boolean) => new Response(
  value === undefined ? null : JSON.stringify(value),
  { status, headers: { ...(value === undefined ? {} : { "content-type": "application/json" }), ...(replayed === undefined ? {} : { "idempotency-replayed": String(replayed) }) } },
);

type Setup = {
  controller: ReturnType<typeof createAdditionalFolioWindowController>;
  requests: { url: string; init: RequestInit | undefined }[];
  events: string[];
  setCreated(value: boolean): void;
};
function setup(fetcher: AdditionalFolioFetch, opts: Readonly<{
  reservation?: (created: boolean) => ReservationDetail;
  createdStatement?: () => FolioStatement;
  token?: () => Promise<string>;
  attemptId?: string;
  key?: string;
  acquire?: (id: string) => boolean;
}> = {}): Setup {
  const requests: { url: string; init: RequestInit | undefined }[] = [];
  const events: string[] = [];
  let created = false;
  let keyNumber = 0;
  const controller = createAdditionalFolioWindowController({
    propertyId, reservationId, sourceFolioId, sourceFolioReference: sourceReference,
    getToken: opts.token ?? (async () => "synthetic-token"),
    loadReservation: async () => opts.reservation ? opts.reservation(created) : reservationDetail(created),
    loadFolioStatement: async reference => {
      if (reference === sourceReference) return statement(false);
      if (reference === createdReference) return opts.createdStatement?.() ?? statement(true);
      return statement(false);
    },
    acquireMutationLease: id => { events.push(`acquire:${id}`); return opts.acquire?.(id) ?? true; },
    releaseMutationLease: id => { events.push(`release:${id}`); },
    onCreated: (_detail, _folioStatement, id) => { events.push(`created:${id}`); created = true; },
    fetcher: async (url, init) => {
      requests.push({ url: String(url), init });
      const result = await fetcher(url, init);
      if (result.status === 201) created = true;
      return result;
    },
    keyFactory: () => opts.key ?? `order714-key-${++keyNumber}`,
    attemptFactory: () => opts.attemptId ?? "order714-attempt-0001",
  });
  return { controller, requests, events, setCreated: value => { created = value; } };
}

function stageReview(controller: Setup["controller"], name = "Business") {
  expect(controller.open()).toBe(true);
  controller.setName(`  ${name}  `);
  expect(controller.review()).toBe(true);
}

test("additional-window names follow the canonical trim/visible 1–80 contract", () => {
  expect(normalizeAdditionalFolioName("  Business  ")).toBe("Business");
  expect(normalizeAdditionalFolioName(" \t ")).toBeNull();
  expect(normalizeAdditionalFolioName("x".repeat(81))).toBeNull();
  expect(normalizeAdditionalFolioName("😀".repeat(41))).toBeNull();
  expect(normalizeAdditionalFolioName("Desk\n1")).toBeNull();
  expect(normalizeAdditionalFolioName("A\u200bB")).toBeNull();
});

test("receipt validator binds exact source name, reservation, distinct UUID and created status", () => {
  const expected = Object.freeze({ sourceFolioId, name: "Business" });
  expect(validateAdditionalFolioReceipt(receipt(), expected, reservationId)).toMatchObject({ folioId: createdFolioId, windowNo: 2 });
  expect(validateAdditionalFolioReceipt(receipt({ name: "Personal" }), expected, reservationId)).toBeNull();
  expect(validateAdditionalFolioReceipt(receipt({ folioId: sourceFolioId }), expected, reservationId)).toBeNull();
  expect(validateAdditionalFolioReceipt(receipt({ changed: false }), expected, reservationId)).toBeNull();
  expect(validateAdditionalFolioReceipt(receipt({ reservationId: propertyId }), expected, reservationId)).toBeNull();
  expect(validateAdditionalFolioReceipt({ ...receipt(), rawPii: "unexpected" }, expected, reservationId)).toBeNull();
});

test("review freezes exact source/name; successful command validates receipt and family readback before releasing lease", async () => {
  const env = setup(async () => response(201, receipt(), false));
  stageReview(env.controller);
  expect(env.controller.getState().reviewedBody).toEqual({ sourceFolioId, name: "Business" });
  env.controller.setName("changed during review");
  await env.controller.submit();
  expect(env.requests).toHaveLength(1);
  const request = env.requests[0]!;
  expect(request.url).toBe(`/api/v1/properties/${propertyId}/reservations/${reservationId}/folios`);
  expect(request.init?.method).toBe("POST");
  expect(request.init?.body).toBe(JSON.stringify({ sourceFolioId, name: "Business" }));
  const headers = new Headers(request.init?.headers);
  expect(headers.get("authorization")).toBe("Bearer synthetic-token");
  expect(headers.get("idempotency-key")).toBe("order714-key-1");
  expect(env.controller.getState().status).toBe("ready");
  expect(env.events.slice(-2)).toEqual(["release:order714-attempt-0001", `created:${createdFolioId}`]);
});

test("network uncertainty retains same key/body and reconciles with a matching 201", async () => {
  let count = 0;
  const env = setup(async () => {
    count += 1;
    if (count === 1) throw new TypeError("private network detail");
    return response(201, receipt({ replayed: true }), true);
  });
  stageReview(env.controller);
  await env.controller.submit();
  expect(env.controller.getState().status).toBe("uncertain");
  expect(env.events.filter(event => event.startsWith("release:"))).toHaveLength(0);
  await env.controller.submit();
  expect(env.requests).toHaveLength(2);
  expect(env.requests[0]?.init?.body).toBe(env.requests[1]?.init?.body);
  expect(new Headers(env.requests[0]?.init?.headers).get("idempotency-key")).toBe(new Headers(env.requests[1]?.init?.headers).get("idempotency-key"));
  expect(env.controller.getState().status).toBe("ready");
  expect(env.events.at(-2)).toBe("release:order714-attempt-0001");
});

test("a later 403 cannot clear an earlier unknown write or release its parent lock", async () => {
  let count = 0;
  const env = setup(async () => {
    count += 1;
    if (count === 1) throw new TypeError("offline");
    if (count === 2) return response(403, { detail: "not rendered" });
    return response(201, receipt({ replayed: true }), true);
  });
  stageReview(env.controller);
  await env.controller.submit();
  await env.controller.submit();
  expect(env.controller.getState().status).toBe("uncertain");
  expect(env.events.filter(event => event.startsWith("release:"))).toHaveLength(0);
  await env.controller.submit();
  expect(env.controller.getState().status).toBe("ready");
  expect(env.requests.map(request => new Headers(request.init?.headers).get("idempotency-key"))).toEqual([
    "order714-key-1", "order714-key-1", "order714-key-1",
  ]);
});

test("token rotation during readback suppresses success and retries the validated receipt safely", async () => {
  let tokenCalls = 0;
  let posts = 0;
  const env = setup(async () => {
    posts += 1;
    return response(201, receipt({ replayed: posts > 1 }), posts > 1);
  }, { token: async () => { tokenCalls += 1; return tokenCalls < 4 ? "identity-before" : "identity-after"; } });
  stageReview(env.controller);
  await env.controller.submit();
  expect(env.controller.getState().status).toBe("uncertain");
  expect(env.events.some(event => event.startsWith("created:"))).toBe(false);
  expect(env.events.filter(event => event.startsWith("release:"))).toHaveLength(0);
  await env.controller.submit();
  expect(env.controller.getState().status).toBe("ready");
  expect(env.requests).toHaveLength(1);
  expect(env.events.at(-2)).toBe("release:order714-attempt-0001");
});

test("reservation mismatch during fresh preflight sends no mutation and releases the draft lease", async () => {
  const env = setup(async () => response(201, receipt()), {
    reservation: async () => ({ ...reservationDetail(), reservation: { ...reservationDetail().reservation, reservationId: propertyId } }) as ReservationDetail,
  });
  stageReview(env.controller);
  await env.controller.submit();
  expect(env.requests).toHaveLength(0);
  expect(env.controller.getState().status).toBe("rejected");
  expect(env.events.at(-1)).toBe("release:order714-attempt-0001");
  env.controller.cancel();
});

test("valid receipt plus failed readback remains locked and retries exact readback without requiring an empty balance", async () => {
  let reads = 0;
  const env = setup(async () => response(201, receipt(), false), {
    createdStatement: () => {
      reads += 1;
      return reads <= 1 ? statement(false) : statement(true, true);
    },
  });
  stageReview(env.controller);
  await env.controller.submit();
  expect(env.controller.getState().status).toBe("uncertain");
  expect(env.requests).toHaveLength(1);
  await env.controller.submit();
  expect(env.controller.getState().status).toBe("ready");
  expect(env.requests).toHaveLength(1);
  expect(env.events.filter(event => event.startsWith("release:"))).toHaveLength(1);
});

test("remount reacquires a fresh parent lease before same-key recovery and fails closed while blocked", async () => {
  let resolveFirst!: (response: Response) => void;
  let calls = 0;
  let markStarted!: () => void;
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  let oldParentLease: string | null = null;
  const acquireOldParent = (id: string) => {
    if (oldParentLease === id) return true;
    if (oldParentLease) return false;
    oldParentLease = id;
    return true;
  };
  const releaseOldParent = (id: string) => { if (oldParentLease === id) oldParentLease = null; };
  const fetcher: AdditionalFolioFetch = async () => {
    calls += 1;
    if (calls === 1) return new Promise(resolve => { resolveFirst = resolve; markStarted(); });
    return response(201, receipt({ replayed: true }), true);
  };
  const first = setup(fetcher, { attemptId: "order714-remount-attempt", key: "«REDACTED-SECRET»", acquire: acquireOldParent });
  first.controller.open(); first.controller.setName("Business"); first.controller.review();
  const pending = first.controller.submit();
  await started;
  expect(oldParentLease).toBe("order714-remount-attempt");
  first.controller.dispose();
  resolveFirst(response(201, receipt(), false));
  await pending;
  let newParentLease: string | null = null;
  let allowNewLease = false;
  let newParentAcquireCalls = 0;
  const acquireNewParent = (id: string) => {
    newParentAcquireCalls += 1;
    if (!allowNewLease || (newParentLease !== null && newParentLease !== id)) return false;
    newParentLease = id;
    return true;
  };
  const releaseNewParent = (id: string) => { if (newParentLease === id) newParentLease = null; };
  const second = createAdditionalFolioWindowController({
    propertyId, reservationId, sourceFolioId, sourceFolioReference: sourceReference,
    getToken: async () => "synthetic-token", loadReservation: async () => reservationDetail(true),
    loadFolioStatement: async reference => reference === sourceReference ? statement(false) : statement(true),
    acquireMutationLease: acquireNewParent, releaseMutationLease: releaseNewParent, onCreated: () => {},
    fetcher, keyFactory: () => "must-not-be-used", attemptFactory: () => "new-attempt-must-not-be-used",
  });
  expect(second.getState().status).toBe("uncertain");
  expect(newParentAcquireCalls).toBe(0);
  second.activate();
  expect(newParentAcquireCalls).toBe(1);
  expect(newParentLease).toBeNull();
  await second.submit();
  expect(newParentAcquireCalls).toBe(2);
  expect(newParentLease).toBeNull();
  expect(calls).toBe(1);
  allowNewLease = true;
  await second.submit();
  expect(newParentAcquireCalls).toBe(3);
  expect(calls).toBe(2);
  expect(newParentLease).toBeNull();
  expect(second.getState().status).toBe("ready");
});

test("definitive rejection releases lease and controller can explicitly cancel before a fresh review", async () => {
  const env = setup(async () => response(409, { detail: "raw server reason never displayed" }));
  stageReview(env.controller, "Business");
  await env.controller.submit();
  expect(env.controller.getState().status).toBe("rejected");
  expect(env.controller.getState().message).not.toContain("raw server reason");
  expect(env.events.at(-1)).toBe("release:order714-attempt-0001");
  env.controller.cancel();
  expect(env.controller.getState().status).toBe("closed");
  expect(env.controller.open()).toBe(true);
  env.controller.setName("Personal");
  expect(env.controller.review()).toBe(true);
  expect(env.controller.getState().reviewedBody).toEqual({ sourceFolioId, name: "Personal" });
  env.controller.cancel();
});

test("failed authorization makes no POST; draft cancel always releases its lease", async () => {
  const env = setup(async () => response(201, receipt()), { token: async () => { throw new Error("token secret"); } });
  env.controller.open(); env.controller.setName("Business"); env.controller.review();
  await env.controller.submit();
  expect(env.requests).toHaveLength(0);
  expect(env.controller.getState().status).toBe("rejected");
  expect(env.events.filter(event => event.startsWith("release:"))).toEqual(["release:order714-attempt-0001"]);
  env.controller.cancel();
  expect(env.controller.getState().status).toBe("closed");

  const cancelEnv = setup(async () => response(201, receipt()), { attemptId: "order714-cancel-attempt" });
  expect(cancelEnv.controller.open()).toBe(true);
  cancelEnv.controller.setName("Unsaved");
  cancelEnv.controller.cancel();
  expect(cancelEnv.events.at(-1)).toBe("release:order714-cancel-attempt");
  expect(cancelEnv.requests).toHaveLength(0);
});

test("component begins collapsed and exposes lifecycle-recovery exemption for retained attempts", () => {
  const markup = renderToStaticMarkup(createElement(AdditionalFolioWindow, {
    propertyId, reservationId, sourceFolioId, sourceFolioReference: sourceReference,
    reservationLabel: "SYN-714", getToken: async () => "synthetic-token",
    loadReservation: async () => reservationDetail(), loadFolioStatement: async () => statement(false),
    acquireMutationLease: () => true, releaseMutationLease: () => {}, onCreated: () => {}, disabled: false,
  }));
  expect(markup).toContain("Create named bill window");
  expect(markup).not.toContain("role=\"dialog\"");
  expect(markup).not.toContain("Confirm and open window");
});

test("effect cleanup/setup can reactivate the same controller without dropping a draft", () => {
  const env = setup(async () => response(201, receipt()));
  expect(env.controller.open()).toBe(true);
  env.controller.setName("Business");
  env.controller.review();
  env.controller.dispose();
  env.controller.activate();
  expect(env.controller.getState().status).toBe("review");
  expect(env.controller.getState().reviewedBody).toEqual({ sourceFolioId, name: "Business" });
  env.controller.cancel();
});

test("owned lease keeps same-key reconciliation inside the parent lifecycle guard even when disabled is true", async () => {
  let calls = 0;
  const env = setup(async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("offline");
    return response(201, receipt({ replayed: true }), true);
  }, { attemptId: "order714-disabled-attempt", key: "order714-disabled-key" });
  stageReview(env.controller);
  await env.controller.submit();
  const markup = renderToStaticMarkup(createElement(AdditionalFolioWindow, {
    propertyId, reservationId, sourceFolioId, sourceFolioReference: sourceReference,
    reservationLabel: "SYN-714", getToken: async () => "synthetic-token",
    loadReservation: async () => reservationDetail(true),
    loadFolioStatement: async reference => reference === sourceReference ? statement(false) : statement(true),
    acquireMutationLease: () => true, releaseMutationLease: () => {}, onCreated: () => {}, disabled: true,
  }));
  expect(markup).toContain('data-lifecycle-recovery="true"');
  expect(markup).toContain("Reconcile retained request");
  expect(markup).not.toMatch(/<button[^>]*disabled[^>]*>Reconcile retained request/);
  await env.controller.submit();
  expect(env.controller.getState().status).toBe("ready");
});
