import { accessSync, constants, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface ChromiumPathOptions {
  readonly platform?: NodeJS.Platform;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

function firstEnvironmentValue(env: Readonly<Record<string, string | undefined>>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (value && value.trim() !== "") return value;
  }
  return undefined;
}

function windowsInstallCandidates(env: Readonly<Record<string, string | undefined>>): string[] {
  const programFiles = firstEnvironmentValue(env, "PROGRAMFILES", "ProgramFiles");
  const programFilesX86 = firstEnvironmentValue(env, "PROGRAMFILES(X86)", "ProgramFiles(x86)");
  const localAppData = firstEnvironmentValue(env, "LOCALAPPDATA", "LocalAppData");
  const candidates = [
    programFiles && join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    programFilesX86 && join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    localAppData && join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
    programFilesX86 && join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    programFiles && join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    localAppData && join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
    programFiles && join(programFiles, "Chromium", "Application", "chrome.exe"),
    localAppData && join(localAppData, "Chromium", "Application", "chrome.exe"),
  ];
  return candidates.filter((candidate): candidate is string => candidate !== undefined);
}

function macApplicationCandidates(home: string): string[] {
  const applications = ["/Applications", join(home, "Applications")];
  return applications.flatMap(directory => [
    join(directory, "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
    join(directory, "Chromium.app", "Contents", "MacOS", "Chromium"),
    join(directory, "Microsoft Edge.app", "Contents", "MacOS", "Microsoft Edge"),
  ]);
}

function pathCommandNames(platform: NodeJS.Platform): readonly string[] {
  if (platform === "win32") return ["chrome.exe", "chromium.exe", "msedge.exe"];
  if (platform === "darwin") {
    return ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome", "microsoft-edge"];
  }
  return [
    "google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome",
    "microsoft-edge", "microsoft-edge-stable",
  ];
}

function runnableFile(path: string, platform: NodeJS.Platform): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    if (platform !== "win32") accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Finds an installed Chrome/Chromium/Edge executable; it never starts the browser. */
export function resolveChromiumPath(options: ChromiumPathOptions = {}): string | null {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const home = firstEnvironmentValue(env, "HOME", "USERPROFILE") ?? homedir();
  const installedCandidates = platform === "win32"
    ? windowsInstallCandidates(env)
    : platform === "darwin" ? macApplicationCandidates(home) : [];

  for (const candidate of installedCandidates) {
    const absolute = resolve(candidate);
    if (runnableFile(absolute, platform)) return absolute;
  }

  const delimiter = platform === "win32" ? ";" : ":";
  const pathDirectories = (env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const command of pathCommandNames(platform)) {
    for (const directory of pathDirectories) {
      const candidate = resolve(directory, command);
      if (runnableFile(candidate, platform)) return candidate;
    }
  }
  return null;
}
