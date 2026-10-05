import { provisionDemoArrivalFixture } from "../src/demo/demo-arrival-fixture";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runCli(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.trim() === "") {
    console.error("DATABASE_URL is required");
    process.exitCode = 1;
    return;
  }
  try {
    const result = await provisionDemoArrivalFixture(databaseUrl);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`demo arrival provisioning failed: ${errorMessage(error)}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) await runCli();
