import { session } from "./yellow-api";

export type GroupHeader = Readonly<{
  groupId: string; kind: "linked" | "block" | "share"; code: string; name: string;
  status: string; memberCount: number; roomsHeldByGroup: false | null;
}>;
export type GroupMember = Readonly<{
  reservationId: string; confirmationNo: string; guestName: string; status: string;
}>;
export type GroupCandidate = GroupMember & Readonly<{ currentGroupId: string | null }>;
export type GroupPage = Readonly<{ groups: readonly GroupHeader[]; nextCursor: string | null }>;
export type GroupDetail = Readonly<{ group: GroupHeader; members: readonly GroupMember[]; nextMemberCursor: string | null }>;

export class GroupRequestError extends Error {
  constructor(message: string, readonly uncertain: boolean, readonly status: number | null) {
    super(message); this.name = "GroupRequestError";
  }
}

export function groupCollectionQuery(phrase: string | null, after: string | null = null): string {
  return `?${new URLSearchParams({ limit: "50", ...(phrase === null ? {} : { q: phrase }), ...(after ? { after } : {}) })}`;
}

async function request<T>(propertyId: string, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/properties/${encodeURIComponent(propertyId)}/groups${path}`, {
      cache: "no-store", ...init,
      headers: { authorization: `Bearer ${await session()}`, ...init.headers },
    });
  } catch {
    throw new GroupRequestError("The response was not received. Retry the same request to reconcile.", true, null);
  }
  if (!response.ok) {
    const uncertain = response.status >= 500;
    throw new GroupRequestError(uncertain ? "The result is uncertain. Retry the same request." :
      `Group request was rejected (${response.status}). Refresh and review the details.`, uncertain, response.status);
  }
  try { return await response.json() as T; }
  catch { throw new GroupRequestError("The response was incomplete. Retry the same request.", true, response.status); }
}

export function loadGroups(propertyId: string, after: string | null = null): Promise<GroupPage> {
  return request(propertyId, groupCollectionQuery(null, after));
}
export function searchGroups(propertyId: string, phrase: string, after: string | null = null): Promise<GroupPage> {
  return request(propertyId, groupCollectionQuery(phrase, after));
}
export function loadGroup(propertyId: string, groupId: string, after: string | null = null): Promise<GroupDetail> {
  const query = new URLSearchParams({ memberLimit: "50", ...(after ? { memberAfter: after } : {}) });
  return request(propertyId, `/${encodeURIComponent(groupId)}?${query}`);
}
export async function findGroupCandidate(propertyId: string, groupId: string, confirmationNo: string): Promise<GroupCandidate | null> {
  const query = new URLSearchParams({ confirmationNo });
  const result = await request<{ candidate: GroupCandidate | null }>(propertyId,
    `/${encodeURIComponent(groupId)}/candidates?${query}`);
  return result.candidate;
}
export function createGroup(propertyId: string, name: string, idempotencyKey: string): Promise<{ group: GroupHeader; replayed: boolean }> {
  return request(propertyId, "", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify({ name }) });
}
export function attachGroupMember(propertyId: string, groupId: string, reservationId: string, idempotencyKey: string): Promise<{ groupId: string; reservationId: string; changed: boolean; replayed: boolean }> {
  return request(propertyId, `/${encodeURIComponent(groupId)}/members/${encodeURIComponent(reservationId)}`,
    { method: "PUT", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({ expectedGroupId: null }) });
}
