import type { Subprocess } from "bun";

const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const MAX_LIFECYCLE_MS = 120_000;
const MAX_RESERVED_CLEANUP_MS = 250;
const DEADLINE = Symbol("owned-proof-process-deadline");

export interface OwnedProofProcessOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
  readonly maxOutputBytes?: number;
}

export interface OwnedProofProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

type OwnedProofSubprocess = Subprocess<"ignore", "pipe", "pipe">;

export class OwnedProofProcessDeadlineError extends Error {
  readonly stdout: string;
  readonly stderr: string;

  constructor(stdout: string, stderr: string) {
    super("owned proof process exceeded its lifecycle deadline");
    this.name = "OwnedProofProcessDeadlineError";
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

class OwnedProofProcessCleanupError extends Error {
  constructor() {
    super("owned proof process could not be reaped within its cleanup deadline");
    this.name = "OwnedProofProcessCleanupError";
  }
}

interface BoundedCollector {
  readonly done: Promise<void>;
  cancel(): Promise<void>;
  snapshot(): string;
}

function positiveInteger(name: string, value: unknown, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function collector(stream: ReadableStream<Uint8Array>, maximumBytes: number): BoundedCollector {
  const chunks: Uint8Array[] = [];
  let retained = 0;
  const reader = stream.getReader();

  const append = (value: Uint8Array): void => {
    if (value.byteLength >= maximumBytes) {
      chunks.splice(0, chunks.length, value.slice(value.byteLength - maximumBytes));
      retained = maximumBytes;
      return;
    }
    chunks.push(value.slice());
    retained += value.byteLength;
    while (retained > maximumBytes) {
      const excess = retained - maximumBytes;
      const first = chunks[0]!;
      if (first.byteLength <= excess) {
        chunks.shift();
        retained -= first.byteLength;
      } else {
        chunks[0] = first.slice(excess);
        retained -= excess;
      }
    }
  };

  const done = (async () => {
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        append(next.value);
      }
    } finally {
      reader.releaseLock();
    }
  })();

  return {
    done,
    async cancel() {
      try {
        await reader.cancel();
      } catch {
        // The read loop records the stream failure; cleanup still waits for its
        // finally block to release the lock before returning.
      }
      await done.catch(() => undefined);
    },
    snapshot() {
      const bytes = new Uint8Array(retained);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      let text = new TextDecoder().decode(bytes);
      const encoder = new TextEncoder();
      if (encoder.encode(text).byteLength <= maximumBytes) return text;
      let low = 0;
      let high = text.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (encoder.encode(text.slice(middle)).byteLength <= maximumBytes) high = middle;
        else low = middle + 1;
      }
      if (low < text.length && low > 0
          && text.charCodeAt(low) >= 0xdc00 && text.charCodeAt(low) <= 0xdfff) low += 1;
      text = text.slice(low);
      while (text.length > 0 && encoder.encode(text).byteLength > maximumBytes) text = text.slice(1);
      return text;
    },
  };
}

async function terminate(child: OwnedProofSubprocess): Promise<void> {
  let killFailure: unknown;
  try {
    if (child.exitCode === null) child.kill("SIGKILL");
  } catch (error) {
    killFailure = error;
  }
  await child.exited;
  if (killFailure !== undefined) throw killFailure;
}

async function cleanupWithin(
  child: OwnedProofSubprocess,
  stdout: BoundedCollector,
  stderr: BoundedCollector,
  remainingMs: number,
): Promise<boolean> {
  // Start all three operations before waiting. allSettled owns every rejection
  // even if the outer deadline wins and native stream cancellation settles later.
  const cleanup = Promise.allSettled([
    terminate(child),
    stdout.cancel(),
    stderr.cancel(),
  ]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), Math.max(0, remainingMs));
  });
  try {
    const result = await Promise.race([cleanup, deadline]);
    return result !== undefined && result.every(item => item.status === "fulfilled");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function runOwnedProofProcess(
  command: readonly string[],
  options: OwnedProofProcessOptions,
): Promise<OwnedProofProcessResult> {
  if (command.length === 0 || command.some(value => typeof value !== "string" || value.length === 0)) {
    throw new Error("owned proof process command must contain non-empty arguments");
  }
  const timeoutMs = positiveInteger("timeoutMs", options.timeoutMs, MAX_LIFECYCLE_MS);
  const maxOutputBytes = positiveInteger(
    "maxOutputBytes",
    options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
    MAX_OUTPUT_BYTES,
  );
  const startedAt = performance.now();
  const expiresAt = startedAt + timeoutMs;
  const cleanupReserveMs = Math.min(
    MAX_RESERVED_CLEANUP_MS,
    Math.max(1, Math.floor(timeoutMs / 4)),
  );
  const child = Bun.spawn([...command], {
    cwd: options.cwd,
    env: options.env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = collector(child.stdout, maxOutputBytes);
  const stderr = collector(child.stderr, maxOutputBytes);
  const completed = Promise.all([child.exited, stdout.done, stderr.done]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    const operationRemainingMs = Math.max(
      0,
      Math.ceil(expiresAt - performance.now() - cleanupReserveMs),
    );
    timer = setTimeout(() => reject(DEADLINE), operationRemainingMs);
  });

  try {
    const [exitCode] = await Promise.race([completed, deadline]);
    return Object.freeze({ exitCode, stdout: stdout.snapshot(), stderr: stderr.snapshot() });
  } catch (error) {
    const cleaned = await cleanupWithin(
      child,
      stdout,
      stderr,
      Math.max(0, Math.ceil(expiresAt - performance.now())),
    );
    if (!cleaned) throw new OwnedProofProcessCleanupError();
    if (error === DEADLINE) {
      throw new OwnedProofProcessDeadlineError(stdout.snapshot(), stderr.snapshot());
    }
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
