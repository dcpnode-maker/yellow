/** Order472 independent Windows proof; explicitly opt in to this host's native fixtures. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import {
  closeSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync,
  readFileSync, readdirSync, renameSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarketRegionalArtifactCatalog } from "../src/runtime/market-regional-artifact-loader";

const enabled = process.env.YELLOW_NATIVE_MARKET_PROOF === "1";
const parent = "E:\\yellow\\market-discovery\\order472";
const powershell = "C:\\Users\\astha\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\powershell\\pwsh.exe";
const helper = fileURLToPath(new URL("../scripts/native/read-market-regional-artifact.ps1", import.meta.url));
const rejected = { format: "yellow/market-regional-read/v1", error: "invalid_regional_snapshot" };
const payload = Buffer.from("Yellow native read proof · नमस्ते", "utf8");
let ownedRoot = "";

type Receipt = { format: string; error?: string; byteLength?: number; bytesBase64?: string };

function invoke(args: string[]): Promise<{ code: number; receipt: Receipt; stderr: string }> {
  return new Promise((fulfil, reject) => {
    execFile(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", helper, ...args], {
      shell: false, windowsHide: true, timeout: 12_000, maxBuffer: 6 * 1024 * 1024, encoding: "utf8",
    }, (error, stdout, stderr) => {
      if (error && (error.killed || typeof error.code !== "number")) return reject(new Error("native reader did not exit within its bounded transport"));
      try {
        fulfil({ code: error ? Number(error.code) : 0, receipt: JSON.parse(stdout.trim()) as Receipt, stderr });
      } catch { reject(new Error("native reader did not emit one JSON receipt")); }
    });
  });
}

function read(relativePath: string, expectedLength = payload.length, rootDirectory = ownedRoot) {
  return invoke(["-RootDirectory", rootDirectory, "-RelativePath", relativePath, "-ExpectedLength", String(expectedLength)]);
}

async function expectRejected(relativePath: string, expectedLength = payload.length, rootDirectory = ownedRoot) {
  const result = await read(relativePath, expectedLength, rootDirectory);
  expect(result).toEqual({ code: 1, receipt: rejected, stderr: "" });
}

// Delete only the exclusive test directory. Inspect links rather than following them;
// never recursively remove an existing archive, root, symlink target or broad drive path.
function removeOwned(path: string): void {
  const absolute = resolve(path);
  const root = resolve(ownedRoot);
  if (!ownedRoot || !basename(root).startsWith("native-proof-")
    || resolve(join(root, "..")).toLowerCase() !== resolve(parent).toLowerCase()
    || !(absolute.toLowerCase() === root.toLowerCase() || absolute.toLowerCase().startsWith(`${root.toLowerCase()}\\`))) {
    throw new Error("refusing cleanup outside exclusive native fixture directory");
  }
  const item = lstatSync(absolute);
  if (item.isSymbolicLink()) { unlinkSync(absolute); return; }
  if (!item.isDirectory()) { unlinkSync(absolute); return; }
  for (const name of readdirSync(absolute)) removeOwned(join(absolute, name));
  rmdirSync(absolute);
}

describe.skipIf(!enabled)("Order472 actual native file and catalog proof", () => {
  beforeAll(() => {
    if (process.platform !== "win32") throw new Error("requested native proof requires Windows; cannot report a platform skip as proof");
    // Parent must already exist; do not invent or repair deployment directories.
    expect(lstatSync(parent).isDirectory()).toBe(true);
    expect(lstatSync(parent).isSymbolicLink()).toBe(false);
    ownedRoot = mkdtempSync(join(parent, "native-proof-"));
    writeFileSync(join(ownedRoot, "regular.json"), payload, { flag: "wx" });
    mkdirSync(join(ownedRoot, "nested"));
    writeFileSync(join(ownedRoot, "nested", "नमस्ते.json"), payload, { flag: "wx" });
  });

  afterAll(() => { if (ownedRoot) removeOwned(ownedRoot); });

  test("reads actual exact bytes, including Unicode path, and closes handles", async () => {
    for (const relative of ["regular.json", "nested\\नमस्ते.json"]) {
      const result = await read(relative);
      expect(result.code).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.receipt).toEqual({ format: "yellow/market-regional-read/v1", byteLength: payload.length, bytesBase64: payload.toString("base64") });
    }
    const original = join(ownedRoot, "regular.json");
    const renamed = join(ownedRoot, "renamed.json");
    renameSync(original, renamed);
    renameSync(renamed, original);
    expect(readFileSync(original).equals(payload)).toBe(true);
  }, 30_000);

  test("fails closed for missing/non-regular files and length bounds", async () => {
    await expectRejected("missing.json");
    await expectRejected("nested");
    await expectRejected("regular.json", payload.length - 1);
    await expectRejected("regular.json", payload.length + 1);
    await expectRejected("regular.json", 0);
    await expectRejected("regular.json", 4_194_305);
  }, 60_000);

  test("rejects traversal, absolute, device, ADS and malformed path components", async () => {
    for (const path of ["..\\regular.json", ".\\regular.json", "nested\\..\\regular.json", "E:\\regular.json",
      "\\\\server\\share\\file", "\\\\?\\E:\\file", "regular.json:stream", "NUL", "COM¹.txt",
      "regular.json.", "regular.json ", "nested\\\\file", "bad\nfile"]) await expectRejected(path);
    for (const root of ["E:relative", "\\\\server\\share", "\\\\?\\E:\\yellow", `${ownedRoot}\\..`]) {
      await expectRejected("regular.json", payload.length, root);
    }
  }, 60_000);

  test("contains malformed command arguments in the same non-secret receipt", async () => {
    for (const args of [[], ["-Unexpected", "private-sentinel"], ["-RootDirectory", ownedRoot, "-RelativePath", "regular.json", "-ExpectedLength", "private-sentinel"]]) {
      expect(await invoke(args)).toEqual({ code: 1, receipt: rejected, stderr: "" });
    }
  }, 30_000);

  test("rejects actual ancestor junctions and hard-linked regular leaves", async () => {
    const target = join(ownedRoot, "nested");
    const junction = join(ownedRoot, "junction");
    symlinkSync(target, junction, "junction");
    expect(lstatSync(junction).isSymbolicLink()).toBe(true);
    await expectRejected("junction\\नमस्ते.json");
    await expectRejected("नमस्ते.json", payload.length, junction);
    // A directory reparse leaf is also rejected rather than followed.
    await expectRejected("junction");
    expect(readFileSync(join(target, "नमस्ते.json")).equals(payload)).toBe(true);
    const original = join(ownedRoot, "hard-original.json");
    writeFileSync(original, payload, { flag: "wx" });
    const hardLink = join(ownedRoot, "hard-link.json");
    linkSync(original, hardLink);
    expect(lstatSync(hardLink).nlink).toBe(2);
    await expectRejected("hard-link.json");
    await expectRejected("hard-original.json");
  }, 60_000);

  test("rejects a file while an incompatible writable handle is actually held", async () => {
    const writable = openSync(join(ownedRoot, "regular.json"), "r+");
    try { await expectRejected("regular.json"); } finally { closeSync(writable); }
    expect((await read("regular.json")).code).toBe(0);
  }, 30_000);

  test("loads both real immutable pinned artifacts through the native catalog", async () => {
    const result = await loadMarketRegionalArtifactCatalog();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("actual pinned catalog failed");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.entries)).toBe(true);
    expect(result.value.entries.map(entry => entry.logicalId)).toEqual(["riyadh", "dubai"]);
    expect(result.value.entries.map(entry => entry.admission.identity.byteLength)).toEqual([41_226, 43_688]);
    expect(result.value.entries.map(entry => entry.admission.artifact.records.length)).toEqual([33, 35]);
    for (const entry of result.value.entries) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.admission)).toBe(true);
      expect(Object.isFrozen(entry.admission.artifact.records)).toBe(true);
      expect(entry.admission.artifact.records.every(record => record.operatingStatus === "unknown")).toBe(true);
    }
  }, 35_000);

  test("never exposes a partially admitted catalog when the second pinned file is absent", async () => {
    // Copy only the 41KB first artifact into this exclusive test root; preserve originals.
    const relativeDirectory = "region-20260913T080233Z-139ffad96f59497a9a19d547792d070e";
    mkdirSync(join(ownedRoot, relativeDirectory));
    writeFileSync(join(ownedRoot, relativeDirectory, "region.json"), readFileSync(join(parent, relativeDirectory, "region.json")), { flag: "wx" });
    const result = await loadMarketRegionalArtifactCatalog({ rootDirectory: ownedRoot });
    expect(result).toEqual({ ok: false, error: { code: "reader_failed", message: "Market regional artifact catalog could not be loaded." } });
    expect("value" in result).toBe(false);
  }, 35_000);

  test("rejects same-length tampered bytes after a real native read", async () => {
    const sourceDirectory = "region-20260913T080233Z-139ffad96f59497a9a19d547792d070e";
    const separateRoot = join(ownedRoot, "tampered-catalog");
    mkdirSync(separateRoot);
    mkdirSync(join(separateRoot, sourceDirectory));
    const original = readFileSync(join(parent, sourceDirectory, "region.json"));
    const changed = Buffer.from(original);
    changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
    writeFileSync(join(separateRoot, sourceDirectory, "region.json"), changed, { flag: "wx" });
    expect(changed.length).toBe(41_226);
    const result = await loadMarketRegionalArtifactCatalog({ rootDirectory: separateRoot });
    expect(result).toEqual({ ok: false, error: { code: "admission_failed", message: "Market regional artifact catalog could not be loaded." } });
    expect("value" in result).toBe(false);
    expect(readFileSync(join(parent, sourceDirectory, "region.json")).equals(original)).toBe(true);
  }, 20_000);
});
