import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveChromiumPath } from "./helpers/chromium-path";

function executableName(preferred: boolean): string {
  if (process.platform === "win32") return preferred ? "chrome.exe" : "chromium.exe";
  return preferred ? "google-chrome" : "chromium";
}

test("resolves the preferred installed browser from PATH without launching it", () => {
  const directory = mkdtempSync(join(tmpdir(), "yellow-chromium-path-"));
  try {
    const preferred = join(directory, executableName(true));
    const fallback = join(directory, executableName(false));
    writeFileSync(preferred, "test executable\n");
    writeFileSync(fallback, "test executable\n");
    if (process.platform !== "win32") {
      chmodSync(preferred, 0o755);
      chmodSync(fallback, 0o755);
    }

    const platform = process.platform === "win32" ? "win32" : "linux";
    expect(resolveChromiumPath({ platform, env: { PATH: directory } })).toBe(preferred);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("honors platform executable rules and returns null with no installed candidates", () => {
  const directory = mkdtempSync(join(tmpdir(), "yellow-chromium-path-"));
  try {
    const nonExecutable = join(directory, executableName(true));
    writeFileSync(nonExecutable, "not executable\n");
    if (process.platform !== "win32") chmodSync(nonExecutable, 0o644);

    const platform = process.platform === "win32" ? "win32" : "linux";
    const result = resolveChromiumPath({ platform, env: { PATH: directory } });
    if (process.platform === "win32") expect(result).toBe(nonExecutable);
    else expect(result).toBeNull();
    expect(resolveChromiumPath({ platform: "win32", env: {} })).toBeNull();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
