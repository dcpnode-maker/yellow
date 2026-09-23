import { expect, test } from "bun:test";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const JSON_CONFIG = resolve(PROJECT_ROOT, ".mcp.json");
const TOML_CONFIG = resolve(PROJECT_ROOT, ".codex", "config.toml");

type ValidationResult = { errors: string[] };

function validateJson(text: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return [`invalid JSON: ${error instanceof Error ? error.message : String(error)}`];
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return ["top-level JSON value must be an object"];
  }
  const root = parsed as Record<string, unknown>;
  const keys = Object.keys(root);
  if (keys.length !== 1 || keys[0] !== "mcpServers") {
    return ["JSON config must contain only mcpServers"];
  }
  if (!root.mcpServers || typeof root.mcpServers !== "object" || Array.isArray(root.mcpServers)) {
    return ["mcpServers must be an object"];
  }
  const servers = root.mcpServers as Record<string, unknown>;
  const errors: string[] = [];
  for (const [name, value] of Object.entries(servers)) {
    errors.push(`JSON MCP server=${name}`);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`JSON MCP server=${name}: malformed launcher`);
      continue;
    }
    const launcher = value as Record<string, unknown>;
    if (typeof launcher.command === "string") errors.push(`JSON launcher command=${launcher.command}`);
    if (Array.isArray(launcher.args)) {
      for (const arg of launcher.args) {
        if (typeof arg === "string" && arg.startsWith("@")) errors.push(`JSON launcher package=${arg}`);
      }
    }
    if (launcher.env && typeof launcher.env === "object" && !Array.isArray(launcher.env)) {
      for (const key of Object.keys(launcher.env as Record<string, unknown>)) {
        errors.push(`JSON launcher env=${key}=[redacted]`);
      }
    }
  }
  return errors;
}

function validateToml(text: string): string[] {
  const errors: string[] = [];
  let section = "";
  const seenSections = new Set<string>();
  for (const [index, character] of [...text].entries()) {
    const code = character.charCodeAt(0);
    if ((code < 0x20 && ![0x09, 0x0a, 0x0d].includes(code)) || code === 0x7f) {
      errors.push(`character ${index + 1}: prohibited control character U+${code.toString(16).padStart(4, "0")}`);
    }
  }
  if (errors.length > 0) return errors;
  for (const [index, sourceLine] of text.split(/\r?\n/).entries()) {
    const line = sourceLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1] ?? "";
      if (seenSections.has(section)) errors.push(`line ${index + 1}: duplicate TOML section [${section}]`);
      seenSections.add(section);
      if (section !== "mcp_servers") errors.push(`line ${index + 1}: unknown TOML section [${section}]`);
      continue;
    }
    const keyMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=/);
    if (!keyMatch) {
      const packages = line.match(/@[A-Za-z0-9_./-]+(?:@[A-Za-z0-9._-]+)?/g);
      if (packages) for (const packageName of packages) errors.push(`line ${index + 1}: launcher package=${packageName}`);
      else errors.push(`line ${index + 1}: malformed TOML entry`);
      continue;
    }
    const key = keyMatch[1] ?? "";
    if (section !== "mcp_servers") errors.push(`line ${index + 1}: key outside mcp_servers (${key})`);
    else if (key === "env") {
      const envKey = line.match(/([A-Z][A-Z0-9_]+)\s*=/)?.[1] ?? "unknown";
      errors.push(`line ${index + 1}: launcher env=${envKey}=[redacted]`);
    } else {
      const packages = line.match(/@[A-Za-z0-9_./-]+(?:@[A-Za-z0-9._-]+)?/g);
      if (packages) for (const packageName of packages) errors.push(`line ${index + 1}: launcher package=${packageName}`);
      errors.push(`line ${index + 1}: launcher key=${key}`);
    }
  }
  if (seenSections.size !== 1 || !seenSections.has("mcp_servers")) errors.push("TOML must contain exactly one [mcp_servers] table");
  return errors;
}

function validateProjectMcpConfigs(jsonText: string, tomlText: string): ValidationResult {
  const errors = [
    ...validateJson(jsonText),
    ...validateToml(tomlText),
  ];
  return { errors };
}

test("project MCP configs are mirrored empty configs with no external launchers", async () => {
  const result = validateProjectMcpConfigs(
    await Bun.file(JSON_CONFIG).text(),
    await Bun.file(TOML_CONFIG).text(),
  );
  expect(result.errors).toEqual([]);
});

test("validator fails closed on duplicate tables and prohibited control characters", () => {
  expect(validateToml("[mcp_servers]\n[mcp_servers]\n").join("\n")).toContain("duplicate TOML section [mcp_servers]");
  expect(validateToml("[mcp_servers]\n# bad\u0000\n")[0]).toContain("prohibited control character");
});

test("parent red diagnostics identify package, tag and credential markers", () => {
  const parent = "b602af932370196c1f0f82b68c3c2a8936e678fa";
  const readAtParent = (path: string) => {
    const result = Bun.spawnSync(["git", "show", `${parent}:${path}`], { stdout: "pipe", stderr: "pipe" });
    if (result.exitCode !== 0) throw new Error(`preregistered MCP parent fixture is unavailable: ${path}`);
    return result.stdout.toString();
  };
  const result = validateProjectMcpConfigs(
    readAtParent(".mcp.json"),
    readAtParent(".codex/config.toml"),
  );
  const diagnostics = result.errors.join("\n");
  expect(diagnostics).toContain("@modelcontextprotocol/server-postgres");
  expect(diagnostics).toContain("@modelcontextprotocol/server-github");
  expect(diagnostics).toContain("@upstash/context7-mcp@latest");
  expect(diagnostics).toContain("GITHUB_PERSONAL_ACCESS_TOKEN");
});
