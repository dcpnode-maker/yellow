import { expect, test } from "bun:test";
import { createStaffPartyClient, StaffPartyScopeError, parseStaffPartyProfiles, parseStaffPartyHistory } from "../frontend/yellow/src/workspaces/staff-party-client";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const profile = (n = 3) => ({ partyId: id(n), kind: "person", status: "active", displayName: "Synthetic guest", legalName: null,
  roles: ["guest", "guest"], contacts: [{ kind: "email", hint: "a***@e***.test", isPrimary: true }] });
const stay = (n = 10) => ({ reservationId: id(n), primaryPartyId: id(4), confirmationNo: "CONF", status: "reserved", operationalState: "due_in",
  stayFrom: "2026-10-03T15:00:00.000000Z", stayTo: "2026-10-04T11:00:00.000000Z", sellableUnitLabel: null, unitTypeLabel: "King", ratePlanLabel: "BAR" });
const grant = () => [{ id: id(1), name: "FIRST", timezone: "UTC" }];

test("Party admission retains exact identity, legal names, ordered duplicate roles and masked hints without full contact values", () => {
  const source = { profiles: [profile(), { ...profile(4), kind: "org", legalName: "Company legal name" }] }, before = JSON.stringify(source);
  const rows = parseStaffPartyProfiles(source);
  expect(rows[0]!.roles).toEqual(["guest", "guest"]); expect(rows[0]!.contacts).toEqual([{ kind: "email", hint: "a***@e***.test" }]);
  expect(rows[1]!.legalName).toBe("Company legal name"); expect(JSON.stringify(source)).toBe(before);
  expect(Object.isFrozen(rows[0]!.contacts[0])).toBe(true); expect(parseStaffPartyProfiles({ profiles: [] })).toEqual([]);
  const changed = { profiles: [{ ...profile(), kind: "future_kind", legalName: "" }] };
  expect(parseStaffPartyProfiles(changed)[0]!.kind).toBe("future_kind"); expect(parseStaffPartyProfiles(changed)[0]!.legalName).toBe("");
});
test("missing and malformed evidence never become empty success", () => {
  for (const input of [null, {}, { profiles: null }, { profiles: [profile(), profile()] }, { profiles: [{ ...profile(), legalName: undefined }] },
    { profiles: [{ ...profile(), partyId: "../foreign" }] }, { profiles: [{ ...profile(), roles: [1] }] }, { profiles: [{ ...profile(), contacts: [{ kind: "email" }] }] }]) {
    expect(() => parseStaffPartyProfiles(input)).toThrow("could not be verified");
  }
  for (const input of [{}, { reservations: [] }, { reservations: null, nextCursor: null }, { reservations: [stay(), stay()], nextCursor: null },
    { reservations: [{ ...stay(), stayFrom: "2026-02-30T15:00:00.000000Z" }], nextCursor: null },
    { reservations: [{ ...stay(), stayTo: stay().stayFrom }], nextCursor: null }, { reservations: [], nextCursor: "../cursor" }]) {
    expect(() => parseStaffPartyHistory(input)).toThrow("could not be verified");
  }
  expect(parseStaffPartyHistory({ reservations: [], nextCursor: null }).reservations).toEqual([]);
});
test("current property, session and exact selected Party bind requests; another result is not selected", async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const client = createStaffPartyClient({ session: async () => "first", grants: async () => grant(), fetch: async (path, init) => {
    calls.push({ path, init }); return Response.json({ profiles: [profile(4)] });
  } });
  expect((await client.profile(id(1), id(3))).profile).toBeNull();
  expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({ query: id(3), limit: 50 });
  expect(new Headers(calls[0]!.init!.headers).get("authorization")).toBe("Bearer first");
  expect(calls[0]!.init!.cache).toBe("no-store"); expect(calls[0]!.init!.credentials).toBe("omit");
  await expect(client.search(id(2), "guest")).rejects.toThrow("no longer granted");
  await expect(client.profile(id(1), "../party")).rejects.toThrow("identity");
  await expect(client.search(id(1), "x")).rejects.toThrow("two and 200"); expect(calls).toHaveLength(1);
});
test("history admits accompanying Party participation and completes ordered native keyset pages", async () => {
  const paths: string[] = [];
  const client = createStaffPartyClient({ session: async () => "first", grants: async () => grant(), fetch: async path => {
    paths.push(path); return Response.json({ reservations: [stay(paths.length + 10)], nextCursor: paths.length === 1 ? "cursor_1" : null });
  } });
  const history = await client.history(id(1), id(3));
  expect(history.reservations).toHaveLength(2); expect(history.reservations[0]!.primaryPartyId).toBe(id(4));
  expect(new URL(paths[1]!, "http://fixture").searchParams.get("partyId")).toBe(id(3));
  expect(new URL(paths[1]!, "http://fixture").searchParams.get("after")).toBe("cursor_1");
});
test("repeated cursors, duplicate across pages and bounded unfinished history fail closed", async () => {
  for (const mode of ["cursor", "duplicate", "limit"]) {
    let count = 0;
    const client = createStaffPartyClient({ session: async () => "first", grants: async () => grant(), fetch: async () => {
      count++; return Response.json({ reservations: [stay(mode === "duplicate" ? 10 : count + 10)], nextCursor: mode === "cursor" ? "repeat" : `cursor_${count}` });
    } });
    await expect(client.history(id(1), id(3))).rejects.toThrow(mode === "cursor" ? "cursor" : mode === "duplicate" ? "reservation across pages" : "safe page limit");
    expect(count).toBe(mode === "limit" ? 50 : 2);
  }
});
test("late token/abort/denial replies and session changes between pages are rejected", async () => {
  let token = "first", release: (() => void) | undefined;
  const client = createStaffPartyClient({ session: async () => token, grants: async () => grant(), fetch: async () => {
    await new Promise<void>(resolve => { release = resolve; }); return Response.json({ profiles: [profile()] });
  } });
  const attempt = client.search(id(1), "guest"); await Bun.sleep(0); token = "second"; release!();
  await expect(attempt).rejects.toThrow("session changed");
  const controller = new AbortController(), second = client.profile(id(1), id(3), controller.signal); await Bun.sleep(0); controller.abort(); release!();
  await expect(second).rejects.toThrow("cancelled");
  const denied = createStaffPartyClient({ session: async () => "first", grants: async () => grant(), fetch: async () => new Response("denied", { status: 403 }) });
  await expect(denied.search(id(1), "guest")).rejects.toThrow("not granted");
  let pageToken = "first", grants = 0, pageRequests = 0;
  const paged = createStaffPartyClient({ session: async () => pageToken, grants: async () => {
    if (++grants === 2) pageToken = "replacement";
    return grant();
  }, fetch: async () => { pageRequests++; return Response.json({ reservations: [stay()], nextCursor: "next_page" }); } });
  await expect(paged.history(id(1), id(3))).rejects.toThrow("session changed");
  expect(pageRequests).toBe(1);
});

test("known scope loss is distinct from a history-only operation failure and never admits partial pages", async () => {
  let access = true, pages = 0;
  const lost = createStaffPartyClient({ session: async () => "first", grants: async () => access ? grant() : [], fetch: async () => {
    pages++; access = false; return Response.json({ reservations: [stay()], nextCursor: "next_page" });
  } });
  let loss: unknown; try { await lost.history(id(1), id(3)); } catch (reason) { loss = reason; }
  expect(loss).toBeInstanceOf(StaffPartyScopeError); expect(pages).toBe(1);
  const permitted = createStaffPartyClient({ session: async () => "first", grants: async () => grant(), fetch: async () => new Response("denied", {status:403}) });
  let operation: unknown; try { await permitted.history(id(1), id(3)); } catch (reason) { operation = reason; }
  expect(operation).toBeInstanceOf(Error); expect(operation).not.toBeInstanceOf(StaffPartyScopeError);
  const expired = createStaffPartyClient({ session: async () => "first", grants: async () => grant(), fetch: async () => new Response("expired", {status:401}) });
  await expect(expired.history(id(1), id(3))).rejects.toBeInstanceOf(StaffPartyScopeError);
});

test("unverifiable grants after a failed operation clear scope without changing shared auth", async () => {
  let grants = 0;
  const client = createStaffPartyClient({ session: async () => "first", grants: async () => {
    if (++grants > 1) throw new Error("network interrupted"); return grant();
  }, fetch: async () => new Response("unavailable", {status:503}) });
  await expect(client.history(id(1), id(3))).rejects.toBeInstanceOf(StaffPartyScopeError);
  expect(grants).toBe(2);
});
