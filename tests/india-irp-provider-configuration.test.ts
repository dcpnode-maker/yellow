import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  INDIA_IRP_PROVIDER_DEPLOYMENT_LIMITS,
  loadIndiaIrpAdapterRegistrationsFromEnvironment,
} from "../src/contexts/tax-fiscal/india-irp-provider-configuration";
import { FiscalSubmissionAdapterAvailabilityService } from
  "../src/contexts/tax-fiscal/fiscal-submission-adapter-availability";
import { VerifiedIndiaIrpAdapterRegistry } from "../src/contexts/tax-fiscal/fiscal-submission-worker";

const PROVIDERS_FILE = "YELLOW_INDIA_IRP_PROVIDERS_FILE";
const roots: string[] = [];
const now = Date.UTC(2044, 8, 7, 12, 0, 0);
let encryptionSpki = "";
let signingSpki = "";

beforeAll(() => {
  encryptionSpki = generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 0x10001 })
    .publicKey.export({ format: "der", type: "spki" }).toString("base64");
  signingSpki = generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 0x10001 })
    .publicKey.export({ format: "der", type: "spki" }).toString("base64");
}, 30_000);

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function directory(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "yellow-q207-provider-configuration-"));
  roots.push(root);
  return root;
}

function gstin(body = "29ABCDE1234F1Z"): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let factor = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const product = factor * alphabet.indexOf(body[index]!);
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(product / 36) + product % 36;
  }
  return body + alphabet[(36 - sum % 36) % 36]!;
}

function configuration(providerKey: string): string {
  return JSON.stringify({
    protocolProfile: "clearirp_direct_v1_04_v1_03_v1",
    providerKey,
    environment: "sandbox",
    apiBaseUrl: "https://fictional.clearirp.invalid/",
    encryptionSpkiDerBase64: encryptionSpki,
    issuer: "YELLOW-FICTIONAL-IRP",
    profileVersion: "yellow_native_india_1_1_v1",
    trustBundleJson: JSON.stringify({ version: "fictional-bundle-v1", keys: [{
      id: "fictional-signing-key", spkiDerBase64: signingSpki,
      notBeforeUnixMs: now - 60_000, notAfterUnixMs: now + 60_000,
    }] }),
    sekEncoding: "raw32",
    tokenExpiryUtcOffsetMinutes: 330,
    definitiveRejectionCodes: ["2150"], duplicateCodes: ["2154"], notFoundCodes: ["2143"],
  });
}

function credentials() {
  return { clientId: "fictional-client", clientSecret: "fictional-secret", userName: "fictional-user",
    password: "fictional-password", gstin: gstin() };
}

async function privateFile(path: string, content: string | Uint8Array): Promise<void> {
  await writeFile(path, content, { flag: "wx", mode: 0o600 });
  if (process.platform !== "win32") await chmod(path, 0o600);
}

async function validFiles(entries: readonly { providerKey: string; extensionId: string; version?: number;
  credentialsText?: string }[] = [{
    providerKey: "clearirp-direct-fictional", extensionId: "00000000-0000-4000-8000-000000000701",
  }]): Promise<{ root: string; manifest: string; entries: Record<string, unknown>[] }> {
  const root = await directory();
  const manifest = join(root, "providers.json");
  const values: Record<string, unknown>[] = [];
  for (const [index, entry] of entries.entries()) {
    const secrets = join(root, `credentials-${index}.json`);
    await privateFile(secrets, entry.credentialsText ?? JSON.stringify(credentials()));
    values.push({ providerExtensionId: entry.extensionId, providerExtensionVersion: entry.version ?? 1,
      protocolConfigurationJson: configuration(entry.providerKey), credentialsFile: secrets });
  }
  await privateFile(manifest, JSON.stringify({ version: 1, providers: values }));
  return { root, manifest, entries: values };
}

function environment(manifest?: string): NodeJS.ProcessEnv {
  return manifest === undefined ? {} : { [PROVIDERS_FILE]: manifest };
}

function expectSanitized(result: unknown, forbidden: readonly string[]): void {
  expect(result).toMatchObject({ ok: false, error: { code: expect.any(String), message: expect.any(String) } });
  const serialized = JSON.stringify(result);
  for (const value of forbidden) expect(serialized).not.toContain(value);
  expect(serialized).not.toMatch(/password|clientSecret|credentials-|providers\.json|ENOENT|EACCES|stack/iu);
}

describe("Q207 protected India IRP provider configuration", () => {
  test("is default-off with one immutable empty result and no file or option evaluation", async () => {
    let called = 0;
    const options = Object.defineProperty({}, "fetch", { enumerable: true, get() { called++; return fetch; } });
    const result = await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(), options as never);
    expect(result).toEqual({ ok: true, value: [] });
    expect(called).toBe(0);
    expect(Object.isFrozen(result)).toBe(true);
    if (result.ok) expect(Object.isFrozen(result.value)).toBe(true);
  });

  test("constructs a frozen all-real registry without network activity", async () => {
    const files = await validFiles([
      { providerKey: "clearirp-direct-fictional", extensionId: "00000000-0000-4000-8000-000000000711" },
      { providerKey: "clearirp-direct-fictional", extensionId: "00000000-0000-4000-8000-000000000712", version: 2 },
    ]);
    let fetchCalls = 0;
    const testFetch = (async () => {
      fetchCalls++;
      throw new Error("network must not run during load");
    }) as unknown as typeof fetch;
    const result = await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(files.manifest), {
      fetch: testFetch, clock: () => now,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.code);
    expect(fetchCalls).toBe(0);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(result.value.map(({ providerKey, providerExtensionId, providerExtensionVersion }) => ({
      providerKey, providerExtensionId, providerExtensionVersion,
    }))).toEqual([
      { providerKey: "clearirp-direct-fictional", providerExtensionId: "00000000-0000-4000-8000-000000000711",
        providerExtensionVersion: 1 },
      { providerKey: "clearirp-direct-fictional", providerExtensionId: "00000000-0000-4000-8000-000000000712",
        providerExtensionVersion: 2 },
    ]);
    for (const registration of result.value) {
      expect(Object.isFrozen(registration)).toBe(true);
      expect(registration.kind).toBe("registered_verified_india_irp_1_1_adapter");
      expect(typeof registration.submit).toBe("function");
      expect(typeof registration.lookup).toBe("function");
    }
    const workerRegistry = new VerifiedIndiaIrpAdapterRegistry(result.value);
    const identities = workerRegistry.identities();
    expect(identities).toEqual(result.value.map((value) => ({
      providerKey: value.providerKey, providerExtensionId: value.providerExtensionId,
      providerExtensionVersion: value.providerExtensionVersion,
    })));
    const availability = new FiscalSubmissionAdapterAvailabilityService(identities);
    for (const identity of identities) {
      expect(availability.find(identity.providerExtensionId)).toEqual(identity);
    }
    await writeFile(files.manifest, "{}", "utf8");
    expect(result.value).toHaveLength(2);
  }, 30_000);

  test("rejects every repeated provider row UUID before reading duplicate credentials", async () => {
    const files = await validFiles();
    const first = files.entries[0]!;
    const missingCredentials = join(files.root, "must-not-read-duplicate-credentials.json");
    const repeated = [
      first,
      { ...first, providerExtensionVersion: 2, credentialsFile: missingCredentials },
      { ...first, protocolConfigurationJson: configuration("clearirp-direct-other"),
        credentialsFile: missingCredentials },
    ];
    for (const [index, second] of repeated.entries()) {
      const manifest = join(files.root, `repeated-row-${index}.json`);
      await privateFile(manifest, JSON.stringify({ version: 1, providers: [first, second] }));
      let fetchCalls = 0;
      const result = await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(manifest), {
        fetch: (async () => {
          fetchCalls++;
          throw new Error("provider transport must not run during load");
        }) as unknown as typeof fetch,
        clock: () => now,
      });
      expect(result).toEqual({ ok: false, error: {
        code: "invalid_manifest", message: "India IRP provider deployment manifest is invalid",
      } });
      expect(result).not.toHaveProperty("value");
      expect(fetchCalls).toBe(0);
      expectSanitized(result, [files.root, missingCredentials, "fictional-secret"]);
    }
  }, 30_000);

  test("rejects invalid environment paths without treating a URL as deployment configuration", async () => {
    for (const path of ["relative/providers.json", "https://example.invalid/providers.json",
      "file:///tmp/providers.json", "//server/share/providers.json", "\\\\server\\share\\providers.json",
      ...(process.platform === "win32" ? ["/rooted-but-drive-ambiguous.json", "\\rooted-but-drive-ambiguous.json"] : []),
      `bad\0path`, "x".repeat(4097)]) {
      const result = await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(path));
      expectSanitized(result, [path]);
    }
  });

  test("enforces strict duplicate-free manifest and entry shapes all-or-nothing", async () => {
    const cases: string[] = [
      '{"version":1,"version":1,"providers":[]}',
      '{"version":1,"providers":[],"extra":null}',
      '{"version":2,"providers":[]}',
      JSON.stringify({ version: 1, providers: Array.from({ length: 17 }, () => null) }),
      JSON.stringify({ version: 1, providers: [null] }),
    ];
    for (const content of cases) {
      const root = await directory();
      const manifest = join(root, "providers.json");
      await privateFile(manifest, content);
      expectSanitized(await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(manifest)), [root]);
    }

    const files = await validFiles();
    for (const mutate of [
      (entry: Record<string, unknown>) => ({ ...entry, extra: null }),
      (entry: Record<string, unknown>) => ({ ...entry, providerExtensionId: "bad" }),
      (entry: Record<string, unknown>) => ({ ...entry, providerExtensionVersion: 0 }),
      (entry: Record<string, unknown>) => ({ ...entry, protocolConfigurationJson: {} }),
      (entry: Record<string, unknown>) => ({ ...entry, credentialsFile: "relative.json" }),
    ]) {
      const manifest = join(files.root, `invalid-${crypto.randomUUID()}.json`);
      await privateFile(manifest, JSON.stringify({ version: 1, providers: [mutate(files.entries[0]!)] }));
      expectSanitized(await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(manifest)), [files.root]);
    }
    const duplicate = join(files.root, "duplicate.json");
    await privateFile(duplicate, JSON.stringify({ version: 1, providers: [files.entries[0], files.entries[0]] }));
    expectSanitized(await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(duplicate)), [files.root]);
    const partial = join(files.root, "partial.json");
    await privateFile(partial, JSON.stringify({ version: 1, providers: [files.entries[0],
      { ...files.entries[0], providerExtensionId: "00000000-0000-4000-8000-000000000799",
        protocolConfigurationJson: "{}" }] }));
    const failed = await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(partial));
    expectSanitized(failed, [files.root, "fictional-secret"]);
    expect(failed).not.toHaveProperty("value");
  }, 30_000);

  test("accepts exact byte ceilings and rejects ceiling-plus-one before parsing", async () => {
    const root = await directory();
    const empty = '{"version":1,"providers":[]}';
    for (const delta of [0, 1]) {
      const manifest = join(root, `manifest-${delta}.json`);
      const content = empty + " ".repeat(INDIA_IRP_PROVIDER_DEPLOYMENT_LIMITS.maxManifestBytes + delta - empty.length);
      await privateFile(manifest, content);
      const result = await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(manifest));
      expect(result.ok).toBe(delta === 0);
    }

    const valid = await validFiles();
    const base = JSON.stringify(credentials());
    for (const delta of [0, 1]) {
      const secret = join(root, `secret-${delta}.json`);
      await privateFile(secret, base + " ".repeat(
        INDIA_IRP_PROVIDER_DEPLOYMENT_LIMITS.maxCredentialsBytes + delta - base.length,
      ));
      const manifest = join(root, `secret-manifest-${delta}.json`);
      await privateFile(manifest, JSON.stringify({ version: 1, providers: [{
        ...valid.entries[0], credentialsFile: secret,
      }] }));
      const result = await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(manifest));
      expect(result.ok).toBe(delta === 0);
    }
  }, 30_000);

  test("rejects malformed, missing, directory, symlink and insecure secret files with sanitized errors", async () => {
    const files = await validFiles();
    const invalidUtf8 = join(files.root, "invalid-utf8.json");
    await privateFile(invalidUtf8, new Uint8Array([0xff]));
    const directoryPath = await directory();
    const missing = join(files.root, "missing-private-value.json");
    const wrongSecret = join(files.root, "wrong-secret.json");
    await privateFile(wrongSecret, '{"clientId":"private","clientId":"duplicate"}');
    for (const credentialsFile of [invalidUtf8, directoryPath, missing, wrongSecret]) {
      const manifest = join(files.root, `bad-file-${crypto.randomUUID()}.json`);
      await privateFile(manifest, JSON.stringify({ version: 1, providers: [{
        ...files.entries[0], credentialsFile,
      }] }));
      expectSanitized(await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(manifest)),
        [files.root, credentialsFile]);
    }
    expectSanitized(await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(directoryPath)), [directoryPath]);

    for (const [index, value] of [
      { ...credentials(), extra: "private" },
      { clientId: "private", clientSecret: "private", userName: "private", password: "private" },
      { ...credentials(), password: 1 },
    ].entries()) {
      const credentialPath = join(files.root, `wrong-shape-${index}.json`);
      await privateFile(credentialPath, JSON.stringify(value));
      const manifest = join(files.root, `wrong-shape-manifest-${index}.json`);
      await privateFile(manifest, JSON.stringify({ version: 1, providers: [{
        ...files.entries[0], credentialsFile: credentialPath,
      }] }));
      expectSanitized(await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(manifest)),
        [files.root, "private"]);
    }

    if (process.platform !== "win32") {
      const accessible = join(files.root, "group-readable-secret.json");
      await privateFile(accessible, JSON.stringify(credentials()));
      await chmod(accessible, 0o640);
      const manifest = join(files.root, "insecure-secret-manifest.json");
      await privateFile(manifest, JSON.stringify({ version: 1, providers: [{
        ...files.entries[0], credentialsFile: accessible,
      }] }));
      expectSanitized(await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(manifest)), [files.root]);
    }

    const targetSecret = files.entries[0]!.credentialsFile as string;
    const secretLink = join(files.root, "secret-link.json");
    const manifestLink = join(files.root, "manifest-link.json");
    try {
      await symlink(targetSecret, secretLink, "file");
      const linkedSecretManifest = join(files.root, "linked-secret-manifest.json");
      await privateFile(linkedSecretManifest, JSON.stringify({ version: 1, providers: [{
        ...files.entries[0], credentialsFile: secretLink,
      }] }));
      expectSanitized(await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(linkedSecretManifest)), [files.root]);
      await symlink(files.manifest, manifestLink, "file");
      expectSanitized(await loadIndiaIrpAdapterRegistrationsFromEnvironment(environment(manifestLink)), [files.root]);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform !== "win32" || (code !== "EPERM" && code !== "EACCES")) throw error;
    }
  }, 30_000);

  test.skipIf(process.platform === "win32")(
    "refuses a POSIX FIFO without waiting for a writer and reaps only its owned setup/proof children",
    async () => {
      const root = await directory();
      const fifo = join(root, "providers.fifo");
      const runOwned = async (command: readonly string[], timeoutMs: number): Promise<number> => {
        const child = Bun.spawn([...command], { stdout: "ignore", stderr: "ignore" });
        let timer: ReturnType<typeof setTimeout> | undefined;
        let exited = false;
        try {
          const result = await Promise.race([
            child.exited.then((code) => { exited = true; return { kind: "exit" as const, code }; }),
            new Promise<{ kind: "timeout" }>((resolve) => {
              timer = setTimeout(() => resolve({ kind: "timeout" }), timeoutMs);
            }),
          ]);
          if (result.kind === "timeout") throw new Error("owned Q207 FIFO proof child exceeded its deadline");
          return result.code;
        } finally {
          if (timer) clearTimeout(timer);
          if (!exited) {
            child.kill();
            let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
            const cleaned = await Promise.race([
              child.exited.then(() => true, () => true),
              new Promise<boolean>((resolve) => {
                cleanupTimer = setTimeout(() => resolve(false), 500);
              }),
            ]);
            if (cleanupTimer) clearTimeout(cleanupTimer);
            if (!cleaned) throw new Error("owned Q207 FIFO proof child cleanup was not confirmed");
          }
        }
      };
      expect(await runOwned(["mkfifo", fifo], 1_000)).toBe(0);
      const moduleUrl = new URL("../src/contexts/tax-fiscal/india-irp-provider-configuration.ts", import.meta.url).href;
      const proof = `import {loadIndiaIrpAdapterRegistrationsFromEnvironment as load} from ${JSON.stringify(moduleUrl)};`
        + `const result=await load({YELLOW_INDIA_IRP_PROVIDERS_FILE:${JSON.stringify(fifo)}});`
        + `process.exitCode=result.ok?2:0;`;
      expect(await runOwned([process.execPath, "-e", proof], 1_000)).toBe(0);
    },
    5_000,
  );
});
