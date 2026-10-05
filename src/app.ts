import { Elysia } from "elysia";

import { buildGroupBlockManager, buildGroupBlocksWorkbench } from "./contexts/groups";
import { confirmDemoAction } from "./demo/action-confirmation";
import { buildDemoActionSafetyMatrix } from "./demo/action-safety-matrix";
import { buildDemoAiRehearsal } from "./demo/ai-rehearsal";
import { buildColleagueDemoScenario } from "./demo/colleague-scenario";
import { buildColleagueDemoReadiness, renderDemoReadinessHtml } from "./demo/colleague-readiness";
import { buildDemoFrontDeskBoard } from "./demo/front-desk-board";
import { buildDemoHotelPerformance } from "./demo/hotel-performance";
import { buildDemoGeminiLiveProof } from "./demo/gemini-live-proof";
import { executeGovernedCashierPosting } from "./demo/governed-cashier-posting-command";
import { executeGovernedCashierSettlement } from "./demo/governed-cashier-settlement-command";
import { executeGovernedCheckInCommand } from "./demo/governed-checkin-command";
import { executeGovernedCheckout } from "./demo/governed-checkout-command";
import { executeGovernedGroupBlockStatus } from "./demo/governed-group-block-status-command";
import { executeGovernedGroupPickup } from "./demo/governed-group-pickup-command";
import { executeGovernedGroupRoomingListImport } from "./demo/governed-group-rooming-list-command";
import { executeGovernedGroupWash } from "./demo/governed-group-wash-command";
import { executeGovernedHousekeepingCommand, type DemoHousekeepingCondition } from "./demo/governed-housekeeping-command";
import { executeGovernedRoomMove } from "./demo/governed-room-move-command";
import { DEMO_SHELL_CSS, renderMobileDemoShell } from "./demo/mobile-shell";
import { buildColleagueOperatingJourney } from "./demo/operating-journey";
import { buildColleagueDemoProofBundle } from "./demo/proof-bundle";
import { buildDemoPropertyConfiguration } from "./demo/property-config";
import { buildDemoPublicRuntimeProof } from "./demo/public-runtime-proof";
import { executeDemoSandboxAction } from "./demo/sandbox-execution";
import { buildColleagueSharePacket, renderColleagueSharePacketHtml } from "./demo/share-packet";
import { buildDemoWorkflowRehearsal } from "./demo/workflow-rehearsal";
import { SECURITY_HEADERS } from "./http/security-headers";
import { handleOverwatchMessageWithProvider } from "./overwatch/confirmation-gate";
import { getGeminiProviderStatus } from "./overwatch/gemini-provider";

export function createApp() {
  return new Elysia()
    .onAfterHandle(({ set }) => {
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        set.headers[name] = value;
      }
    })
    .onError(({ set }) => {
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        set.headers[name] = value;
      }
    })
    .get("/", ({ set }) => {
      set.headers["content-type"] = "text/html; charset=utf-8";
      return renderMobileDemoShell();
    })
    .get("/readiness", async ({ request, set }) => {
      set.headers["content-type"] = "text/html; charset=utf-8";
      const evidence = await buildCurrentDemoEvidence(request);
      return renderDemoReadinessHtml(buildColleagueDemoReadiness(evidence));
    })
    .get("/share", async ({ request, set }) => {
      set.headers["content-type"] = "text/html; charset=utf-8";
      const evidence = await buildCurrentDemoEvidence(request);
      return renderColleagueSharePacketHtml(buildColleagueSharePacket(evidence));
    })
    .get("/assets/demo.css", ({ set }) => {
      set.headers["content-type"] = "text/css; charset=utf-8";
      return DEMO_SHELL_CSS;
    })
    .get("/health", () => ({ status: "ok" as const }))
    .get("/api/v1/demo/colleague-scenario", () => buildColleagueDemoScenario())
    .get("/api/v1/demo/ai-rehearsal", async () => await buildDemoAiRehearsal())
    .get("/api/v1/demo/gemini-live-proof", async () => await buildDemoGeminiLiveProof())
    .get("/api/v1/demo/action-safety-matrix", () => buildDemoActionSafetyMatrix())
    .get("/api/v1/demo/property-config", () => buildDemoPropertyConfiguration())
    .get("/api/v1/demo/readiness", async ({ request }) => buildColleagueDemoReadiness(await buildCurrentDemoEvidence(request)))
    .get("/api/v1/demo/share-packet", async ({ request }) => buildColleagueSharePacket(await buildCurrentDemoEvidence(request)))
    .get("/api/v1/demo/front-desk-board", () => buildDemoFrontDeskBoard())
    .get("/api/v1/demo/performance", () => buildDemoHotelPerformance())
    .get("/api/v1/demo/operating-journey", () => buildColleagueOperatingJourney())
    .get("/api/v1/demo/proof-bundle", async ({ request }) => buildColleagueDemoProofBundle(await buildCurrentDemoEvidence(request)))
    .get("/api/v1/demo/public-runtime-proof", ({ request }) => buildDemoPublicRuntimeProof({
      requestUrl: request.url,
      forwardedProto: request.headers.get("x-forwarded-proto"),
      forwardedHost: request.headers.get("x-forwarded-host"),
      userAgent: request.headers.get("user-agent"),
    }))
    .get("/api/v1/demo/group-blocks", () => buildGroupBlocksWorkbench("2026-09-23"))
    .get("/api/v1/demo/group-blocks/manager", () => buildGroupBlockManager("2026-09-23"))
    .get("/api/v1/demo/workflow-rehearsal", () => buildDemoWorkflowRehearsal())
    .post("/api/v1/demo/actions/confirm", async ({ request, set }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        set.status = 400;
        return { error: "invalid_json" as const };
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        set.status = 400;
        return { error: "invalid_body" as const };
      }
      const actionId = (body as { actionId?: unknown }).actionId;
      const confirmationPhrase = (body as { confirmationPhrase?: unknown }).confirmationPhrase;
      if (typeof actionId !== "string" || actionId.trim() === "") {
        set.status = 400;
        return { error: "action_required" as const };
      }
      const result = confirmDemoAction({
        actionId,
        ...(typeof confirmationPhrase === "string" ? { confirmationPhrase } : {}),
      });
      if ("error" in result) {
        set.status = 404;
        return result;
      }
      return result;
    })
    .post("/api/v1/demo/sandbox/actions/execute", async ({ request, set }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        set.status = 400;
        return { error: "invalid_json" as const };
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        set.status = 400;
        return { error: "invalid_body" as const };
      }
      const actionId = (body as { actionId?: unknown }).actionId;
      const confirmationPhrase = (body as { confirmationPhrase?: unknown }).confirmationPhrase;
      if (typeof actionId !== "string" || actionId.trim() === "") {
        set.status = 400;
        return { error: "action_required" as const };
      }
      const result = executeDemoSandboxAction({
        actionId,
        ...(typeof confirmationPhrase === "string" ? { confirmationPhrase } : {}),
      });
      if ("error" in result) {
        set.status = 404;
        return result;
      }
      return result;
    })
    .post("/api/v1/demo/governed/housekeeping/condition", async ({ request, set }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        set.status = 400;
        return { error: "invalid_json" as const };
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        set.status = 400;
        return { error: "invalid_body" as const };
      }
      const confirmationPhrase = (body as { confirmationPhrase?: unknown }).confirmationPhrase;
      const roomCode = (body as { roomCode?: unknown }).roomCode;
      const condition = (body as { condition?: unknown }).condition;
      const allowedConditions = new Set(["clean", "dirty", "pickup", "inspected"]);
      if (condition !== undefined && (typeof condition !== "string" || !allowedConditions.has(condition))) {
        set.status = 400;
        return { error: "invalid_condition" as const };
      }
      const result = await executeGovernedHousekeepingCommand({
        ...(typeof roomCode === "string" ? { roomCode } : {}),
        ...(typeof condition === "string" ? { condition: condition as DemoHousekeepingCondition } : {}),
        ...(typeof confirmationPhrase === "string" ? { confirmationPhrase } : {}),
        databaseUrl: process.env.DATABASE_URL,
      });
      if (result.confirmed && !result.databaseConfigured) set.status = 503;
      return result;
    })
    .post("/api/v1/demo/governed/check-in", async ({ request, set }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        set.status = 400;
        return { error: "invalid_json" as const };
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        set.status = 400;
        return { error: "invalid_body" as const };
      }
      const confirmationPhrase = (body as { confirmationPhrase?: unknown }).confirmationPhrase;
      const confirmationNo = (body as { confirmationNo?: unknown }).confirmationNo;
      const roomCode = (body as { roomCode?: unknown }).roomCode;
      const result = await executeGovernedCheckInCommand({
        ...(typeof confirmationNo === "string" ? { confirmationNo } : {}),
        ...(typeof roomCode === "string" ? { roomCode } : {}),
        ...(typeof confirmationPhrase === "string" ? { confirmationPhrase } : {}),
        databaseUrl: process.env.DATABASE_URL,
      });
      if (result.confirmed && !result.databaseConfigured) set.status = 503;
      return result;
    })
    .post("/api/v1/demo/governed/cashier/post-charge", async ({ request, set }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        set.status = 400;
        return { error: "invalid_json" as const };
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        set.status = 400;
        return { error: "invalid_body" as const };
      }
      const confirmationPhrase = (body as { confirmationPhrase?: unknown }).confirmationPhrase;
      const confirmationNo = (body as { confirmationNo?: unknown }).confirmationNo;
      const folioNo = (body as { folioNo?: unknown }).folioNo;
      const chargeKey = (body as { chargeKey?: unknown }).chargeKey;
      const result = await executeGovernedCashierPosting({
        ...(typeof confirmationNo === "string" ? { confirmationNo } : {}),
        ...(typeof folioNo === "string" ? { folioNo } : {}),
        ...(typeof chargeKey === "string" ? { chargeKey } : {}),
        ...(typeof confirmationPhrase === "string" ? { confirmationPhrase } : {}),
        databaseUrl: process.env.DATABASE_URL,
      });
      if (result.confirmed && !result.databaseConfigured) set.status = 503;
      return result;
    })
    .post("/api/v1/demo/governed/cashier/settle-payment", async ({ request, set }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        set.status = 400;
        return { error: "invalid_json" as const };
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        set.status = 400;
        return { error: "invalid_body" as const };
      }
      const confirmationPhrase = (body as { confirmationPhrase?: unknown }).confirmationPhrase;
      const confirmationNo = (body as { confirmationNo?: unknown }).confirmationNo;
      const folioNo = (body as { folioNo?: unknown }).folioNo;
      const settlementKey = (body as { settlementKey?: unknown }).settlementKey;
      const result = await executeGovernedCashierSettlement({
        ...(typeof confirmationNo === "string" ? { confirmationNo } : {}),
        ...(typeof folioNo === "string" ? { folioNo } : {}),
        ...(typeof settlementKey === "string" ? { settlementKey } : {}),
        ...(typeof confirmationPhrase === "string" ? { confirmationPhrase } : {}),
        databaseUrl: process.env.DATABASE_URL,
      });
      if (result.confirmed && !result.databaseConfigured) set.status = 503;
      return result;
    })
    .post("/api/v1/demo/governed/checkout/complete", async ({ request, set }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        set.status = 400;
        return { error: "invalid_json" as const };
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        set.status = 400;
        return { error: "invalid_body" as const };
      }
      const confirmationPhrase = (body as { confirmationPhrase?: unknown }).confirmationPhrase;
      const confirmationNo = (body as { confirmationNo?: unknown }).confirmationNo;
      const folioNo = (body as { folioNo?: unknown }).folioNo;
      const roomCode = (body as { roomCode?: unknown }).roomCode;
      const result = await executeGovernedCheckout({
        ...(typeof confirmationNo === "string" ? { confirmationNo } : {}),
        ...(typeof folioNo === "string" ? { folioNo } : {}),
        ...(typeof roomCode === "string" ? { roomCode } : {}),
        ...(typeof confirmationPhrase === "string" ? { confirmationPhrase } : {}),
        databaseUrl: process.env.DATABASE_URL,
      });
      if (result.confirmed && !result.databaseConfigured) set.status = 503;
      return result;
    })
    .post("/api/v1/demo/governed/group-block/status", async ({ request, set }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        set.status = 400;
        return { error: "invalid_json" as const };
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        set.status = 400;
        return { error: "invalid_body" as const };
      }
      const confirmationPhrase = (body as { confirmationPhrase?: unknown }).confirmationPhrase;
      const blockCode = (body as { blockCode?: unknown }).blockCode;
      const targetStatus = (body as { targetStatus?: unknown }).targetStatus;
      const result = await executeGovernedGroupBlockStatus({
        ...(typeof blockCode === "string" ? { blockCode } : {}),
        ...(typeof targetStatus === "string" ? { targetStatus } : {}),
        ...(typeof confirmationPhrase === "string" ? { confirmationPhrase } : {}),
        databaseUrl: process.env.DATABASE_URL,
      });
      if (result.confirmed && !result.databaseConfigured) set.status = 503;
      return result;
    })
    .post("/api/v1/demo/governed/group-block/pickup", async ({ request, set }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        set.status = 400;
        return { error: "invalid_json" as const };
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        set.status = 400;
        return { error: "invalid_body" as const };
      }
      const confirmationPhrase = (body as { confirmationPhrase?: unknown }).confirmationPhrase;
      const blockCode = (body as { blockCode?: unknown }).blockCode;
      const stayDate = (body as { stayDate?: unknown }).stayDate;
      const unitTypeCode = (body as { unitTypeCode?: unknown }).unitTypeCode;
      const quantity = (body as { quantity?: unknown }).quantity;
      const result = await executeGovernedGroupPickup({
        ...(typeof blockCode === "string" ? { blockCode } : {}),
        ...(typeof stayDate === "string" ? { stayDate } : {}),
        ...(typeof unitTypeCode === "string" ? { unitTypeCode } : {}),
        ...(typeof quantity === "number" ? { quantity } : {}),
        ...(typeof confirmationPhrase === "string" ? { confirmationPhrase } : {}),
        databaseUrl: process.env.DATABASE_URL,
      });
      if (result.confirmed && !result.databaseConfigured) set.status = 503;
      return result;
    })
    .post("/api/v1/demo/governed/group-block/wash", async ({ request, set }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        set.status = 400;
        return { error: "invalid_json" as const };
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        set.status = 400;
        return { error: "invalid_body" as const };
      }
      const confirmationPhrase = (body as { confirmationPhrase?: unknown }).confirmationPhrase;
      const blockCode = (body as { blockCode?: unknown }).blockCode;
      const stayDate = (body as { stayDate?: unknown }).stayDate;
      const unitTypeCode = (body as { unitTypeCode?: unknown }).unitTypeCode;
      const result = await executeGovernedGroupWash({
        ...(typeof blockCode === "string" ? { blockCode } : {}),
        ...(typeof stayDate === "string" ? { stayDate } : {}),
        ...(typeof unitTypeCode === "string" ? { unitTypeCode } : {}),
        ...(typeof confirmationPhrase === "string" ? { confirmationPhrase } : {}),
        databaseUrl: process.env.DATABASE_URL,
      });
      if (result.confirmed && !result.databaseConfigured) set.status = 503;
      return result;
    })
    .post("/api/v1/demo/governed/group-block/rooming-list/import", async ({ request, set }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        set.status = 400;
        return { error: "invalid_json" as const };
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        set.status = 400;
        return { error: "invalid_body" as const };
      }
      const confirmationPhrase = (body as { confirmationPhrase?: unknown }).confirmationPhrase;
      const blockCode = (body as { blockCode?: unknown }).blockCode;
      const confirmationNo = (body as { confirmationNo?: unknown }).confirmationNo;
      const result = await executeGovernedGroupRoomingListImport({
        ...(typeof blockCode === "string" ? { blockCode } : {}),
        ...(typeof confirmationNo === "string" ? { confirmationNo } : {}),
        ...(typeof confirmationPhrase === "string" ? { confirmationPhrase } : {}),
        databaseUrl: process.env.DATABASE_URL,
      });
      if (result.confirmed && !result.databaseConfigured) set.status = 503;
      return result;
    })
    .post("/api/v1/demo/governed/room-move", async ({ request, set }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        set.status = 400;
        return { error: "invalid_json" as const };
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        set.status = 400;
        return { error: "invalid_body" as const };
      }
      const confirmationPhrase = (body as { confirmationPhrase?: unknown }).confirmationPhrase;
      const confirmationNo = (body as { confirmationNo?: unknown }).confirmationNo;
      const fromRoomCode = (body as { fromRoomCode?: unknown }).fromRoomCode;
      const toRoomCode = (body as { toRoomCode?: unknown }).toRoomCode;
      const result = await executeGovernedRoomMove({
        ...(typeof confirmationNo === "string" ? { confirmationNo } : {}),
        ...(typeof fromRoomCode === "string" ? { fromRoomCode } : {}),
        ...(typeof toRoomCode === "string" ? { toRoomCode } : {}),
        ...(typeof confirmationPhrase === "string" ? { confirmationPhrase } : {}),
        databaseUrl: process.env.DATABASE_URL,
      });
      if (result.confirmed && !result.databaseConfigured) set.status = 503;
      return result;
    })
    .get("/api/v1/overwatch/provider", () => getGeminiProviderStatus())
    .post("/api/v1/overwatch/message", async ({ request, set }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        set.status = 400;
        return { error: "invalid_json" as const };
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        set.status = 400;
        return { error: "invalid_body" as const };
      }
      const prompt = (body as { prompt?: unknown }).prompt;
      const confirmationPhrase = (body as { confirmationPhrase?: unknown }).confirmationPhrase;
      if (typeof prompt !== "string" || prompt.trim() === "") {
        set.status = 400;
        return { error: "prompt_required" as const };
      }
      return await handleOverwatchMessageWithProvider({
        prompt,
        ...(typeof confirmationPhrase === "string" ? { confirmationPhrase } : {}),
      });
    });
}

export const app = createApp();

async function buildCurrentDemoEvidence(request: Request) {
  const publicRuntime = buildDemoPublicRuntimeProof({
    requestUrl: request.url,
    forwardedProto: request.headers.get("x-forwarded-proto"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    userAgent: request.headers.get("user-agent"),
  });
  const gemini = await buildDemoGeminiLiveProof();
  return Object.freeze({
    publicAccessObserved: publicRuntime.publicAccessObserved,
    mobileProofObserved: publicRuntime.mobileProofObserved,
    liveGeminiProved: gemini.liveGeminiProved,
  });
}
