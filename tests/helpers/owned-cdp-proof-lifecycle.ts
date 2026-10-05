import type { Subprocess } from "bun";

const MAX_TRANSPORT_MS = 5_000;

export class CdpTransportTimeoutError extends Error {
  constructor() {
    super("CDP HTTP transport exceeded its deadline");
    this.name = "CdpTransportTimeoutError";
  }
}

export class OwnedProcessCleanupError extends Error {
  constructor() {
    super("owned browser process did not exit after bounded termination");
    this.name = "OwnedProcessCleanupError";
  }
}

export interface OwnedProcessCleanupOptions {
  readonly gracefulRequestMs?: number;
  readonly gracefulExitMs?: number;
  readonly terminateSignalMs?: number;
  readonly killWaitMs?: number;
}

function bound(name: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_TRANSPORT_MS) {
    throw new Error(`${name} must be an integer between 1 and ${MAX_TRANSPORT_MS}`);
  }
  return value;
}

/** Fetch JSON with one deadline covering headers and complete body parsing. */
export async function fetchJsonBounded<Result>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = MAX_TRANSPORT_MS,
): Promise<Result> {
  const timeout = bound("timeoutMs", timeoutMs);
  const controller = new AbortController();
  const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const request = (async () => {
    const response = await fetch(input, { ...init, signal });
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      throw new Error(`CDP HTTP request failed (${response.status})`);
    }
    return await response.json() as Result;
  })();
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new CdpTransportTimeoutError());
    }, timeout);
  });
  try {
    return await Promise.race([request, deadline]);
  } catch (error) {
    if (timedOut) throw new CdpTransportTimeoutError();
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

type OwnedSubprocess = Subprocess;

function childHasExited(child: OwnedSubprocess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

async function exitedWithin(child: OwnedSubprocess, timeoutMs: number): Promise<boolean> {
  if (childHasExited(child)) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>(resolve => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([child.exited.then(() => true as const), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function boundedGracefulRequest(request: () => Promise<unknown>, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>(resolve => {
    timer = setTimeout(() => resolve(undefined), timeoutMs);
  });
  try {
    await Promise.race([Promise.resolve().then(request).then(() => true), timeout]);
  } catch {
    // A failed browser close request still proceeds through exact-child exit
    // observation and bounded signal escalation.
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Close an exact Bun child gracefully, then TERM/KILL only that child if needed. */
export async function terminateOwnedProcess(
  child: OwnedSubprocess,
  requestGracefulClose?: () => Promise<unknown>,
  options: OwnedProcessCleanupOptions = {},
): Promise<void> {
  const gracefulRequestMs = bound("gracefulRequestMs", options.gracefulRequestMs ?? 500);
  const gracefulExitMs = bound("gracefulExitMs", options.gracefulExitMs ?? 250);
  const terminateSignalMs = bound("terminateSignalMs", options.terminateSignalMs ?? 250);
  const killWaitMs = bound("killWaitMs", options.killWaitMs ?? 1_500);
  if (childHasExited(child)) return;

  if (requestGracefulClose) {
    await boundedGracefulRequest(requestGracefulClose, gracefulRequestMs);
  }
  if (await exitedWithin(child, gracefulExitMs)) return;

  try {
    if (!childHasExited(child)) child.kill("SIGTERM");
  } catch {
    if (!childHasExited(child)) {
      try { child.kill("SIGKILL"); } catch { /* final bounded observation reports failure */ }
    }
  }
  if (await exitedWithin(child, terminateSignalMs)) return;

  try {
    if (!childHasExited(child)) child.kill("SIGKILL");
  } catch {
    if (childHasExited(child)) return;
  }
  if (!await exitedWithin(child, killWaitMs)) throw new OwnedProcessCleanupError();
}

/** Preserve a proof callback error if owned-child cleanup also reports an error. */
export async function withOwnedProcess<Result>(
  child: OwnedSubprocess,
  run: () => Promise<Result>,
  requestGracefulClose?: () => Promise<unknown>,
  options: OwnedProcessCleanupOptions = {},
): Promise<Result> {
  let runFailed = false;
  try {
    return await run();
  } catch (error) {
    runFailed = true;
    throw error;
  } finally {
    try {
      await terminateOwnedProcess(child, requestGracefulClose, options);
    } catch (cleanupError) {
      if (!runFailed) throw cleanupError;
    }
  }
}
