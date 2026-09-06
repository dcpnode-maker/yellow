import { describe, expect, test } from "bun:test";

describe("Order442 free-host native ARM64 preparation", () => {
  test("requires real ARM execution and both existing image targets", async () => {
    const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
    const job = workflow.replace(/\r\n/g, "\n").split("\n  free-host-arm64:\n")[1];
    expect(job).toBeDefined();
    expect(job).toContain("runs-on: ubuntu-24.04-arm");
    expect(job).toContain("timeout-minutes: 20");
    expect(job).toContain('test "$(uname -m)" = "aarch64"');
    expect(job).toContain('process.arch !== "arm64"');
    expect(job).toContain('docker build --target "$target"');
    expect(job).toContain("for target in runtime database-tools; do");
    expect(job).toContain('test "$architecture" = "linux/arm64"');
    expect(job).toContain('--build-arg "YELLOW_BUILD_SHA=$revision"');
    expect(job).toContain('test "$revision" = "$GITHUB_SHA"');
    expect(job).toContain('test "$image_revision" = "$revision"');
    expect(job).not.toMatch(/qemu|self-hosted|packages: write|docker push|docker login|ssh |kamal deploy/);
  });

  test("reuses the full real launcher proof without publishing or weakening existing gates", async () => {
    const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
    const job = workflow.replace(/\r\n/g, "\n").split("\n  free-host-arm64:\n")[1];
    expect(job).toBeDefined();
    for (const required of [
      "contents: read", "COMPOSE_PROJECT_NAME: yellow-arm64-proof", "bun-version: 1.3.14",
      "uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803",
      "uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
      "uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1",
      "bun install --frozen-lockfile", "--require-hashes --only-binary=:all:",
      "./scripts/local-review.sh start", "./scripts/local-review.sh status",
      "if: always()", "./scripts/local-review.sh stop",
    ]) expect(job).toContain(required);
    expect(job).not.toMatch(/continue-on-error|YELLOW_REVIEW_PASSWORD=|YELLOW_RUNTIME_DATABASE_PASSWORD=/);
    const launcher = await Bun.file(new URL("../scripts/local-review.sh", import.meta.url)).text();
    expect(launcher).toContain("./setup.sh --db-only");
    expect(launcher).toContain("body.build?.expectedMigrationFrontier !== 78");
    expect(launcher).toContain("/api/v1/auth/local:login");
    expect(workflow.replace(/\r\n/g, "\n")).toContain("  database:\n");
    expect(workflow).toContain("YELLOW_REQUIRE_ORDER440_DURABILITY=1");
  });
});
