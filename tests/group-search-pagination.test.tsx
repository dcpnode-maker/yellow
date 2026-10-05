import { expect, test } from "bun:test";
import type { GroupHeader } from "../frontend/yellow/src/group-reservations-api";
import { emptyGroupSearchPageState, failGroupSearchPage, filterGroupSearchRows, GROUP_SEARCH_SESSION_ENDED_MESSAGE, GROUP_SEARCH_SESSION_RESTORED_MESSAGE, groupSearchSessionEndedPageState, groupSearchSessionRestoredPageState, GroupSearchPageOwner, mergeGroupSearchPages, startGroupSearchPage, succeedGroupSearchPage } from "../frontend/yellow/src/workspaces/reservation-search";

Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { search: "" } } });
const { groupCollectionQuery } = await import("../frontend/yellow/src/group-reservations-api");

const header = (groupId: string, name: string, memberCount: number): GroupHeader => ({
  groupId, name, code: groupId, kind: "linked", status: "active", memberCount, roomsHeldByGroup: false,
});
test("search and browse continuation encode q, after and limit in their query strings", () => {
  const searched = new URLSearchParams(groupCollectionQuery("wedding & room", "after-1").slice(1));
  const browse = new URLSearchParams(groupCollectionQuery(null, "after browse").slice(1));
  expect(searched.get("q")).toBe("wedding & room");
  expect(searched.get("after")).toBe("after-1");
  expect(searched.get("limit")).toBe("50");
  expect(browse.has("q")).toBe(false);
  expect(browse.get("after")).toBe("after browse");
  expect(browse.get("limit")).toBe("50");
});

test("search without a continuation preserves its phrase and omits an empty cursor", () => {
  const query = new URLSearchParams(groupCollectionQuery("  phrase?&").slice(1));
  expect(query.get("q")).toBe("  phrase?&");
  expect(query.get("limit")).toBe("50");
  expect(query.has("after")).toBe(false);
});

test("page merge preserves first position, replaces later headers and never sums counts", () => {
  const merged = mergeGroupSearchPages([header("a", "First A", 2), header("b", "B", 1)],
    [header("a", "Updated A", 9), header("c", "C", 3)]);
  expect(merged.map(({ groupId }) => groupId)).toEqual(["a", "b", "c"]);
  expect(merged[0]).toEqual(header("a", "Updated A", 9));
  expect(merged[0]?.memberCount).toBe(9);
});

test("page owner synchronously rejects duplicate requests and stops repeated or cyclic cursors", () => {
  const owner = new GroupSearchPageOwner();
  const generation = owner.restart();
  const first = owner.begin("phrase", null, generation)!;
  expect(owner.begin("phrase", null, generation)).toBeNull();
  expect(owner.acceptNextCursor("cursor-a")).toBe(true);
  owner.finish(first);
  const second = owner.begin("phrase", "cursor-a", generation)!;
  expect(owner.acceptNextCursor("cursor-b")).toBe(true);
  owner.finish(second);
  const third = owner.begin("phrase", "cursor-b", generation)!;
  expect(owner.acceptNextCursor("cursor-a")).toBe(false);
  expect(owner.acceptNextCursor("cursor-c")).toBe(true);
  owner.finish(third);
  expect(owner.acceptNextCursor(null)).toBe(true);
});

test("different and same-query restarts revoke held page success and failure", async () => {
  const owner = new GroupSearchPageOwner();
  const published: string[] = [];
  let releaseOldSuccess!: () => void;
  const firstGeneration = owner.restart();
  const heldPage = owner.begin("old phrase", "cursor-1", firstGeneration)!;
  const lateSuccess = new Promise<void>((resolve) => { releaseOldSuccess = resolve; }).then(() => {
    if (owner.owns(heldPage)) published.push("old success");
    owner.finish(heldPage);
  });
  const secondGeneration = owner.restart();
  const freshSearch = owner.begin("new phrase", null, secondGeneration)!;
  if (owner.owns(freshSearch)) published.push("new result");
  owner.finish(freshSearch);
  releaseOldSuccess();
  await lateSuccess;
  expect(published).toEqual(["new result"]);

  let rejectOldPage!: (reason: Error) => void;
  const sameQueryGeneration = owner.restart();
  const heldFailure = owner.begin("new phrase", "cursor-2", sameQueryGeneration)!;
  const lateFailure = new Promise<void>((resolve) => {
    rejectOldPage = (reason) => { if (owner.owns(heldFailure)) published.push(`old failure: ${reason.message}`); resolve(); };
  }).finally(() => owner.finish(heldFailure));
  const restartedGeneration = owner.restart();
  const restartedPageOne = owner.begin("new phrase", null, restartedGeneration)!;
  if (owner.owns(restartedPageOne)) published.push("same-query page one");
  owner.finish(restartedPageOne);
  rejectOldPage(new Error("late transport failure"));
  await lateFailure;
  expect(published).toEqual(["new result", "same-query page one"]);
});

test("logout invalidation prevents a held page ticket from publishing", () => {
  const owner = new GroupSearchPageOwner();
  const generation = owner.restart();
  const ticket = owner.begin("phrase", "cursor-1", generation)!;
  owner.invalidate();
  expect(owner.owns(ticket)).toBe(false);
  expect(owner.begin("phrase", "cursor-1", generation)).toBeNull();
});

test("reauthentication or same-account renewal clears page data and requires a fresh search", () => {
  const loaded = succeedGroupSearchPage(emptyGroupSearchPageState(true),
    { groups: [header("a", "Previously authorized", 1)], nextCursor: "cursor-2" }, true, false);
  expect(loaded.rows).toHaveLength(1);
  expect(loaded.cursor).toBe("cursor-2");
  const expired = groupSearchSessionEndedPageState();
  expect(expired.rows).toEqual([]);
  expect(expired.cursor).toBeNull();
  expect(expired.loading).toBe(false);
  expect(expired.initialized).toBe(false);
  expect(expired.error).toBe(GROUP_SEARCH_SESSION_ENDED_MESSAGE);
  const restored = groupSearchSessionRestoredPageState();
  expect(restored.rows).toEqual([]);
  expect(restored.cursor).toBeNull();
  expect(restored.loading).toBe(false);
  expect(restored.initialized).toBe(false);
  expect(restored.error).toBeNull();
  expect(restored.announcement).toBe(GROUP_SEARCH_SESSION_RESTORED_MESSAGE);

  const owner = new GroupSearchPageOwner();
  const generation = owner.restart();
  const held = owner.begin("phrase", "cursor-2", generation)!;
  owner.invalidate();
  expect(owner.owns(held)).toBe(false);
  expect(groupSearchSessionRestoredPageState()).toEqual(restored);
});

test("page failure keeps partial rows and the retry cursor; denial clears rows and continuation", () => {
  const owner = new GroupSearchPageOwner();
  const generation = owner.restart();
  const firstTicket = owner.begin("phrase", null, generation)!;
  let state = succeedGroupSearchPage(emptyGroupSearchPageState(true), { groups: [header("a", "A", 1)], nextCursor: "cursor-1" }, true, false);
  owner.finish(firstTicket);
  const failedTicket = owner.begin("phrase", "cursor-1", generation)!;
  state = failGroupSearchPage(startGroupSearchPage(state), "temporary network failure", false, false);
  owner.finish(failedTicket);
  expect(state.rows.map(({ groupId }) => groupId)).toEqual(["a"]);
  expect(state.cursor).toBe("cursor-1");
  expect(state.initialized).toBe(true);
  expect(owner.begin("phrase", state.cursor, generation)?.cursor).toBe("cursor-1");

  const denied = failGroupSearchPage(state, "Group request was rejected (403).", false, true);
  expect(denied.rows).toEqual([]);
  expect(denied.cursor).toBeNull();
  expect(denied.loading).toBe(false);
  expect(denied.initialized).toBe(false);
  expect(denied.error).toContain("403");
  expect(denied.announcement).toContain("could not be loaded");
  const firstFailure = failGroupSearchPage(emptyGroupSearchPageState(true), "unavailable", true, false);
  expect(firstFailure.initialized).toBe(false);
});

test("filters cover all loaded rows and zero local matches retain server continuation", () => {
  const state = succeedGroupSearchPage(emptyGroupSearchPageState(true),
    { groups: [header("a", "A", 1), header("b", "B", 1)], nextCursor: "cursor-1" }, true, false);
  expect(filterGroupSearchRows(state.rows, "closed", "")).toEqual([]);
  expect(state.cursor).toBe("cursor-1");
});
