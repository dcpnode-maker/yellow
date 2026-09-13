import { expect, test } from "bun:test";

import {
  WorkspaceLifecycleError,
  pollWorkspaceStage,
  preserveWorkspaceFailure,
  readWorkspaceResponseBody,
  reapWorkspaceChild,
  settleWorkspacePending,
  withinWorkspaceBudget,
  workspaceDeadline,
  workspaceRemaining,
  workspaceReservedWorkDeadline,
} from "./helpers/workspace-browser-lifecycle";

test("Q278 bounds a hanging target fetch or body and reports its stage", async () => {
  let cancelled = false;
  await expect(withinWorkspaceBudget(
    workspaceDeadline(15),
    "target response body",
    () => new Promise<never>(() => undefined),
    "waiting for DevTools target JSON",
    () => { cancelled = true; },
  )).rejects.toMatchObject({ stage: "target response body", latest: "waiting for DevTools target JSON" });
  expect(cancelled).toBe(true);
});

test("Q278 rejects an oversized DevTools metadata body before it becomes unbounded", async () => {
  const oversized = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(17));
      controller.close();
    },
  }));
  await expect(readWorkspaceResponseBody(oversized, workspaceDeadline(25), "DevTools target response body", 16))
    .rejects.toMatchObject({ stage: "DevTools target response body", latest: "response body exceeds the bounded metadata body limit" });
});

test("Q278 reserves cleanup time and rejects work commands when that work budget expires", () => {
  let now = 0;
  const lifecycleEnd = workspaceDeadline(20, () => now);
  const work = workspaceReservedWorkDeadline(lifecycleEnd, 5);
  expect(work.expiresAt).toBe(15);
  now = 15;
  expect(workspaceRemaining(work)).toBe(0);
  expect(workspaceRemaining(lifecycleEnd)).toBe(5);
});

test("Q278 uses elapsed polling budgets rather than a pass-count and retains latest diagnostics", async () => {
  let now = 0;
  await expect(pollWorkspaceStage({
    deadline: workspaceDeadline(10, () => now),
    stage: "layout proof",
    probe: async () => null,
    describe: () => "layout-proof is empty",
    sleep: async (milliseconds) => { now += milliseconds; },
    intervalMs: 4,
  })).rejects.toMatchObject({ stage: "layout proof", latest: "layout-proof is empty" });
});

test("Q278 settles pending debugger commands when its socket closes", async () => {
  let reject!: (reason: Error) => void;
  const command = new Promise<never>((_, rejectCommand) => { reject = rejectCommand; });
  const pending = new Map([[7, { timer: setTimeout(() => undefined, 1_000), reject }]]);
  settleWorkspacePending(pending, "Chromium debugger socket closed");
  await expect(command).rejects.toThrow("Chromium debugger socket closed");
  expect(pending.size).toBe(0);
});

test("Q278 reaps only the owned child within a deadline and preserves primary plus cleanup failure", async () => {
  let killed = 0;
  await reapWorkspaceChild({ exitCode: null, exited: Promise.resolve(0), kill: signal => {
    expect(signal).toBe("SIGKILL"); killed += 1;
  } }, workspaceDeadline(20));
  expect(killed).toBe(1);

  await expect(reapWorkspaceChild({ exitCode: null, exited: new Promise(() => undefined), kill: () => undefined }, workspaceDeadline(15)))
    .rejects.toBeInstanceOf(WorkspaceLifecycleError);
  expect(() => preserveWorkspaceFailure(new Error("primary journey failure"), new Error("owned cleanup failure")))
    .toThrow(AggregateError);
  try {
    preserveWorkspaceFailure(new Error("primary journey failure"), new Error("owned cleanup failure"));
  } catch (error) {
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors.map(item => (item as Error).message)).toEqual([
      "primary journey failure", "owned cleanup failure",
    ]);
  }
});
