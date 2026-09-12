import { beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "..");
const wrapper = join(repositoryRoot, "scripts", "research", "pricelabs-windows-intake.ps1");
const native = process.platform === "win32" ? test : test.skip;
const admittedRoot = "D:\\Yellow\\temp\\order462-acl-tests";
let fixtureRoot = "";
let archive = "";

function powerShellPath(): string {
  const bundled = process.env.USERPROFILE === undefined ? undefined : join(
    process.env.USERPROFILE,
    ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "native", "powershell", "pwsh.exe",
  );
  const value = Bun.which("pwsh") ?? (bundled !== undefined && existsSync(bundled) ? bundled : undefined);
  if (value === undefined) throw new Error("Order462 Windows ACL proof requires PowerShell 7");
  return value;
}

function runPowerShell(args: readonly string[], timeout = 20_000) {
  return Bun.spawnSync({
    cmd: [powerShellPath(), "-NoLogo", "-NoProfile", "-NonInteractive", "-File", wrapper, ...args],
    cwd: repositoryRoot,
    stdout: "pipe",
    stderr: "pipe",
    timeout,
  });
}

function outputText(result: ReturnType<typeof Bun.spawnSync>): { stdout: string; stderr: string } {
  return { stdout: result.stdout?.toString() ?? "", stderr: result.stderr?.toString() ?? "" };
}

function protectDirectory(path: string): void {
  const script = String.raw`
$ErrorActionPreference='Stop'
$path=$env:YELLOW_ORDER462_TEST_ACL_PATH
[IO.Directory]::CreateDirectory($path)|Out-Null
$current=[Security.Principal.WindowsIdentity]::GetCurrent().User
$system=[Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$acl=[Security.AccessControl.DirectorySecurity]::new()
$acl.SetAccessRuleProtection($true,$false)
$acl.SetOwner($current)
foreach($sid in @($current,$system)){
  $rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
  [void]$acl.AddAccessRule($rule)
}
[IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($path),$acl)
`;
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const result = Bun.spawnSync({
    cmd: [powerShellPath(), "-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
    env: { ...process.env, YELLOW_ORDER462_TEST_ACL_PATH: path },
    stdout: "pipe",
    stderr: "pipe",
    timeout: 10_000,
  });
  expect(result.exitCode, outputText(result).stderr).toBe(0);
}

beforeAll(async () => {
  if (process.platform !== "win32") return;
  if (!existsSync("D:\\")) throw new Error("Order462 native ACL proof requires the admitted D: NTFS volume");
  protectDirectory(admittedRoot);
  fixtureRoot = join(admittedRoot, `run-${randomUUID()}`);
  protectDirectory(fixtureRoot);
  archive = join(fixtureRoot, "archive");
  await mkdir(archive);
  protectDirectory(archive);
  await mkdir(join(archive, "csv", "host"), { recursive: true });
  await writeFile(join(archive, "manifest.json"), "{}\n", "utf8");
  await writeFile(join(archive, "csv", "host", "source.csv"), "id,value\n1,synthetic\n", "utf8");
});

describe("Order462 native PriceLabs ACL intake", () => {
  native("validates an absent output through a protected NTFS parent without writing", () => {
    const output = join(fixtureRoot, "validated-output");
    const result = runPowerShell(["-Action", "ValidateOnly", "-Archive", archive, "-Output", output]);
    const text = outputText(result);
    expect(result.exitCode, text.stderr).toBe(0);
    expect(JSON.parse(text.stdout)).toEqual({
      schemaVersion: "yellow.pricelabs-windows-intake/v1",
      status: "validated",
      archiveEntries: 4,
      operationalWrites: false,
    });
    expect(existsSync(output)).toBe(false);
  });

  native("creates a protected output, passes literal argv to Bun and suppresses child data", async () => {
    const output = join(fixtureRoot, "run-output");
    const loader = join(fixtureRoot, "synthetic-loader.ts");
    await writeFile(loader, String.raw`
import { writeFileSync } from "node:fs";
import { join } from "node:path";
const args = process.argv.slice(2);
const archiveIndex = args.indexOf("--archive");
const outputIndex = args.indexOf("--output");
if (archiveIndex < 0 || outputIndex < 0) process.exit(9);
writeFileSync(join(args[outputIndex + 1]!, "receipt.json"), JSON.stringify({operationalWrites:false}));
writeFileSync(join(args[outputIndex + 1]!, "argv.json"), JSON.stringify(args));
console.log("PRIVATE-SOURCE-ROW");
console.error("PRIVATE-ERROR-BODY");
`, "utf8");
    const result = runPowerShell([
      "-Action", "Run", "-Archive", archive, "-Output", output,
      "-BunPath", process.execPath, "-LoaderPath", loader,
    ]);
    const text = outputText(result);
    expect(result.exitCode, text.stderr).toBe(0);
    expect(text.stdout).not.toContain("PRIVATE-SOURCE-ROW");
    expect(text.stderr).not.toContain("PRIVATE-ERROR-BODY");
    expect(JSON.parse(text.stdout)).toMatchObject({ status: "completed", operationalWrites: false });
    expect(JSON.parse(await readFile(join(output, "argv.json"), "utf8"))).toEqual([
      "--archive", archive, "--output", output,
    ]);

    const validation = runPowerShell(["-Action", "ValidateOnly", "-Archive", archive, "-Output", output]);
    expect(validation.exitCode).not.toBe(0);
    expect(outputText(validation).stderr).toContain("output_not_empty");
    const written = runPowerShell(["-Action", "ValidateWritten", "-Archive", archive, "-Output", output]);
    expect(written.exitCode, outputText(written).stderr).toBe(0);
    expect(JSON.parse(outputText(written).stdout)).toMatchObject({
      status: "validated-written", operationalWrites: false,
    });
  });

  native("rejects traversal and an existing output without invoking a child", async () => {
    const traversal = runPowerShell([
      "-Action", "ValidateOnly", "-Archive", archive,
      "-Output", `${fixtureRoot}\\nested\\..\\escape`,
    ]);
    expect(traversal.exitCode).not.toBe(0);
    expect(outputText(traversal).stderr).toContain("invalid_output_path");

    const existing = join(fixtureRoot, "existing-output");
    await mkdir(existing);
    const loader = join(fixtureRoot, "must-not-run.ts");
    await writeFile(loader, "throw new Error('MUST-NOT-RUN')", "utf8");
    const overwrite = runPowerShell([
      "-Action", "Run", "-Archive", archive, "-Output", existing,
      "-BunPath", process.execPath, "-LoaderPath", loader,
    ]);
    expect(overwrite.exitCode).not.toBe(0);
    expect(outputText(overwrite).stderr).toContain("output_already_exists");
    expect(outputText(overwrite).stderr).not.toContain("MUST-NOT-RUN");
  });

  native("rejects archive reparse members before output creation", async () => {
    const linkedArchive = join(fixtureRoot, "linked-archive");
    const target = join(fixtureRoot, "link-target");
    await mkdir(linkedArchive);
    protectDirectory(linkedArchive);
    await mkdir(target);
    await writeFile(join(target, "private.csv"), "secret\n", "utf8");
    await symlink(target, join(linkedArchive, "linked"), "junction");
    const output = join(fixtureRoot, "linked-output");
    const result = runPowerShell(["-Action", "ValidateOnly", "-Archive", linkedArchive, "-Output", output]);
    expect(result.exitCode).not.toBe(0);
    expect(outputText(result).stderr).toContain("archive_reparse_member_forbidden");
    expect(existsSync(output)).toBe(false);
  });

  native("rejects a parent with a broad allow ACE and contains all paths to the admitted roots", async () => {
    const broadParent = join(fixtureRoot, "broad-parent");
    await mkdir(broadParent);
    protectDirectory(broadParent);
    const addBroadRule = String.raw`
$current=[Security.Principal.WindowsIdentity]::GetCurrent().User
$system=[Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$everyone=[Security.Principal.SecurityIdentifier]::new('S-1-1-0')
$acl=[Security.AccessControl.DirectorySecurity]::new()
$acl.SetAccessRuleProtection($true,$false)
$acl.SetOwner($current)
foreach($entry in @(@($current,'FullControl'),@($system,'FullControl'),@($everyone,'ReadAndExecute'))){
  $rule=[Security.AccessControl.FileSystemAccessRule]::new($entry[0],$entry[1],'ContainerInherit,ObjectInherit','None','Allow')
  [void]$acl.AddAccessRule($rule)
}
[IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($env:YELLOW_ORDER462_BROAD_PATH),$acl)
`;
    const encoded = Buffer.from(addBroadRule, "utf16le").toString("base64");
    const mutation = Bun.spawnSync({
      cmd: [powerShellPath(), "-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      env: { ...process.env, YELLOW_ORDER462_BROAD_PATH: broadParent },
      stdout: "pipe", stderr: "pipe", timeout: 10_000,
    });
    expect(mutation.exitCode, outputText(mutation).stderr).toBe(0);
    const insecure = runPowerShell([
      "-Action", "ValidateOnly", "-Archive", archive, "-Output", join(broadParent, "output"),
    ]);
    expect(insecure.exitCode).not.toBe(0);
    expect(outputText(insecure).stderr).toContain("acl_identity_not_allowed");

    const outside = runPowerShell([
      "-Action", "ValidateOnly", "-Archive", archive, "-Output", join("D:\\Yellow\\temp", `outside-${randomUUID()}`),
    ]);
    expect(outside.exitCode).not.toBe(0);
    expect(outputText(outside).stderr).toContain("output_outside_approved_root");
  });

  test("source has a hard NTFS guard and no shell command composition", async () => {
    const source = await readFile(wrapper, "utf8");
    expect(source).toContain("DriveFormat -cne 'NTFS'");
    expect(source).toContain("ArgumentList.Add($argument)");
    expect(source).toContain("DirectorySecurity");
    expect(source).not.toMatch(/Invoke-Expression|cmd\.exe|Start-Process/);
  });
});
