import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GuestProfileCreate } from "../frontend/yellow/src/ui/GuestProfileCreate";
import {
  createGuestProfileController,
  makeGuestPartyPayload,
  normalizeGuestName,
  type GuestProfileFetch,
} from "../frontend/yellow/src/ui/guest-profile-create";

const property = "70900000-0000-4000-8000-000000000001";
const partyA = "70900000-0000-4000-8000-000000000010";
const partyB = "70900000-0000-4000-8000-000000000011";

function profile(partyId: string, overrides: Record<string, unknown> = {}) {
  return {
    partyId,
    kind: "person",
    displayName: "Meera Rao",
    legalName: "Meera Legal",
    status: "active",
    roles: ["guest"],
    contacts: [
      { kind: "email", hint: "m•••@example.test", isPrimary: true },
      { kind: "phone", hint: "••••6789", isPrimary: true },
    ],
    ...overrides,
  };
}

function response(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const duplicate = (partyId: string, displayNameHint = "Me…") => ({
  type: "profiles/duplicate_review_required",
  candidates: [{ partyId, displayNameHint, reasons: ["email"], contacts: [{ kind: "email", hint: "m•••@example.test", isPrimary: true }] }],
});

function controller(fetcher: GuestProfileFetch, getToken: () => Promise<string> = async () => "test-bearer", keyFactory = () => "order709-key-0001") {
  return createGuestProfileController({ propertyId: property, fetcher, getToken, keyFactory });
}

const draft = { displayName: "  Meera   Rao ", legalName: " Meera   Legal ", email: " M@EXAMPLE.TEST ", phone: "+91987656789" };

test("normalizes a person guest draft without adding unapproved identity fields", () => {
  expect(normalizeGuestName("  Asha\t  Rao ")).toBe("Asha Rao");
  expect(makeGuestPartyPayload(draft)).toEqual({
    kind: "person",
    displayName: "Meera Rao",
    legalName: "Meera Legal",
    roles: ["guest"],
    contacts: [
      { kind: "email", value: "m@example.test", isPrimary: true },
      { kind: "phone", value: "+91987656789", isPrimary: true },
    ],
    acknowledgedDuplicatePartyIds: [],
  });
  expect(makeGuestPartyPayload({ displayName: "Valid", phone: "98765" })).toBeNull();
  expect(makeGuestPartyPayload({ displayName: "\u0000" })).toBeNull();
});

test("posts exact create contract then verifies the receipt by body-only Party-ID search", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: GuestProfileFetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return calls.length === 1
      ? response(201, { party: profile(partyA) })
      : response(200, { profiles: [profile(partyA)] });
  };
  const unit = controller(fetcher);
  const state = await unit.submit(draft);
  expect(state.status).toBe("ready");
  expect(state.created).toBe(true);
  expect(state.profile?.partyId).toBe(partyA);
  expect(calls).toHaveLength(2);
  expect(calls[0]?.url).toBe(`/api/v1/properties/${property}/parties`);
  expect(calls[0]?.init?.method).toBe("POST");
  expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer test-bearer");
  expect(new Headers(calls[0]?.init?.headers).get("idempotency-key")).toBe("order709-key-0001");
  expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
    kind: "person", displayName: "Meera Rao", legalName: "Meera Legal", roles: ["guest"],
    contacts: [{ kind: "email", value: "m@example.test", isPrimary: true }, { kind: "phone", value: "+91987656789", isPrimary: true }],
    acknowledgedDuplicatePartyIds: [],
  });
  expect(calls[1]?.url).toBe(`/api/v1/properties/${property}/parties:search`);
  expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ query: partyA, limit: 50 });
  expect(calls[1]?.url).not.toContain("m@example.test");
  unit.dispose();
});

test("failed token acquisition makes no POST", async () => {
  let requests = 0;
  const unit = controller(async () => { requests++; return response(201); }, async () => { throw new Error("private auth detail"); });
  const state = await unit.submit(draft);
  expect(state.status).toBe("rejected");
  expect(state.busy).toBe(false);
  expect(state.message).not.toContain("private auth detail");
  expect(requests).toBe(0);
  unit.dispose();
});

test("server permission denial before uncertainty is definite and exposes no raw problem detail", async () => {
  let requests = 0;
  const unit = controller(async () => { requests++; return response(403, { detail: "private scope detail" }); });
  const state = await unit.submit(draft);
  expect(requests).toBe(1);
  expect(state.status).toBe("rejected");
  expect(state.busy).toBe(false);
  expect(state.message).not.toContain("private scope detail");
  expect((await unit.submit({ displayName: "Corrected profile" })).status).toBe("rejected");
  expect(requests).toBe(2);
  unit.dispose();
});

test("duplicate review retries same key with exact current sorted IDs; changed candidate set replaces evidence", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: GuestProfileFetch = async (_url, init) => {
    const url = String(_url);
    calls.push({ url, init });
    if (calls.length === 1) return response(409, duplicate(partyB));
    if (calls.length === 2) return response(409, duplicate(partyA));
    if (calls.length === 3) return response(201, { party: profile(partyA) });
    return response(200, { profiles: [profile(partyA)] });
  };
  const unit = controller(fetcher);
  expect((await unit.submit(draft)).candidates.map(({ partyId }) => partyId)).toEqual([partyB]);
  expect((await unit.acknowledgeDistinct()).candidates.map(({ partyId }) => partyId)).toEqual([partyA]);
  expect((await unit.acknowledgeDistinct()).status).toBe("ready");
  const createCalls = calls.filter(({ url }) => url.endsWith("/parties"));
  expect(createCalls.slice(0, 3).map(({ init }) => new Headers(init?.headers).get("idempotency-key"))).toEqual([
    "order709-key-0001", "order709-key-0001", "order709-key-0001",
  ]);
  expect(createCalls.map(({ init }) => JSON.parse(String(init?.body))).filter((body) => body.acknowledgedDuplicatePartyIds.length)
    .map((body) => body.acknowledgedDuplicatePartyIds)).toEqual([[partyB], [partyA]]);
  unit.dispose();
});

test("stale duplicate acknowledgment with no current candidates needs explicit empty-set acknowledgment", async () => {
  const bodies: unknown[] = [];
  const fetcher: GuestProfileFetch = async (_url, init) => {
    bodies.push(init?.body ? JSON.parse(String(init.body)) : null);
    if (bodies.length === 1) return response(409, duplicate(partyA));
    if (bodies.length === 2) return response(409, { type: "profiles/duplicate_review_required", candidates: [] });
    if (bodies.length === 3) return response(201, { party: profile(partyA) });
    return response(200, { profiles: [profile(partyA)] });
  };
  const unit = controller(fetcher);
  await unit.submit(draft);
  await unit.acknowledgeDistinct();
  expect(unit.getState().status).toBe("duplicates");
  expect(unit.getState().candidates).toEqual([]);
  expect((await unit.acknowledgeDistinct()).status).toBe("ready");
  expect((bodies[1] as { acknowledgedDuplicatePartyIds: string[] }).acknowledgedDuplicatePartyIds).toEqual([partyA]);
  expect((bodies[2] as { acknowledgedDuplicatePartyIds: string[] }).acknowledgedDuplicatePartyIds).toEqual([]);
  unit.dispose();
});

test("uncertain retry stays locked through a later permission failure and replays the same key", async () => {
  const keys: Array<string | null> = [];
  let calls = 0;
  const unit = controller(async (url, init) => {
    calls++;
    if (String(url).endsWith("/parties")) keys.push(new Headers(init?.headers).get("idempotency-key"));
    if (calls === 1) throw new Error("network detail");
    if (calls === 2) return response(403, { detail: "private permission response" });
    if (calls === 3) return response(201, { party: profile(partyA) });
    return response(200, { profiles: [profile(partyA)] });
  });
  expect((await unit.submit(draft)).status).toBe("uncertain");
  const locked = await unit.reconcile();
  expect(locked.status).toBe("uncertain");
  expect(locked.busy).toBe(true);
  expect(locked.message).not.toContain("private permission response");
  expect((await unit.reconcile()).status).toBe("ready");
  expect(keys).toEqual(["order709-key-0001", "order709-key-0001", "order709-key-0001"]);
  unit.dispose();
});

test("malformed 201 is not trusted as a Party-ID lineage for an unrelated profile", async () => {
  let posts = 0;
  const unit = controller(async (url, init) => {
    if (String(url).endsWith("parties:search")) return response(200, { profiles: [profile(partyA, { displayName: "Unrelated Person", legalName: null })] });
    posts++;
    return posts === 1 ? response(201, { party: { partyId: partyA } }) : response(503);
  });
  await unit.submit(draft);
  expect(unit.getState().status).toBe("uncertain");
  await unit.reconcile();
  expect(posts).toBe(2);
  expect(unit.getState().status).toBe("uncertain");
  expect(unit.getState().profile).toBeUndefined();
  unit.dispose();
});

test("same-kind receipt with a mismatched masked contact is uncertain, never selected", async () => {
  const unit = controller(async () => response(201, { party: profile(partyA, {
    contacts: [
      { kind: "email", hint: "m•••@other.test", isPrimary: true },
      { kind: "phone", hint: "••••6789", isPrimary: true },
    ],
  }) }));
  const state = await unit.submit(draft);
  expect(state.status).toBe("uncertain");
  expect(state.profile).toBeUndefined();
  expect(state.busy).toBe(true);
  unit.dispose();
});

test("valid receipt with interrupted readback retries readback by known Party ID without a new create", async () => {
  let createCalls = 0;
  let lookupCalls = 0;
  const unit = controller(async (url) => {
    if (String(url).endsWith("parties:search")) {
      lookupCalls++;
      return lookupCalls === 1 ? response(200, { profiles: [] }) : response(200, { profiles: [profile(partyA)] });
    }
    createCalls++;
    return response(201, { party: profile(partyA) });
  });
  expect((await unit.submit(draft)).status).toBe("uncertain");
  expect((await unit.reconcile()).status).toBe("ready");
  expect(createCalls).toBe(1);
  expect(lookupCalls).toBe(2);
  unit.dispose();
});

test("a replayed duplicate response after unknown first outcome resolves safely into review", async () => {
  let calls = 0;
  const unit = controller(async () => {
    calls++;
    if (calls === 1) throw new Error("connection lost");
    return response(409, duplicate(partyA));
  });
  await unit.submit(draft);
  const reviewed = await unit.reconcile();
  expect(reviewed.status).toBe("duplicates");
  expect(reviewed.candidates[0]?.partyId).toBe(partyA);
  expect(reviewed.busy).toBe(false);
  unit.dispose();
});

test("malformed duplicate evidence is never displayed", async () => {
  const unit = controller(async () => response(409, { type: "profiles/duplicate_review_required", candidates: [{ partyId: partyA, displayNameHint: "Secret Person", reasons: ["email"], contacts: [] }] }));
  const state = await unit.submit(draft);
  expect(state.status).toBe("rejected");
  expect(state.candidates).toEqual([]);
  expect(state.message).not.toContain("Secret Person");
  unit.dispose();
});

test("candidate lookup accepts any active canonical Party and stale/unmounted responses cannot publish", async () => {
  let calls = 0;
  const unit = controller(async (url) => {
    calls++;
    if (calls === 1) return response(409, duplicate(partyA));
    return response(200, { profiles: [{ ...profile(partyA), kind: "org", roles: ["company"] }] });
  });
  await unit.submit(draft);
  const selected = await unit.useCandidate(partyA);
  expect(selected.status).toBe("ready");
  expect(selected.profile?.kind).toBe("org");
  expect(selected.profile?.roles).toEqual(["company"]);
  unit.dispose();

  let release!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => { release = resolve; });
  const stale = controller(async () => pending);
  const request = stale.submit(draft);
  stale.setProperty("70900000-0000-4000-8000-000000000002");
  release(response(201, { party: profile(partyA) }));
  expect((await request).status).toBe("idle");
  expect(stale.getState().status).toBe("idle");
  stale.dispose();

  let releaseUnmount!: (value: Response) => void;
  const pendingUnmount = new Promise<Response>((resolve) => { releaseUnmount = resolve; });
  const unmounted = controller(async () => pendingUnmount);
  const unmountedRequest = unmounted.submit(draft);
  unmounted.dispose();
  releaseUnmount(response(201, { party: profile(partyA) }));
  expect((await unmountedRequest).status).toBe("idle");
  expect(unmounted.getState().status).toBe("idle");
});

test("the active component starts collapsed and never renders creation fields until disclosure", () => {
  const markup = renderToStaticMarkup(createElement(GuestProfileCreate, {
    propertyId: property,
    getToken: async () => "unused",
    onCreated: () => {},
  }));
  expect(markup).toContain("Create guest profile");
  expect(markup).not.toContain('aria-label="Guest display name"');
  expect(markup).toContain('data-lifecycle-recovery="true"');
});

test("the inline Cancel stays visible and quiet beside shrinkable heading copy", async () => {
  const css = await Bun.file("frontend/yellow/src/ui/guest-profile-create.css").text();
  const component = await Bun.file("frontend/yellow/src/ui/GuestProfileCreate.tsx").text();
  expect(component).toContain('className="quiet guest-profile-create-cancel"');
  expect(css).toContain(".guest-profile-create .guest-profile-create-heading > div { flex: 1 1 0; min-width: 0;");
  expect(css).toContain(".guest-profile-create .guest-profile-create-heading > .guest-profile-create-cancel { flex: 0 0 auto; width: auto; min-width: max-content;");
  expect(css).toContain("white-space: nowrap;");
  expect(css).toContain("background: transparent; color: var(--reference-ink, #222);");
  expect(css).toContain("button:not(.guest-profile-create-toggle):not(.voice-field-mic):not(.guest-profile-create-cancel):not(.guest-profile-create-secondary)");
  expect(css).toContain(".guest-profile-create button.guest-profile-create-secondary, .guest-profile-create button.guest-profile-create-cancel { min-height: 44px;");
});
