import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

type ProbeResult = {
  name: string;
  ok: boolean;
  observed: number;
  budget: number;
  unit: "ms" | "bytes";
};

const publicBaseUrl = process.env.YELLOW_PUBLIC_DEMO_URL ?? "https://lying-jones-terminal-church.trycloudflare.com";
const localBaseUrl = process.env.YELLOW_LOCAL_DEMO_URL ?? "http://127.0.0.1:3010";
const builtAssetDir = resolve("public", "yellow-next", "assets");

const budgets = {
  localHealthMs: Number(process.env.YELLOW_BUDGET_LOCAL_HEALTH_MS ?? 350),
  publicHealthMs: Number(process.env.YELLOW_BUDGET_PUBLIC_HEALTH_MS ?? 2500),
  publicShellMs: Number(process.env.YELLOW_BUDGET_PUBLIC_SHELL_MS ?? 3500),
  totalJsBytes: Number(process.env.YELLOW_BUDGET_TOTAL_JS_BYTES ?? 1_650_000),
  largestJsBytes: Number(process.env.YELLOW_BUDGET_LARGEST_JS_BYTES ?? 430_000),
};

async function measureFetch(name: string, url: string, budget: number): Promise<ProbeResult> {
  const started = performance.now();
  const response = await fetch(url, {
    headers: {
      "accept": name.includes("shell") ? "text/html" : "application/json,text/plain,*/*",
      "cache-control": "no-cache",
    },
  });
  const body = await response.text();
  const elapsed = Math.round(performance.now() - started);
  const ok = response.ok && body.length > 0 && elapsed <= budget;

  return { name, ok, observed: elapsed, budget, unit: "ms" };
}

function assetBudgetResults(): ProbeResult[] {
  const jsFiles = readdirSync(builtAssetDir)
    .filter((file) => file.endsWith(".js"))
    .map((file) => ({
      file,
      bytes: statSync(join(builtAssetDir, file)).size,
    }));

  const totalJsBytes = jsFiles.reduce((sum, file) => sum + file.bytes, 0);
  const largestJsBytes = jsFiles.reduce((max, file) => Math.max(max, file.bytes), 0);

  return [
    {
      name: "total built JavaScript",
      ok: totalJsBytes <= budgets.totalJsBytes,
      observed: totalJsBytes,
      budget: budgets.totalJsBytes,
      unit: "bytes",
    },
    {
      name: "largest JavaScript chunk",
      ok: largestJsBytes <= budgets.largestJsBytes,
      observed: largestJsBytes,
      budget: budgets.largestJsBytes,
      unit: "bytes",
    },
  ];
}

async function main() {
  const results = [
    await measureFetch("local health", `${localBaseUrl}/health`, budgets.localHealthMs),
    await measureFetch("public health", `${publicBaseUrl}/health`, budgets.publicHealthMs),
    await measureFetch("public app shell", publicBaseUrl, budgets.publicShellMs),
    ...assetBudgetResults(),
  ];

  console.table(results.map((result) => ({
    check: result.name,
    observed: `${result.observed} ${result.unit}`,
    budget: `${result.budget} ${result.unit}`,
    ok: result.ok,
  })));

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    throw new Error(`Public demo speed budget failed: ${failed.map((result) => result.name).join(", ")}`);
  }
}

await main();
