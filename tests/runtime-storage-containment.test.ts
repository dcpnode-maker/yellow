import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

type Diagnostics = {
  restart: string;
  logging: { driver: string; options: Record<string, string> };
  ulimits: { core: { soft: number; hard: number } };
};

const compose = Bun.YAML.parse(
  readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8"),
) as { services: Record<string, Diagnostics & Record<string, unknown>> };

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
      "yellow-pgdata:/var/lib/postgresql/data",
    ]);
    expect(compose.services.app?.ports).toEqual([
      "127.0.0.1:${YELLOW_APP_PORT:-3000}:3000",
    ]);
    expect(compose.services.postgres?.ports).toEqual([
      "127.0.0.1:${YELLOW_POSTGRES_PORT:-5442}:5432",
    ]);
  });
});
