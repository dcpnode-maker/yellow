export type OverwatchNavigation = "today" | "reservations" | "housekeeping" | "rates" | "folios" | "guests" | null;
export type OverwatchFocus = "due_in" | "due_out" | "in_house" | null;
export type OverwatchReservationOperation = "create" | "edit" | "cancel" | "reinstate" | "no_show" | null;

export interface OverwatchReply {
  readonly answer: string;
  readonly navigation: OverwatchNavigation;
  readonly focus: OverwatchFocus;
  readonly requiresConfirmation: boolean;
  readonly reservationOperation: OverwatchReservationOperation;
  readonly provider: "gemini" | "local_fallback" | "not_configured";
  readonly model: string | null;
}

interface OverwatchTurn {
  readonly role: "user" | "assistant";
  readonly text: string;
}

const MAX_MESSAGE_LENGTH = 1_200;
const REQUEST_WINDOW_MS = 5 * 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const GEMINI_RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

type GeminiFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>;

/** A safe, user-facing refusal. Its text deliberately contains no submitted value. */
export class OverwatchRequestError extends Error {
  constructor(readonly status: 400 | 429, message: string) {
    super(message);
    this.name = "OverwatchRequestError";
  }
}

function normalizedMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const message = value.trim().replace(/\s+/g, " ");
  return message.length > 0 && message.length <= MAX_MESSAGE_LENGTH ? message : null;
}

function normalizedHistory(value: unknown): readonly OverwatchTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: OverwatchTurn[] = [];
  for (const item of value.slice(-8)) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const role = Reflect.get(item, "role");
    const text = Reflect.get(item, "text");
    if ((role !== "user" && role !== "assistant") || typeof text !== "string") continue;
    const normalized = text.trim().replace(/\s+/g, " ");
    if (normalized.length === 0 || normalized.length > 600) continue;
    turns.push(Object.freeze({ role, text: normalized }));
  }
  return Object.freeze(turns);
}

/**
 * Yellow's public assistant is deliberately not a guest-record assistant. This is
 * a conservative transport guard: if content resembles contact, payment,
 * government-document or account data, it never leaves Yellow.
 */
export function containsSensitiveOverwatchContent(value: string): boolean {
  return /(?:\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|(?:\+?\d[\s().-]*){8,}\d|\b(?:\d[ -]*?){13,19}\b|\b(?:passport|pan\b|aadhaar|aadhar|gstin|tax\s*id|credit\s*card|card\s*number|cvv|upi\s*(?:id|handle)?|bank\s*(?:account|number)|account\s*number|confirmation\s*(?:number|code)|booking\s*(?:number|reference))\b)/iu.test(value);
}

export function navigationFor(message: string): OverwatchNavigation {
  const value = message.toLocaleLowerCase();
  if (/(arrival|departure|today|check[ -]?in|check[ -]?out|in[ -]?house|आगमन|निर्गमन|आज|ಚೆಕ್.?ಇನ್|ಚೆಕ್.?ಔಟ್|ಆಗಮನ|ನಿರ್ಗಮನ|ಇಂದು|రాక|బయలుదేరు|ఈరోజు|చెక్.?ఇన్|చెక్.?అవుట్)/u.test(value)) return "today";
  // A rate request can legitimately mention a confirmation requirement.  Prefer
  // the specific commercial workflow over the generic reservation keyword so an
  // explanation such as “confirm a rate change” does not open the wrong screen.
  if (/(rate|price|restriction|inventory|meal|दर|किंमत|जेवण|ದರ|ಬೆಲೆ|ಊಟ|రేటు|ధర|భోజనం)/u.test(value)) return "rates";
  if (/(reservation|booking|confirm|आरक्षण|बुकिंग|ಕಾಯ್ದಿರింపు|ಬುಕಿಂಗ್|రిజర్వేషన్|బుకింగ్)/u.test(value)) return "reservations";
  if (/(room|clean|housekeeping|maintenance|dirty|खोली|स्वच्छ|हाऊसकीपिंग|ಕೊಠಡಿ|ಸ್ವಚ್ಛ|ಹೌಸ್.?ಕೀಪಿಂಗ್|గది|శుభ్రం|హౌస్.?కీపింగ్)/u.test(value)) return "housekeeping";
  if (/(folio|invoice|payment|charge|settle|फोलिओ|चलन|पेमेंट|ಫೋಲಿಯೋ|ಇನ್.?ವಾಯ್ಸ್|ಪಾವತಿ|ఫోలియో|ఇన్వాయిస్|చెల్లింపు)/u.test(value)) return "folios";
  if (/(guest|profile|history|preference|पाहुणे|प्रोफाइल|इतिहास|ಅತಿಥಿ|ಪ್ರೊಫೈಲ್|ಇತಿಹಾಸ|అతిథి|ప్రొఫైల్|చరిత్ర)/u.test(value)) return "guests";
  return null;
}

export function focusFor(message: string): OverwatchFocus {
  const value = message.toLocaleLowerCase();
  if (/(arrival|arrivals|due[ -]?in|आगमन|येणार|ಆಗಮನಗಳು|ఆగమనం|రాకలు|రాకలను)/u.test(value)) return "due_in";
  if (/(departure|departures|due[ -]?out|निर्गमन|प्रस्थान|ನಿರ್ಗಮನ|ಬಿಡುಗಡೆ|బయలుదేరు|నిష్క్రమణ)/u.test(value)) return "due_out";
  if (/(in[ -]?house|staying|checked[ -]?in|मुक्काम|वास्तव्य|ತಂಗಿರುವ|ನಿವಾಸ|బస చేస్తున్న|ఉన్న అతిథి)/u.test(value)) return "in_house";
  return null;
}

/**
 * Routes only the operation class. The browser opens the real reservation
 * workspace, which gathers canonical Party/offer evidence and owns the existing
 * confirmation-gated commit or PATCH command. Overwatch never fabricates a
 * reservation proposal from an untrusted sentence.
 */
export function reservationOperationFor(message: string): OverwatchReservationOperation {
  const value = message.toLocaleLowerCase();
  if (/(?:mark\s+(?:the\s+)?reservation\s+(?:as\s+)?no[ -]?show|mark\s+no[ -]?show|नो[ -]?शो|ನೋ[ -]?ಶೋ|నో[ -]?షో)/iu.test(value)) return "no_show";
  if (/(?:reinstate|restore|reopen).*(?:reservation|booking|stay)|(?:reservation|booking).*(?:reinstate|restore)|आरक्षण\s+(?:बहाल|पुनर्स्थापित)|ರಿಸರ್ವೇಶನ್\s+ಮರುಸ್ಥಾಪಿಸಿ|రిజర్వేషన్\s+పునరుద్ధరించండి/iu.test(value)) return "reinstate";
  if (/(?:cancel(?:lation)?).*(?:reservation|booking|stay)|(?:reservation|booking).*(?:cancel)|(?:आरक्षण|बुकिंग)\s+रद्द|ರಿಸರ್ವೇಶನ್\s+ರದ್ದು|రిజర్వేషన్\s+రద్దు/iu.test(value)) return "cancel";
  if (/(?:create|new|make|book|reserve|बनाओ|नई|नया|बुक|आरक्षण|ಹೊಸ|ಕಾಯ್ದಿರಿಸಿ|బుక్|కొత్త|రిజర్వేషన్).*(?:reservation|booking|stay|आरक्षण|बुकिंग|ಕಾಯ್ದಿರಿಸುವಿಕೆ|బుకింగ్|రిజర్వేషన్)|(?:reservation|booking|आरक्षण|बुकिंग|ಕಾಯ್ದಿರಿಸುವಿಕೆ|బుకింగ్|రిజర్వేషన్).*(?:create|new|make|बनाओ|नई|नया|ಹೊಸ|బుక్|కొత్త)/iu.test(value)) return "create";
  if (/(?:edit|modify|change|update|बदल|सुधार|ಬದಲಾಯಿಸು|ಮಾರ್ಪಡಿಸು|మార్చు|నవీకరించు).*(?:reservation|booking|stay|आरक्षण|बुकिंग|ಕಾಯ್ದಿರಿಸುವಿಕೆ|బుకింగ్|రిజర్వేషన్)/iu.test(value)) return "edit";
  return null;
}

function needsConfirmation(message: string): boolean {
  return /(check[ -]?in|check[ -]?out|cancel|modify|change|publish|rate|charge|payment|settle|post|रद्द|बदल|प्रकाशित|दर|पैसे|ರದ್ದು|ಬದಲಾವಣೆ|ಪ್ರಕಟಿಸು|ದರ|ಪಾವತಿ|రద్దు|మార్చు|ప్రచురించు|రేటు|చెల్లింపు)/iu.test(message);
}

function apiKeyPool(value: string | readonly string[] | undefined): readonly string[] {
  const supplied = typeof value === "string" ? value.split(",") : value ?? [];
  return Object.freeze([...new Set(supplied.map((key) => key.trim()).filter((key) => key.length > 0))]);
}

export class OverwatchService {
  readonly #requests = new Map<string, { startedAt: number; count: number }>();
  readonly #apiKeys: readonly string[];

  constructor(
    apiKeys: string | readonly string[] | undefined,
    // This account's 2.5 alias is listed but not available to its generation
    // endpoint. The Flash Lite alias is verified at startup configuration time
    // and keeps the public operator inside its bounded response window.
    private readonly model = "gemini-flash-lite-latest",
    private readonly fetcher: GeminiFetch = fetch,
  ) {
    this.#apiKeys = apiKeyPool(apiKeys);
  }

  async respond(input: unknown, sourceKey = "unknown"): Promise<OverwatchReply> {
    const message = normalizedMessage(Reflect.get(Object(input), "message"));
    if (!message) throw new Error("Tell Yellow what you need in one short sentence.");
    const history = normalizedHistory(Reflect.get(Object(input), "history"));
    if (containsSensitiveOverwatchContent(message) || history.some((turn) => containsSensitiveOverwatchContent(turn.text))) {
      throw new OverwatchRequestError(400, "For privacy, remove guest contact, payment, document, booking-reference, or account details before asking Yellow.");
    }
    this.#consumeRequestBudget(sourceKey);
    const navigation = navigationFor(message);
    const focus = focusFor(message);
    const reservationOperation = reservationOperationFor(message);
    const requiresConfirmation = needsConfirmation(message) || reservationOperation !== null;
    if (this.#apiKeys.length === 0) return { answer: "Overwatch is available for guided navigation, but its Gemini connection is not configured.", navigation, focus, requiresConfirmation, reservationOperation, provider: "not_configured", model: null };

    const fallback = (): OverwatchReply => ({
      answer: requiresConfirmation
        ? "I can prepare that change in Yellow, but you must review and visibly confirm it in the relevant workflow."
        : navigation === "today" && focus === "due_in"
          ? "I’ve opened today’s arrivals. Review the due-in lane to prepare each check-in."
          : navigation
            ? `I’ve opened the relevant ${navigation} workspace. Tell me what you would like to review or prepare.`
            : "I’m ready to help with hotel operations. Tell me which arrivals, reservations, rooms, rates, or folios you need.",
      navigation,
      focus,
      requiresConfirmation,
      reservationOperation,
      provider: "local_fallback",
      model: this.model,
    });
    for (const apiKey of this.#apiKeys) {
      let response: Response;
      try {
        response = await this.fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: "You are Overwatch, Yellow's hotel PMS assistant. Reply in the user's language. Be concise. You do not have live guest, payment, or rate data in this request, so never invent facts. Explain the relevant Yellow workflow and say that any write requires a visible confirmation." }] },
            contents: [...history.map((turn) => ({ role: turn.role === "assistant" ? "model" : "user", parts: [{ text: turn.text }] })), { role: "user", parts: [{ text: message }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 220 },
          }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch { continue; }
      if (!response.ok) {
        if (GEMINI_RETRYABLE_STATUS.has(response.status)) continue;
        return fallback();
      }
      const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
      if (answer) return { answer, navigation, focus, requiresConfirmation, reservationOperation, provider: "gemini", model: this.model };
    }
    return fallback();
  }

  #consumeRequestBudget(sourceKey: string): void {
    const key = sourceKey.length > 160 ? "unknown" : sourceKey;
    const now = Date.now();
    const prior = this.#requests.get(key);
    if (!prior || now - prior.startedAt >= REQUEST_WINDOW_MS) {
      this.#requests.set(key, { startedAt: now, count: 1 });
      return;
    }
    if (prior.count >= MAX_REQUESTS_PER_WINDOW) {
      throw new OverwatchRequestError(429, "Yellow has reached its short demo request limit. Please wait a few minutes and try again.");
    }
    prior.count += 1;
  }
}
