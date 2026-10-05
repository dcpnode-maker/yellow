import { generateGeminiOverwatchText, getGeminiProviderStatus, type GeminiFetcher, type GeminiProviderConfig } from "./gemini-provider";

export type OverwatchLanguage = "en-IN" | "hi-IN";
export type OverwatchIntent =
  | "readiness"
  | "check_in"
  | "check_out"
  | "post_charge"
  | "move_room"
  | "housekeeping_task"
  | "reservation_cancel"
  | "unknown";

export interface OverwatchMessageInput {
  readonly prompt: string;
  readonly confirmationPhrase?: string;
  readonly geminiConfig?: GeminiProviderConfig;
  readonly fetcher?: GeminiFetcher;
}

export interface OverwatchMessageResult {
  readonly assistant: "Yellow Overwatch";
  readonly provider: "deterministic-local" | "gemini";
  readonly geminiConnected: boolean;
  readonly geminiModel: string | null;
  readonly language: OverwatchLanguage;
  readonly intent: OverwatchIntent;
  readonly operational: boolean;
  readonly requiresConfirmation: boolean;
  readonly confirmationPhrase: string | null;
  readonly confirmed: boolean;
  readonly executed: false;
  readonly message: string;
  readonly nextStep: string;
  readonly suggestedWorkbench: string;
  readonly suggestedActionId: string | null;
  readonly safetyNotes: readonly string[];
}

const OPERATIONAL_CONFIRMATION = "CONFIRM YELLOW OPERATION";
const BASE_SAFETY_NOTES = Object.freeze([
  "No PMS state was changed.",
  "Operational actions require exact confirmation and a governed command service before execution.",
  "The public demo may guide or preview only; PostgreSQL remains authoritative.",
]);

const INTENT_PATTERNS: readonly [OverwatchIntent, readonly RegExp[]][] = [
  ["check_in", [/\bcheck[-\s]?in\b/i, /\barrival\b/i, /चेक.?इन/i]],
  ["check_out", [/\bcheck[-\s]?out\b/i, /\bcheckout\b/i, /चेक.?आउट/i]],
  ["post_charge", [/\bpost\b.*\b(charge|payment|cash|folio)\b/i, /\bcharge\b/i, /पोस्ट|चार्ज|भुगतान/i]],
  ["move_room", [/\bmove\b.*\broom\b/i, /\broom move\b/i, /कमरा.*बदल|रूम.*बदल/i]],
  ["housekeeping_task", [/\bhousekeeping\b/i, /\bclean\b.*\broom\b/i, /हाउसकीपिंग|सफाई/i]],
  ["reservation_cancel", [/\bcancel\b.*\breservation\b/i, /\breinstate\b/i, /\bno[-\s]?show\b/i, /रद्द|कैंसल/i]],
  ["readiness", [/\bready\b/i, /\breadiness\b/i, /\bdemo\b/i, /तैयार/i]],
];

export function handleOverwatchMessage(input: OverwatchMessageInput): OverwatchMessageResult {
  const prompt = normalizePrompt(input.prompt);
  const language = detectLanguage(prompt);
  const intent = detectIntent(prompt);
  const operational = isOperationalIntent(intent);
  const confirmed = operational && input.confirmationPhrase === OPERATIONAL_CONFIRMATION;
  if (operational) {
    return Object.freeze({
      assistant: "Yellow Overwatch",
      provider: "deterministic-local",
      geminiConnected: false,
      geminiModel: null,
      language,
      intent,
      operational,
      requiresConfirmation: true,
      confirmationPhrase: OPERATIONAL_CONFIRMATION,
      confirmed,
      executed: false,
      message: confirmed
        ? localize(language, "Confirmation received, but execution is still disabled until the governed workflow service is connected and proved.")
        : localize(language, "This is an operational PMS action. I will not execute it without explicit confirmation."),
      nextStep: confirmed
        ? "Connect the governed workflow command and prove authoritative reread before enabling execution."
        : `Reply with exactly: ${OPERATIONAL_CONFIRMATION}`,
      suggestedWorkbench: suggestedWorkbenchFor(intent),
      suggestedActionId: suggestedActionIdFor(intent),
      safetyNotes: BASE_SAFETY_NOTES,
    });
  }
  return Object.freeze({
    assistant: "Yellow Overwatch",
    provider: "deterministic-local",
    geminiConnected: false,
    geminiModel: null,
    language,
    intent,
    operational,
    requiresConfirmation: false,
    confirmationPhrase: null,
    confirmed: false,
    executed: false,
    message: intent === "readiness"
      ? localize(language, "The colleague demo is not ready to share yet. I can show the readiness checklist.")
      : localize(language, "I can help with Yellow PMS demo readiness, but live Gemini and operational execution are not enabled in this checkout yet."),
    nextStep: intent === "readiness"
      ? "Open /api/v1/demo/readiness for the current proof checklist."
      : "Ask for readiness, arrival, cashier, checkout, housekeeping or group workflow status.",
    suggestedWorkbench: intent === "readiness" ? "/api/v1/demo/readiness" : "/api/v1/demo/front-desk-board",
    suggestedActionId: null,
    safetyNotes: BASE_SAFETY_NOTES,
  });
}

export async function handleOverwatchMessageWithProvider(input: OverwatchMessageInput): Promise<OverwatchMessageResult> {
  const local = handleOverwatchMessage(input);
  if (local.operational) return local;
  const providerStatus = getGeminiProviderStatus(input.geminiConfig);
  const gemini = await generateGeminiOverwatchText(input.prompt, input.geminiConfig, input.fetcher);
  if (gemini === null) {
    return Object.freeze({
      ...local,
      geminiModel: providerStatus.configured ? providerStatus.model : null,
    });
  }
  return Object.freeze({
    ...local,
    provider: "gemini",
    geminiConnected: true,
    geminiModel: gemini.model,
    message: gemini.text,
    nextStep: "Use explicit confirmation only for any state-changing PMS action.",
    safetyNotes: BASE_SAFETY_NOTES,
  });
}

function normalizePrompt(prompt: string): string {
  if (typeof prompt !== "string") return "";
  return prompt.trim().slice(0, 2_000);
}

function detectLanguage(prompt: string): OverwatchLanguage {
  return /[\u0900-\u097F]/.test(prompt) ? "hi-IN" : "en-IN";
}

function detectIntent(prompt: string): OverwatchIntent {
  for (const [intent, patterns] of INTENT_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(prompt))) return intent;
  }
  return "unknown";
}

function isOperationalIntent(intent: OverwatchIntent): boolean {
  return intent !== "unknown" && intent !== "readiness";
}

function suggestedWorkbenchFor(intent: OverwatchIntent): string {
  switch (intent) {
    case "check_in":
    case "post_charge":
    case "move_room":
    case "check_out":
      return "/api/v1/demo/front-desk-board";
    case "housekeeping_task":
      return "/api/v1/demo/front-desk-board";
    case "reservation_cancel":
      return "/api/v1/demo/operating-journey";
    case "readiness":
      return "/api/v1/demo/readiness";
    case "unknown":
      return "/api/v1/demo/front-desk-board";
  }
}

function suggestedActionIdFor(intent: OverwatchIntent): string | null {
  switch (intent) {
    case "check_in":
      return "check-in-arrival";
    case "check_out":
      return "prepare-checkout";
    case "post_charge":
      return "post-charge";
    case "move_room":
      return "move-room";
    case "housekeeping_task":
      return "mark-inspected";
    case "reservation_cancel":
      return "reservation-cancel-or-reinstate";
    case "readiness":
    case "unknown":
      return null;
  }
}

function localize(language: OverwatchLanguage, english: string): string {
  if (language === "hi-IN") return `Hindi/Indian English mode: ${english}`;
  return english;
}
