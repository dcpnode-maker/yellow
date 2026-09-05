import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  EXPECTED_BUN,
  EXPECTED_POSTGRES,
  EXPECTED_VALKEY,
  validateContainerImagePinFiles,
  validateContainerImagePins,
} from "../scripts/check-container-image-pins";

const parentDockerfile = [
  "FROM oven/bun:1.3.14-alpine AS install",
  "FROM oven/bun:1.3.14-alpine AS database-tools",
  "FROM oven/bun:1.3.14-alpine AS runtime",
].join("\n");
const parentCompose = [
  `    image: ${EXPECTED_POSTGRES}`,
  "    image: valkey/valkey:8-alpine",
].join("\n");

describe("container image pin validator", () => {
  test("P0 parent is red from committed files", () => {
    const errors = validateContainerImagePins(parentDockerfile, parentCompose);
    expect(errors.some((error) => error.includes("mutable or undigested: oven/bun:1.3.14-alpine"))).toBe(true);
    expect(errors.some((error) => error.includes("mutable or undigested: valkey/valkey:8-alpine"))).toBe(true);
    expect(errors.some((error) => error.includes("Compose image reference is missing: postgres"))).toBe(false);
  });

  test("exact pinned references are green without filesystem or network access", () => {
    const dockerfile = parentDockerfile.replaceAll("oven/bun:1.3.14-alpine", EXPECTED_BUN);
    const compose = parentCompose.replace("valkey/valkey:8-alpine", EXPECTED_VALKEY);
    expect(validateContainerImagePins(dockerfile, compose)).toEqual([]);
  });

  test("rejects malformed, wrong, and unexpected references", () => {
    const dockerfile = `FROM ${EXPECTED_BUN}\nFROM oven/bun:1.3.14-alpine@sha256:bad\nFROM evil.example/app:latest`;
    const compose = `services:\n  postgres:\n    image: ${EXPECTED_POSTGRES}\n  valkey:\n    image: valkey/valkey:8.1.9-alpine@sha256:${"0".repeat(64)}`;
    const errors = validateContainerImagePins(dockerfile, compose);
    expect(errors.some((error) => error.includes("mutable or undigested"))).toBe(true);
    expect(errors.some((error) => error.includes("unexpected"))).toBe(true);
  });

  test("file helper reads only supplied repository files", () => {
    const root = mkdtempSync(join(tmpdir(), "yellow-container-pins-"));
    try {
      writeFileSync(join(root, "Dockerfile"), parentDockerfile.replaceAll("oven/bun:1.3.14-alpine", EXPECTED_BUN));
      writeFileSync(join(root, "docker-compose.yml"), parentCompose.replace("valkey/valkey:8-alpine", EXPECTED_VALKEY));
      expect(validateContainerImagePinFiles(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
