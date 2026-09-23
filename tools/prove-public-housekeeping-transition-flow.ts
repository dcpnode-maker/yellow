const base = (process.env.YELLOW_PUBLIC_DEMO_URL ?? "http://127.0.0.1:3010").replace(/\/+$/u, "");
const property = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const task = "2283da31-de48-4bf3-8ae7-0cb384f02699";

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}${path}`, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${text}`);
  return JSON.parse(text) as T;
}

const login = await json<{ accessToken: string }>("/api/v1/auth/demo:enter", { method: "POST" });
const token = login.accessToken;

type TaskResponse = Readonly<{
  task: Readonly<{
    taskId: string;
    taskStatus: "assigned" | "in_progress" | "done" | "verified";
    roomCondition: "clean" | "dirty" | "pickup" | "inspected";
    roomUpdatedAt: string;
  }>;
}>;

async function taskState(): Promise<TaskResponse> {
  return json<TaskResponse>(`/api/v1/properties/${property}/housekeeping/tasks/${task}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function transition(action: "start" | "complete" | "verify", key: string): Promise<unknown> {
  const current = await taskState();
  const body = {
    action,
    expectedTaskStatus: current.task.taskStatus,
    expectedRoomCondition: current.task.roomCondition,
    expectedRoomUpdatedAt: current.task.roomUpdatedAt,
  };
  console.log(JSON.stringify({ submitting: body }, null, 2));
  return json(`/api/v1/properties/${property}/housekeeping/tasks/${task}/transition`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "idempotency-key": key,
    },
    body: JSON.stringify(body),
  });
}

const before = await taskState();
const runId = crypto.randomUUID();
const started = await transition("start", `order635-bun-start-${runId}`);
const completed = await transition("complete", `order635-bun-complete-${runId}`);
const verified = await transition("verify", `order635-bun-verify-${runId}`);
const after = await taskState().catch((error: unknown) => ({ hiddenAfterVerification: String(error) }));

console.log(JSON.stringify({ before, started, completed, verified, after }, null, 2));

const verifiedReceipt = verified as { taskStatus?: unknown; roomCondition?: unknown };
if (verifiedReceipt.taskStatus !== "verified" || verifiedReceipt.roomCondition !== "inspected") {
  throw new Error("Housekeeping transition proof did not finish verified/inspected.");
}
