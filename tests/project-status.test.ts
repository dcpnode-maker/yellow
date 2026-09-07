import { describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readdir, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PROJECT_BUILD_SNAPSHOT } from "../src/project-status";
import { runOwnedProofProcess } from "./helpers/owned-proof-process";

const root = fileURLToPath(new URL("..", import.meta.url));

function runState(environment?: NodeJS.ProcessEnv) {
  const command = process.platform === "win32"
    ? ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "state.ps1")]
    : ["bash", join(root, "state.sh")];
  return runOwnedProofProcess(command, { cwd: root, env: environment ?? process.env, timeoutMs: 4_500 });
}

function parseStatus(status: string): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      [...status.matchAll(/^<!-- ([a-z-]+): (.*) -->$/gm)].map((match) => [match[1]!, match[2]!] as const),
    ),
  );
}

async function historicalCounts(directory: string): Promise<string> {
  async function records(kind: string) {
    const base = join(directory, "handoff", kind);
    const entries = await readdir(base, { withFileTypes: true });
    const files: { name: string; text: string }[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".") || !entry.name.endsWith(".md")) continue;
      const path = join(base, entry.name);
      let metadata;
      try { metadata = await stat(path); } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      if (metadata.isFile()) files.push({ name: entry.name, text: await Bun.file(path).text() });
    }
    return files;
  }
  const [orders, reviews, questions] = await Promise.all([
    records("orders"), records("reviews"), records("questions"),
  ]);
  const unclosed = orders.filter(({ text }) => !/^## MERGED/m.test(text)).length;
  const questionNames = new Set(questions.map(({ name }) => name));
  const open = questions.filter(({ name, text }) =>
    !name.endsWith("-ARCHITECT-RESPONSE.md") && !/^## (RESOLVED|RATIFIED)/m.test(text) &&
    !questionNames.has(`${name.split("-")[0]}-ARCHITECT-RESPONSE.md`)).length;
  return `Historical records: orders=${orders.length} total (${unclosed} lack legacy MERGED marker) ` +
    `reviews=${reviews.length} total questions=${open} without legacy resolution marker (${questions.length} total)`;
}

describe("canonical project status", () => {
  test("records the accepted native closure and current Order 444 partner-preview work", () => {
    const originalSnapshot = JSON.stringify(PROJECT_BUILD_SNAPSHOT);
    expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-07");
    expect(PROJECT_BUILD_SNAPSHOT.roadmap).toMatchObject({
      phaseCount: 18,
      latestBuiltOrder: 439,
      currentOrder: 444,
      activePhase: 7,
    });
    expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBeGreaterThanOrEqual(91);

    const byOrder = new Map(PROJECT_BUILD_SNAPSHOT.recordedWork.map((work) => [work.order, work]));
    // Bun 1.3.14 nested asymmetric matching mutates actual objects. Check scalar
    // values so this test cannot replace shared snapshot text with matcher objects.
    expect(byOrder.get(434)?.state).toBe("independently_approved");
    expect(byOrder.get(434)?.summary).toContain("native");
    expect(byOrder.get(440)?.state).toBe("proof_in_progress");
    expect(byOrder.get(440)?.summary).toContain("durable fiscal submission");
    expect(byOrder.get(440)?.summary).toContain("PR91 at 3503b0c");
    expect(byOrder.get(440)?.summary).toContain("81 migrations / 128 public tables");
    expect(byOrder.get(440)?.remaining).toContain("Merged main81 is not the preserved local77 or the current Order444 candidate85 development");
    expect(byOrder.get(440)?.remaining).toContain("authentic external-provider sandbox acceptance and activation remain unfinished");
    expect(byOrder.get(444)?.state).toBe("proof_in_progress");
    expect(byOrder.get(444)?.summary).toContain("three-layout Calm Workbench, Precision Desk and Service Timeline shell");
    expect(byOrder.get(444)?.summary).toContain("Q208 operator invoice queue/detail, readiness, confirmed issuance");
    expect(byOrder.get(444)?.summary).toContain("populated81-to-85 preservation 2/0");
    expect(byOrder.get(444)?.summary).toContain("synthetic fiscal review seed through genuine production services 8/0");
    expect(byOrder.get(444)?.remaining).toContain("not merged main81 or preserved local77");
    expect(byOrder.get(444)?.remaining).toContain("candidate85 is not the founder runtime");
    expect(byOrder.get(444)?.remaining).toContain("Exact current-head all-six CI and CodeQL");
    expect(byOrder.get(444)?.remaining).toContain("guarded native promotion");
    expect(byOrder.get(444)?.remaining).toContain("full Astra identity/journey design");
    expect(byOrder.get(444)?.remaining).toContain("Phase 7 and the whole application are not complete");

    expect(PROJECT_BUILD_SNAPSHOT.phases).toHaveLength(18);
    expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ number, state }) => [number, state])).toEqual([
      [0, "reviewed"], [1, "reviewed"], [2, "reviewed"], [3, "reviewed"],
      [4, "built_unverified"], [5, "reviewed"], [6, "reviewed"], [7, "active"],
      [8, "planned"], [9, "planned"], [10, "planned"], [11, "planned"],
      [12, "planned"], [13, "planned"], [14, "planned"], [15, "planned"],
      [16, "planned"], [17, "planned"],
    ]);
    expect(JSON.stringify(PROJECT_BUILD_SNAPSHOT)).toBe(originalSnapshot);
  });

  test("drives the Unix report from valid metadata and real current orders", async () => {
    const status = await Bun.file(`${root}/docs/PROJECT-STATUS.md`).text();
    const fields = parseStatus(status);
    const phase = fields["current-phase"];
    const task = fields["current-task"];
    const lifecycle = fields["current-lifecycle"];
    if (phase === undefined || task === undefined || lifecycle === undefined) {
      throw new Error("required project-status metadata is missing");
    }
    const currentFiles = fields["current-order-files"]?.split(";") ?? [];

    expect(fields["status-schema"]).toBe("yellow-project-status/v1");
    expect(phase).toMatch(/^\d+$/);
    expect(task.trim().length).toBeGreaterThan(0);
    expect(lifecycle.trim().length).toBeGreaterThan(0);
    expect(currentFiles.length).toBeGreaterThan(0);
    expect(new Set(currentFiles).size).toBe(currentFiles.length);
    for (const file of currentFiles) {
      expect(file.trim()).toBe(file);
      expect(await Bun.file(`${root}/${file}`).exists()).toBe(true);
    }

    const report = await runState();
    expect(report.exitCode).toBe(0);
    const output = report.stdout;
    expect(output).toContain(`Current task: ${task}`);
    expect(output).toContain(`Lifecycle: ${lifecycle}`);
    expect(output).toContain(`Phase: ${phase} · ${lifecycle}`);
    for (const file of currentFiles) expect(output).toContain(`  ${file}`);
    expect(output).toContain(await historicalCounts(root));
    expect(output).not.toContain("Open orders:");
    expect(output).not.toContain("Open questions:");
  });

  test("fails closed when required metadata is invalid", async () => {
    const directory = await mkdtemp(join(tmpdir(), "yellow-project-status-"));
    const invalidStatus = join(directory, "invalid.md");
    try {
      await Bun.write(
        invalidStatus,
        [
          "<!-- status-schema: yellow-project-status/v1 -->",
          "<!-- current-phase: invalid -->",
          "<!-- current-task: invalid fixture -->",
          "<!-- current-order-files: handoff/orders/438-codex-consolidated-release.md -->",
        ].join("\n"),
      );
      const report = await runState({ ...process.env, YELLOW_PROJECT_STATUS_FILE: invalidStatus });
      expect(report.exitCode).not.toBe(0);
      const errorOutput = `${report.stderr}${report.stdout}`;
      if (process.platform === "win32") expect(errorOutput).toMatch(/YELLOW\s+state report failed/);
      else expect(errorOutput).toContain("invalid docs/PROJECT-STATUS.md metadata");
      expect(report.stdout.toString()).not.toContain("Referee:");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("keeps PowerShell on the same canonical fields and fail-closed schema", async () => {
    const script = await Bun.file(`${root}/state.ps1`).text();
    expect(script).toContain("Read-StatusField 'status-schema'");
    expect(script).toContain("Read-StatusField 'current-phase'");
    expect(script).toContain("Read-StatusField 'current-order-files'");
    expect(script).toContain("yellow-project-status/v1");
    expect(script).not.toContain("Write-Host 'Open orders:'");
    expect(script).not.toContain("Write-Host 'Open questions:'");
  });

  test("historical scanning uses two batched marker scans and shell-only question names", async () => {
    const script = await Bun.file(join(root, "state.sh")).text();
    expect(script).toContain('grep -LZ \'^## MERGED\' -- "${order_files[@]}"');
    expect(script).toContain('grep -LEZ \'^## (RESOLVED|RATIFIED)\' -- "${question_candidates[@]}"');
    expect(script).toContain('name=${file##*/}');
    expect(script).toContain("command -v timeout >/dev/null 2>&1");
    expect(script).toContain("timeout --signal=KILL 1s bash -s <<'YELLOW_DOCKER_PROBE'");
    expect(script).toContain("docker compose ps --services --status running");
    expect(script).toContain("docker compose exec -T postgres psql");
    expect(script.match(/docker compose /g)).toHaveLength(2);
    expect(script).not.toContain("docker info");
    expect(script).not.toContain('grep -q \'^## MERGED\' "$file"');
    expect(script).not.toContain('name=$(basename "$file")');
  });

  test.skipIf(process.platform === "win32")("Unix batch scans preserve empty, marker, response and unusual-filename semantics", async () => {
    const directory = await mkdtemp(join(tmpdir(), "yellow-project-status-batch-"));
    const realGrep = Bun.which("grep");
    if (!realGrep) throw new Error("Unix status proof requires grep");
    try {
      for (const kind of ["orders", "reviews", "questions"]) {
        await mkdir(join(directory, "handoff", kind), { recursive: true });
      }
      const bin = join(directory, "bin");
      await mkdir(bin);
      const markerLog = join(directory, "marker-scans");
      await Bun.write(join(directory, "state.sh"), await Bun.file(join(root, "state.sh")).text());
      await Bun.write(join(directory, "current.md"), "Current fixture order");
      const statusFile = join(directory, "status.md");
      await Bun.write(statusFile, [
        "<!-- status-schema: yellow-project-status/v1 -->", "<!-- current-phase: 7 -->",
        "<!-- current-task: fixture -->", "<!-- current-lifecycle: fixture -->",
        "<!-- current-order-files: current.md -->",
      ].join("\n"));
      await Bun.write(join(bin, "docker"), "#!/usr/bin/env bash\nexit 1\n");
      await Bun.write(join(bin, "git"), "#!/usr/bin/env bash\nexit 0\n");
      await Bun.write(join(bin, "grep"), '#!/usr/bin/env bash\ncase "$1" in -LZ|-LEZ) printf "scan\\n" >> "$YELLOW_SCAN_COUNT_FILE";; esac\n' +
        `exec ${JSON.stringify(realGrep)} "$@"\n`);
      for (const command of ["docker", "git", "grep"]) await chmod(join(bin, command), 0o755);
      const env = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`,
        YELLOW_PROJECT_STATUS_FILE: statusFile, YELLOW_SCAN_COUNT_FILE: markerLog };
      async function report(expectedScans: number) {
        await Bun.write(markerLog, "");
        const child = await runOwnedProofProcess(["bash", join(directory, "state.sh")], {
          cwd: directory, env, timeoutMs: 2_000,
        });
        expect(child.exitCode).toBe(0);
        expect(child.stdout.toString()).toContain(await historicalCounts(directory));
        expect((await Bun.file(markerLog).text()).split("\n").filter(Boolean)).toHaveLength(expectedScans);
      }
      await report(0);
      const fixture: Readonly<Record<string, string>> = {
        "orders/001-open.md": "Open", "orders/002-merged.md": "## MERGED with evidence",
        "orders/003-unanchored.md": "not ## MERGED", "orders/--space\nand newline.md": "Open",
        "reviews/001.md": "review", "questions/001-open.md": "Open",
        "questions/002-resolved.md": "## RESOLVED details", "questions/003-ratified.md": "## RATIFIED",
        "questions/004-question.md": "Open", "questions/004-ARCHITECT-RESPONSE.md": "response",
        "questions/005-unanchored.md": "not ## RESOLVED", "questions/006-space\nand newline.md": "Open",
        "orders/.hidden.md": "Open but not globbed", "questions/007-question.md": "Answered by symlink",
      };
      for (const [file, content] of Object.entries(fixture)) await Bun.write(join(directory, "handoff", file), content);
      await mkdir(join(directory, "handoff", "orders", "ignored-directory.md"));
      await symlink("002-merged.md", join(directory, "handoff", "orders", "005-symlink.md"));
      await symlink("does-not-exist.md", join(directory, "handoff", "orders", "006-broken.md"));
      await symlink("004-ARCHITECT-RESPONSE.md", join(directory, "handoff", "questions", "007-ARCHITECT-RESPONSE.md"));
      expect(await historicalCounts(directory)).toBe("Historical records: orders=5 total (3 lack legacy MERGED marker) reviews=1 total questions=3 without legacy resolution marker (9 total)");
      await report(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test.skipIf(process.platform === "win32")("Unix status bounds the complete optional Docker probe without a survivor", async () => {
    const directory = await mkdtemp(join(tmpdir(), "yellow-project-status-docker-bound-"));
    const bash = Bun.which("bash");
    if (!bash) throw new Error("Unix status proof requires bash");
    try {
      for (const kind of ["orders", "reviews", "questions"]) {
        await mkdir(join(directory, "handoff", kind), { recursive: true });
      }
      const bin = join(directory, "bin");
      await mkdir(bin);
      const survivor = join(directory, "docker-survivor");
      await Bun.write(join(directory, "state.sh"), await Bun.file(join(root, "state.sh")).text());
      await Bun.write(join(directory, "current.md"), "Current fixture order");
      const statusFile = join(directory, "status.md");
      await Bun.write(statusFile, [
        "<!-- status-schema: yellow-project-status/v1 -->", "<!-- current-phase: 7 -->",
        "<!-- current-task: bounded Docker fixture -->", "<!-- current-lifecycle: fixture -->",
        "<!-- current-order-files: current.md -->",
      ].join("\n"));
      await Bun.write(join(bin, "git"), "#!/usr/bin/env bash\nexit 0\n");
      await Bun.write(join(bin, "docker"), [
        "#!/usr/bin/env bash",
        'if [ "$*" = "compose ps --services --status running" ]; then',
        "  printf 'postgres\\n'",
        "  exit 0",
        "fi",
        'if [ "${1:-}" != compose ] || [ "${2:-}" != exec ]; then exit 91; fi',
        '( sleep 2; printf survived > "$YELLOW_DOCKER_SURVIVOR_FILE" ) &',
        "wait",
      ].join("\n") + "\n");
      for (const command of ["docker", "git"]) await chmod(join(bin, command), 0o755);
      const started = performance.now();
      const report = await runOwnedProofProcess([bash, join(directory, "state.sh")], {
        cwd: directory,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ""}`,
          YELLOW_PROJECT_STATUS_FILE: statusFile,
          YELLOW_DOCKER_SURVIVOR_FILE: survivor,
        },
        timeoutMs: 4_500,
      });
      const elapsed = performance.now() - started;
      expect(report.exitCode).toBe(0);
      expect(report.stderr).toBe("");
      expect(report.stdout).toContain("Service app: down");
      expect(report.stdout).toContain("Service postgres: down");
      expect(report.stdout).toContain("Service valkey: down");
      expect(report.stdout).toContain("Phase: 7 · fixture");
      expect(elapsed).toBeLessThan(3_500);
      await Bun.sleep(1_500);
      expect(await Bun.file(survivor).exists()).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test.skipIf(process.platform === "win32")("Unix status reports a successful bounded Docker snapshot", async () => {
    const directory = await mkdtemp(join(tmpdir(), "yellow-project-status-docker-happy-"));
    const bash = Bun.which("bash");
    if (!bash) throw new Error("Unix status proof requires bash");
    try {
      for (const kind of ["orders", "reviews", "questions"]) {
        await mkdir(join(directory, "handoff", kind), { recursive: true });
      }
      const bin = join(directory, "bin");
      await mkdir(bin);
      const dockerLog = join(directory, "docker.log");
      await Bun.write(join(directory, "state.sh"), await Bun.file(join(root, "state.sh")).text());
      await Bun.write(join(directory, "current.md"), "Current fixture order");
      const statusFile = join(directory, "status.md");
      await Bun.write(statusFile, [
        "<!-- status-schema: yellow-project-status/v1 -->", "<!-- current-phase: 7 -->",
        "<!-- current-task: bounded Docker fixture -->", "<!-- current-lifecycle: fixture -->",
        "<!-- current-order-files: current.md -->",
      ].join("\n"));
      await Bun.write(join(bin, "git"), "#!/usr/bin/env bash\nexit 0\n");
      await Bun.write(join(bin, "docker"), [
        "#!/usr/bin/env bash",
        'printf \'%s\\n\' "$*" >> "$YELLOW_DOCKER_LOG_FILE"',
        'if [ "$*" = "compose ps --services --status running" ]; then',
        "  printf 'app\\npostgres\\nvalkey\\n'",
        "  exit 0",
        "fi",
        'if [ "${1:-}" = compose ] && [ "${2:-}" = exec ]; then',
        "  printf '129\\n'",
        "  exit 0",
        "fi",
        "exit 91",
      ].join("\n") + "\n");
      for (const command of ["docker", "git"]) await chmod(join(bin, command), 0o755);
      const report = await runOwnedProofProcess([bash, join(directory, "state.sh")], {
        cwd: directory,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH ?? ""}`,
          YELLOW_PROJECT_STATUS_FILE: statusFile,
          YELLOW_DOCKER_LOG_FILE: dockerLog,
        },
        timeoutMs: 4_500,
      });
      expect(report.exitCode).toBe(0);
      expect(report.stderr).toBe("");
      expect(report.stdout).toContain("Service app: up");
      expect(report.stdout).toContain("Service postgres: up");
      expect(report.stdout).toContain("Service valkey: up");
      expect(report.stdout).toContain("yellow_test public tables: 129");
      const invocations = (await Bun.file(dockerLog).text()).trim().split("\n");
      expect(invocations).toHaveLength(2);
      expect(invocations[0]).toBe("compose ps --services --status running");
      expect(invocations[1]).toStartWith("compose exec -T postgres psql ");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test.skipIf(process.platform === "win32")("Unix status fails closed without a timeout executable", async () => {
    const directory = await mkdtemp(join(tmpdir(), "yellow-project-status-no-timeout-"));
    const bash = Bun.which("bash");
    if (!bash) throw new Error("Unix status proof requires bash");
    try {
      for (const kind of ["orders", "reviews", "questions"]) {
        await mkdir(join(directory, "handoff", kind), { recursive: true });
      }
      const bin = join(directory, "bin");
      await mkdir(bin);
      const dockerMarker = join(directory, "docker-invoked");
      await Bun.write(join(directory, "state.sh"), await Bun.file(join(root, "state.sh")).text());
      await Bun.write(join(directory, "current.md"), "Current fixture order");
      const statusFile = join(directory, "status.md");
      await Bun.write(statusFile, [
        "<!-- status-schema: yellow-project-status/v1 -->", "<!-- current-phase: 7 -->",
        "<!-- current-task: no-timeout fixture -->", "<!-- current-lifecycle: fixture -->",
        "<!-- current-order-files: current.md -->",
      ].join("\n"));
      await Bun.write(join(bin, "git"), "#!/usr/bin/env bash\nexit 0\n");
      await Bun.write(join(bin, "docker"), "#!/usr/bin/env bash\nprintf invoked > \"$YELLOW_DOCKER_MARKER_FILE\"\nexit 0\n");
      for (const command of ["bash", "basename", "dirname", "grep", "head", "sed", "tr", "wc"]) {
        const executable = Bun.which(command);
        if (!executable) throw new Error(`Unix status proof requires ${command}`);
        await symlink(executable, join(bin, command));
      }
      for (const command of ["docker", "git"]) await chmod(join(bin, command), 0o755);
      const report = await runOwnedProofProcess([bash, join(directory, "state.sh")], {
        cwd: directory,
        env: {
          ...process.env,
          PATH: bin,
          YELLOW_PROJECT_STATUS_FILE: statusFile,
          YELLOW_DOCKER_MARKER_FILE: dockerMarker,
        },
        timeoutMs: 4_500,
      });
      expect(report.exitCode).toBe(0);
      expect(report.stderr).toBe("");
      expect(report.stdout).toContain("Service app: down");
      expect(report.stdout).toContain("Service postgres: down");
      expect(report.stdout).toContain("Service valkey: down");
      expect(await Bun.file(dockerMarker).exists()).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test.skipIf(process.platform !== "win32")("native batch scans preserve marker and response-path semantics", async () => {
    const directory = await mkdtemp(join(tmpdir(), "yellow-project-status-native-batch-"));
    const emptyDirectory = join(directory, "empty");
    const populatedDirectory = join(directory, "populated");
    const powerShell = join(
      process.env.SystemRoot ?? "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    const quotePowerShell = (value: string) => `'${value.replaceAll("'", "''")}'`;
    let symlinkCreated = false;
    try {
      const bin = join(directory, "bin");
      await mkdir(bin);
      await Bun.write(join(bin, "git.cmd"), "@echo off\r\nexit /b 0\r\n");
      await Bun.write(join(bin, "docker.cmd"), "@echo off\r\nexit /b 1\r\n");
      const stateScript = await Bun.file(join(root, "state.ps1")).text();
      async function prepare(directory: string) {
        for (const kind of ["orders", "reviews", "questions"]) {
          await mkdir(join(directory, "handoff", kind), { recursive: true });
        }
        await Bun.write(join(directory, "state.ps1"), stateScript);
        await Bun.write(join(directory, "current.md"), "Current fixture order");
        const statusFile = join(directory, "status.md");
        await Bun.write(statusFile, [
          "<!-- status-schema: yellow-project-status/v1 -->", "<!-- current-phase: 7 -->",
          "<!-- current-task: fixture -->", "<!-- current-lifecycle: fixture -->",
          "<!-- current-order-files: current.md -->",
        ].join("\n"));
        return statusFile;
      }
      const [emptyStatusFile, populatedStatusFile] = await Promise.all([
        prepare(emptyDirectory), prepare(populatedDirectory),
      ]);
      async function report(fixtureDirectory: string, statusFile: string, scanLog: string) {
        await Bun.write(scanLog, "");
        const wrapper = [
          "function Select-String {",
          "[CmdletBinding(DefaultParameterSetName='Path')] param(",
          "[Parameter(ParameterSetName='Path')][string[]]$Path,",
          "[Parameter(ParameterSetName='LiteralPath')][string[]]$LiteralPath,",
          "[Parameter(Mandatory=$true)][string[]]$Pattern, [switch]$Quiet, [switch]$List)",
          "$targets = if ($PSCmdlet.ParameterSetName -eq 'LiteralPath') { $LiteralPath } else { $Path }",
          "[IO.File]::AppendAllText($env:YELLOW_SCAN_COUNT_FILE, \"$($PSCmdlet.ParameterSetName):$($targets.Count):$($Quiet.IsPresent):$($List.IsPresent)`n\")",
          "$matches = Microsoft.PowerShell.Utility\\Select-String @PSBoundParameters",
          "if ($List) { $matches | ForEach-Object { [pscustomobject]@{ Path = $_.Path.ToUpperInvariant() } } } else { $matches }",
          "}",
          `& ${quotePowerShell(join(fixtureDirectory, "state.ps1"))}`,
        ].join("\n");
        const child = await runOwnedProofProcess(
          [powerShell, "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", wrapper],
          {
            cwd: directory,
            env: {
              ...process.env,
              PATH: `${bin};${process.env.PATH ?? ""}`,
              YELLOW_PROJECT_STATUS_FILE: statusFile,
              YELLOW_SCAN_COUNT_FILE: scanLog,
            },
            timeoutMs: 4_500,
          },
        );
        expect(child.exitCode).toBe(0);
        return {
          output: child.stdout,
          scans: (await Bun.file(scanLog).text()).split("\n").filter(Boolean),
        };
      }

      const fixture: Readonly<Record<string, string>> = {
        "orders/001-open.md": "Open", "orders/002-[literal]-merged.md": "## MERGED with evidence",
        "orders/003-unanchored.md": "not ## MERGED", "orders/004-case.md": "## merged case-insensitively",
        "reviews/001.md": "review", "questions/001-open.md": "Open",
        "questions/002-[literal]-resolved.md": "## RESOLVED details", "questions/003-case.md": "## ratified",
        "questions/004-unanchored.md": "not ## RESOLVED", "questions/005-question.md": "Open",
        "questions/005-ARCHITECT-RESPONSE.md": "response", "questions/006-question.md": "Open",
        "questions/007-question.md": "Open", "questions/008-ARCHITECT-RESPONSE.md": "response only",
      };
      for (const [file, content] of Object.entries(fixture)) {
        await Bun.write(join(populatedDirectory, "handoff", file), content);
      }
      await mkdir(join(populatedDirectory, "handoff", "questions", "006-ARCHITECT-RESPONSE.md"));
      try {
        await symlink(
          "005-ARCHITECT-RESPONSE.md",
          join(populatedDirectory, "handoff", "questions", "007-ARCHITECT-RESPONSE.md"),
          "file",
        );
        symlinkCreated = true;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EPERM" && code !== "EACCES") throw error;
      }

      const [empty, populated] = await Promise.all([
        report(emptyDirectory, emptyStatusFile, join(directory, "empty-marker-scans")),
        report(populatedDirectory, populatedStatusFile, join(directory, "populated-marker-scans")),
      ]);
      expect(empty.output).toContain("Historical records: orders=0 total (0 lack legacy MERGED marker) reviews=0 total questions=0 without legacy resolution marker (0 total)");
      expect(empty.scans).toEqual([]);
      const questionTotal = symlinkCreated ? 10 : 9;
      const openQuestions = symlinkCreated ? 2 : 3;
      expect(populated.output).toContain(
        `Historical records: orders=4 total (2 lack legacy MERGED marker) reviews=1 total questions=${openQuestions} without legacy resolution marker (${questionTotal} total)`,
      );
      expect(populated.scans).toEqual([
        "LiteralPath:4:False:True",
        "LiteralPath:7:False:True",
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
    }
  });
});
