import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

type Diagnostics = {
  restart: string;
  logging: { driver: string; options: Record<string, string> };
  ulimits: { core: { soft: number; hard: number } };
};

const compose = Bun.YAML.parse(
  readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8"),
) as { services: Record<string, Diagnostics & Record<string, unknown>>; volumes?: Record<string, unknown> };

describe("runtime diagnostic storage policy", () => {
  test("every service has bounded logs, no automatic restart and no process core file", () => {
    expect(Object.keys(compose.services).sort()).toEqual([
      "app", "migrate", "postgres", "provision", "seed", "synthetic-provider", "valkey",
    ]);
    for (const service of Object.values(compose.services)) {
      expect(service.restart).toBe("no");
      expect(service.logging).toEqual({
        driver: "local", options: { "max-size": "10m", "max-file": "3" },
      });
      expect(service.ulimits.core).toEqual({ soft: 0, hard: 0 });
    }
  });

  test("diagnostic containment preserves database storage and loopback exposure", () => {
    expect(compose.services.postgres?.volumes).toEqual([
      "yellow-pg18data:/var/lib/postgresql",
    ]);
    expect(compose.services.app?.ports).toEqual([
      "127.0.0.1:${YELLOW_APP_PORT:-3000}:3000",
    ]);
    expect(compose.services.postgres?.ports).toEqual([
      "127.0.0.1:${YELLOW_POSTGRES_PORT:-5442}:5432",
    ]);
  });

  test("PostgreSQL runtime is pinned to the approved PostgreSQL 18 image", () => {
    expect(compose.services.postgres?.image).toBe(
      "postgres:18.6-alpine3.24@sha256:d8703cd7fba306b9fec9268ecedfa8a966846c053036a60e3635791957eb2f66",
    );
    expect(Object.keys(compose.volumes ?? {}).sort()).toEqual([
      "yellow-pg18data",
      "yellow-pgdata",
    ]);
  });
});
