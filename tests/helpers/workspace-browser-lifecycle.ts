/** Small, test-only lifecycle bounds for the Order459 owned Chromium proof. */
export interface WorkspaceDeadline {
  readonly expiresAt: number;
  readonly now: () => number;
}

export interface WorkspacePendingCommand {
  readonly timer: ReturnType<typeof setTimeout>;
  reject(reason: Error): void;
}

export interface WorkspaceOwnedChild {
  readonly exitCode: number | null;
  readonly exited: Promise<unknown>;
  kill(signal?: number | "SIGKILL"): unknown;
}

export class WorkspaceLifecycleError extends Error {
  readonly stage: string;
  readonly elapsedMs: number;
  readonly latest: string;

  constructor(stage: string, elapsedMs: number, latest = "no progress") {
    super(`Workspace browser ${stage} exceeded its bounded lifecycle budget after ${Math.ceil(elapsedMs)}ms; latest: ${latest}`);
    this.stage = stage;
    this.elapsedMs = elapsedMs;
    this.latest = latest;
  }
}

export function workspaceDeadline(timeoutMs: number, now = () => performance.now()): WorkspaceDeadline {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new Error("Workspace browser deadline must be a positive integer within the outer test budget");
  }
  return Object.freeze({ expiresAt: now() + timeoutMs, now });
}

export function workspaceSubdeadline(parent: WorkspaceDeadline, maximumMs: number): WorkspaceDeadline {
  if (!Number.isSafeInteger(maximumMs) || maximumMs < 1) throw new Error("Workspace browser stage budget is invalid");
  return Object.freeze({ expiresAt: Math.min(parent.expiresAt, parent.now() + maximumMs), now: parent.now });
}

export function workspaceReservedWorkDeadline(parent: WorkspaceDeadline, cleanupReserveMs: number): WorkspaceDeadline {
  if (!Number.isSafeInteger(cleanupReserveMs) || cleanupReserveMs < 1) {
    throw new Error("Workspace browser cleanup reserve is invalid");
  }
  return Object.freeze({ expiresAt: Math.max(parent.now(), parent.expiresAt - cleanupReserveMs), now: parent.now });
}

export function workspaceRemaining(deadline: WorkspaceDeadline): number {
  return Math.max(0, Math.ceil(deadline.expiresAt - deadline.now()));
}

export async function withinWorkspaceBudget<T>(
  deadline: WorkspaceDeadline,
  stage: string,
  operation: () => Promise<T>,
  latest = "awaiting completion",
  onTimeout?: () => void,
): Promise<T> {
  const left = workspaceRemaining(deadline);
  if (left === 0) throw new WorkspaceLifecycleError(stage, 0, latest);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try { onTimeout?.(); } catch { /* timeout is still authoritative */ }
      reject(new WorkspaceLifecycleError(stage, left, latest));
    }, left);
  });
  try {
    return await Promise.race([operation(), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function pollWorkspaceStage<T>(options: {
  readonly deadline: WorkspaceDeadline;
  readonly stage: string;
  readonly probe: () => Promise<T | null>;
  readonly describe: (value: T | null) => string;
  readonly sleep: (milliseconds: number) => Promise<void>;
  readonly intervalMs?: number;
}): Promise<T> {
  const intervalMs = options.intervalMs ?? 20;
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1) throw new Error("Workspace browser poll interval is invalid");
  const startedAt = options.deadline.now();
  let latest = "no result";
  for (;;) {
    const value = await withinWorkspaceBudget(options.deadline, options.stage, options.probe, latest);
    latest = options.describe(value);
    if (value !== null) return value;
    const left = workspaceRemaining(options.deadline);
    if (left === 0) throw new WorkspaceLifecycleError(options.stage, options.deadline.now() - startedAt, latest);
    await options.sleep(Math.min(intervalMs, left));
  }
}

export async function readWorkspaceResponseBody(
  response: Response,
  deadline: WorkspaceDeadline,
  stage: string,
  maximumBytes: number,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new Error("Workspace browser response byte limit is invalid");
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > maximumBytes)) {
    throw new WorkspaceLifecycleError(stage, 0, "response content-length exceeds the bounded metadata body limit");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Workspace browser response has no body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const chunk = await withinWorkspaceBudget(
        deadline,
        stage,
        () => reader.read(),
        "waiting for bounded response metadata",
        () => { void reader.cancel().catch(() => undefined); },
      );
      if (chunk.done) break;
      if (!chunk.value) continue;
      total += chunk.value.byteLength;
      if (total > maximumBytes) {
        void reader.cancel().catch(() => undefined);
        throw new WorkspaceLifecycleError(stage, 0, "response body exceeds the bounded metadata body limit");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function settleWorkspacePending(
  pending: Map<number, WorkspacePendingCommand>,
  reason: string,
): void {
  const error = new Error(reason);
  for (const command of pending.values()) {
    clearTimeout(command.timer);
    command.reject(error);
  }
  pending.clear();
}

export async function reapWorkspaceChild(
  child: WorkspaceOwnedChild,
  deadline: WorkspaceDeadline,
): Promise<void> {
  let killError: unknown;
  try {
    if (child.exitCode === null) child.kill("SIGKILL");
  } catch (error) {
    killError = error;
  }
  try {
    await withinWorkspaceBudget(deadline, "owned Chromium reap", () => child.exited, "waiting for exact test-created child");
  } catch (error) {
    if (killError !== undefined) throw new AggregateError([killError, error], "Workspace browser cleanup failed");
    throw error;
  }
  if (killError !== undefined) throw killError;
}

export function preserveWorkspaceFailure(primary: unknown, cleanup: unknown): never {
  const primaryError = primary instanceof Error ? primary : new Error(String(primary));
  const cleanupError = cleanup instanceof Error ? cleanup : new Error(String(cleanup));
  throw new AggregateError([primaryError, cleanupError], "Workspace browser failed and cleanup also failed");
}
