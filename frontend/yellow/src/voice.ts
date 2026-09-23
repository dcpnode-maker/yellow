import {
  createMovementQuery,
  type MovementQuery,
  type MovementSortKey,
} from "./today-workspace";

export type VoiceReservation = Readonly<{
  reservationId: string;
  primaryPartyId?: string;
  confirmationNo: string;
  primaryGuestDisplayName?: string;
  primaryPartyName?: string;
  sellableUnitLabel?: string;
  status?: string;
  operationalState?: string;
}>;

export type OperationalLane = "due_in" | "due_out" | "in_house";
export type OperationalStateIntent = "checked_in_today" | "stayover" | "checked_out_today";
export type WorkspaceIntent =
  "reservations" | "guests" | "housekeeping" | "cashiers" | "rates";
export type KpiIntent =
  | "occupancy"
  | "rooms_sold"
  | "adr"
  | "revpar"
  | "inventory"
  | "performance";
export type LocalReadIntent =
  | Readonly<{ kind: "state"; state: OperationalStateIntent }>
  | Readonly<{ kind: "lane"; lane: OperationalLane }>
  | Readonly<{ kind: "metric"; metric: KpiIntent }>
  | Readonly<{ kind: "workspace"; workspace: WorkspaceIntent }>;
export type ReservationQueryView = OperationalLane | "all";
export type ReservationQueryContext = Readonly<{
  view: ReservationQueryView;
  query: MovementQuery;
}>;
export type ReservationQueryOptions = Readonly<{
  now: Date;
  timezone: string;
  sources: readonly string[];
  roomTypes: readonly string[];
  ratePlans: readonly string[];
}>;
export type ReservationQueryResolution =
  | Readonly<{ kind: "apply"; context: ReservationQueryContext }>
  | Readonly<{ kind: "clarify"; message: string }>;
export type VoiceLanguage = "English (India)" | "Hindi" | "Marathi" | "Kannada" | "Telugu";
export const defaultVoiceLanguage: VoiceLanguage = "English (India)";

// Keep recognition open across normal phrase breaks.  This is intentionally longer
// than a tap-to-talk command parser, while still returning promptly after a turn.
export const voicePauseMs = 2200;
export const voiceRestartLimit = 8;

export function preferredSpeechVoice<T extends Readonly<{ lang: string; name: string }>>(
  voices: readonly T[],
  languageCode: string,
): T | null {
  const exactLanguage = (voice: T) => voice.lang.toLowerCase() === languageCode.toLowerCase();
  return voices.find((voice) => exactLanguage(voice) && /male|ravi|aarav|india/iu.test(voice.name))
    ?? voices.find(exactLanguage)
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(languageCode.slice(0, 2).toLowerCase()))
    ?? null;
}

export type VoiceTranscriptChunk = Readonly<{
  transcript: string;
  isFinal: boolean;
}>;

/**
 * Merge only newly reported recognition chunks. Finalized words become the
 * durable command buffer; interim words are display-only and may be rewritten
 * by the browser on the next event.
 */
export function mergeVoiceTranscript(
  committed: string,
  chunks: readonly VoiceTranscriptChunk[],
): Readonly<{ committed: string; display: string }> {
  const clean = (value: string) => value.trim().replace(/\s+/gu, " ");
  const finalized = clean(
    chunks
      .filter((chunk) => chunk.isFinal)
      .map((chunk) => chunk.transcript)
      .join(" "),
  );
  const interim = clean(
    chunks
      .filter((chunk) => !chunk.isFinal)
      .map((chunk) => chunk.transcript)
      .join(" "),
  );
  const nextCommitted = clean([committed, finalized].filter(Boolean).join(" "));
  return {
    committed: nextCommitted,
    display: clean([nextCommitted, interim].filter(Boolean).join(" ")),
  };
}

/**
 * Browser locale is a privacy-preserving hint, not a location claim. Yellow
 * never asks a third party for an operator's IP address to choose a language.
 */
export function languageFromBrowserLocales(locales: readonly string[]): VoiceLanguage {
  const normalized = locales.map((locale) => locale.toLowerCase());
  if (normalized.some((locale) => locale.startsWith("mr"))) return "Marathi";
  if (normalized.some((locale) => locale.startsWith("kn"))) return "Kannada";
  if (normalized.some((locale) => locale.startsWith("te"))) return "Telugu";
  if (normalized.some((locale) => locale.startsWith("hi"))) return "Hindi";
  return "English (India)";
}

/** Accept an explicit spoken preference; ambiguous hotel commands never switch it. */
export function languagePreferenceFromText(value: string): VoiceLanguage | null {
  const request = value.trim().replace(/[.!?]+$/u, "").replace(/\s+/gu, " ");
  const explicitlyRequests = (language: string): boolean => new RegExp(
    `^(?:(?:please )?(?:(?:speak|use|continue in|talk in|switch to) )?${language}(?: please)?|i(?:'d| would)? prefer ${language}|i want to (?:speak|use) ${language}|my language is ${language})$`,
    "iu",
  ).test(request);
  if (explicitlyRequests("(?:marathi|मराठी)")) return "Marathi";
  if (explicitlyRequests("(?:hindi|हिंदी)")) return "Hindi";
  if (explicitlyRequests("(?:kannada|ಕನ್ನಡ)")) return "Kannada";
  if (explicitlyRequests("(?:telugu|తెలుగు)")) return "Telugu";
  if (explicitlyRequests("(?:english(?: india)?|अंग्रेजी)")) return "English (India)";
  return null;
}

export type SpeechOutputIntent =
  | Readonly<{ kind: "latest" }>
  | Readonly<{ kind: "answer"; query: string }>
  | Readonly<{ kind: "stop" }>;

/**
 * Speech output is a one-turn instruction, never a durable preference.  In
 * particular, microphone input and phrases such as "speak Marathi" do not grant
 * permission to vocalise an answer.
 */
export function speechOutputIntent(value: string): SpeechOutputIntent | null {
  const request = value.trim().replace(/\s+/gu, " ");
  if (!request || languagePreferenceFromText(request)) return null;
  if (/^(?:please\s+)?(?:stop|cancel|mute)(?:\s+(?:speaking|speech|voice|audio))?[.!]?$/iu.test(request))
    return Object.freeze({ kind: "stop" });
  if (/^(?:please\s+)?(?:speak|read|say)\s+(?:it|that|the\s+(?:answer|response)|the\s+last\s+(?:answer|response))(?:\s+(?:aloud|out\s+loud))?[.!]?$/iu.test(request))
    return Object.freeze({ kind: "latest" });

  const prefix = request.match(
    /^(?:please\s+)?(?:answer|respond|reply|tell\s+me)\s+(?:aloud|out\s+loud)(?:\s+(?:to|about))?\s*[:,-]?\s*(?<query>.+)$/iu,
  )?.groups?.query;
  const read = request.match(
    /^(?:please\s+)?(?:read|speak|say)\s+(?:aloud|out\s+loud)\s+(?:the\s+answer\s+to\s+)?(?<query>.+)$/iu,
  )?.groups?.query;
  const suffix = request.match(
    /^(?<query>.+?)(?:\s*[,;:-]\s*|\s+)(?:answer|respond|reply)(?:\s+to\s+me)?\s+(?:aloud|out\s+loud)[.!]?$/iu,
  )?.groups?.query;
  const query = (prefix ?? read ?? suffix)?.trim().replace(/[.!?]+$/u, "");
  return query ? Object.freeze({ kind: "answer", query }) : null;
}

export type VoiceMicrophoneAccess = "granted" | "unavailable" | "denied";

/** A bare wake phrase is local UI intent, never a reason to call a model. */
export function isAssistantWakeWord(value: string): boolean {
  return /^\s*(?:(?:hi|hello|hey)\s+)?(?:yellow|overwatch)[!,.?\s]*$/iu.test(value);
}

/**
 * Ask the browser for microphone access before starting its speech-recognition
 * service. The temporary stream is released immediately: recognition owns its
 * own capture lifecycle and Yellow never records raw microphone audio.
 */
export async function requestVoiceMicrophone(
  mediaDevices: Pick<MediaDevices, "getUserMedia"> | undefined,
): Promise<VoiceMicrophoneAccess> {
  if (!mediaDevices?.getUserMedia) return "unavailable";
  try {
    const stream = await mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return "granted";
  } catch {
    return "denied";
  }
}

export function requestedOperationalLane(
  value: string,
): OperationalLane | null {
  if (
    /(arrival|arrivals|due[ -]?in|today.?s check.?in|आगमन|येणार|ಆಗಮನ|రాక)/iu.test(
      value,
    )
  )
    return "due_in";
  if (
    /(departure|departures|due[ -]?out|check.?out|निर्गमन|प्रस्थान|ಬಿಡುಗಡೆ|ನಿರ್ಗಮನ|బయలుదేరు|నిష్క్రమణ)/iu.test(
      value,
    )
  )
    return "due_out";
  if (
    /(in[ -]?house|staying|checked[ -]?in|मुक्काम|वास्तव्य|ತಂಗಿರುವ|ನಿವಾಸ|బస చేస్తున్న|ఉన్న అతిథి)/iu.test(
      value,
    )
  )
    return "in_house";
  return null;
}

/** Completed events and stayovers are exact server-owned states, not lane aliases. */
export function requestedOperationalState(value: string): OperationalStateIntent | null {
  if (/(?:guests?\s+)?checked[ -]?in\s+today|actual\s+check[ -]?ins?\s+today/iu.test(value))
    return "checked_in_today";
  if (/stayovers?|continuing\s+(?:in[ -]?house\s+)?stays?/iu.test(value))
    return "stayover";
  if (/(?:guests?\s+)?checked[ -]?out\s+today|actual\s+check[ -]?outs?\s+today/iu.test(value))
    return "checked_out_today";
  return null;
}

/** A lane request is a focused read-only view, never an implicit workflow action. */
export function operationalLanePath(
  propertyId: string,
  lane: OperationalLane,
): string {
  return `/p/${encodeURIComponent(propertyId)}/today?lane=${encodeURIComponent(lane)}`;
}

/**
 * Converts only Yellow's finite, server-selected guidance contract into a
 * browser route.  Model prose is never treated as a URL or an instruction.
 * A focus is meaningful solely for the Today workspace and remains read-only.
 */
export function guidedNavigationPath(
  propertyId: string,
  navigation: unknown,
  focus: unknown,
): string | null {
  const property = encodeURIComponent(propertyId);
  if (navigation === "today") {
    return focus === "due_in" || focus === "due_out" || focus === "in_house"
      ? operationalLanePath(propertyId, focus)
      : `/p/${property}/today`;
  }
  if (navigation === "reservations") return `/p/${property}/reservations`;
  if (navigation === "guests") return `/p/${property}/guests`;
  if (navigation === "housekeeping") return `/p/${property}/housekeeping`;
  if (navigation === "folios") return `/p/${property}/today?workspace=finance`;
  if (navigation === "rates") return `/p/${property}/today?workspace=rates`;
  return null;
}

/** Local operational navigation deliberately precedes any model request. */
export function requestedWorkspace(value: string): WorkspaceIntent | null {
  if (
    /(rates?|pricing|price|rate.?plan|restriction|meal.?plan|दर|किंमत|दर योजना|किंमत योजना|ದರ|ಬೆಲೆ|ದರ ಯೋಜನೆ|ರೇಟು|రేట్లు|ధర|రేట్ ప్లాన్)/iu.test(
      value,
    )
  )
    return "rates";
  if (
    /(housekeeping|housekeeping rooms|room.?condition|cleaning|clean room|सफाई|हाउसकीपिंग|स्वच्छता|ಮನೆ.?ಸ್ವಚ್ಛತೆ|హౌస్.?కీపింగ్|శుభ్రం)/iu.test(
      value,
    )
  )
    return "housekeeping";
  if (
    /(cashier|cashiers|billing desk|guest bill|folio|folios|invoice|invoices|कॅशियर|कैशियर|बिलिंग|फोलियो|ಕ್ಯಾಶಿಯರ್|ಬಿಲ್ಲಿಂಗ್|ಫೋಲಿಯೋ|క్యాషియర్|బిల్లింగ్|ఫోలియో)/iu.test(
      value,
    )
  )
    return "cashiers";
  if (
    /(guest profile|guest profiles|guests|guest search|पाहुणे|अतिथि|मेहमान|अतिथियों|ಅತಿಥಿಗಳು|అతిథులు)/iu.test(
      value,
    )
  )
    return "guests";
  if (
    /(reservation|reservations|booking board|बुकिंग|आरक्षण|ರಿಸರ್ವೇಶನ್|ಬುಕಿಂಗ್|రిజర్వేషన్|బుకింగ్)/iu.test(
      value,
    )
  )
    return "reservations";
  return null;
}

/** Property KPI reads are deterministic and never need a model round-trip. */
export function requestedMetric(value: string): KpiIntent | null {
  if (/(?:operating|hotel)?\s*performance|actuals?|pace(?:\s+and\s+plan)?|forecast(?:ed)?\s+(?:and\s+)?budget|कामगिरी|प्रदर्शन|ಕಾರ್ಯಕ್ಷಮತೆ|పనితీరు/iu.test(value))
    return "performance";
  if (/rev\s*par|revenue\s+per\s+available\s+room/iu.test(value))
    return "revpar";
  if (/\badr\b|average\s+daily\s+rate|सरासरी\s+दैनिक\s+दर|औसत\s+दैनिक\s+दर|ಸರಾಸರಿ\s+ದೈನಂದಿನ\s+ದರ|సగటు\s+రోజువారీ\s+రేటు/iu.test(value))
    return "adr";
  if (/rooms?\s+sold|room\s+nights?|बेची\s+गई\s+रातें|विकलेल्या\s+रूम|ಮಾರಾಟವಾದ\s+ಕೊಠಡಿ|అమ్మిన\s+గదులు/iu.test(value))
    return "rooms_sold";
  if (/occupancy|occy|occupancy\s*%|अधिभोग|व्याप्ती|ಆಕ್ಯುಪೆನ್ಸಿ|ఆక్యుపెన్సీ/iu.test(value))
    return "occupancy";
  if (/total\s+(?:room\s+)?inventory|rooms?\s+available|available\s+rooms?|inventory|इन्वेंटरी|उपलब्ध\s+कमरे|इन्व्हेंटरी|उपलब्ध\s+खोल्या|ಇನ್ವೆಂಟರಿ|లభ్యమైన\s+గదులు|ఇన్వెంటరీ/iu.test(value))
    return "inventory";
  return null;
}

/**
 * Resolve safe local display requests in operational order. Movement wording
 * deliberately wins over the broader reservations vocabulary so "show today's
 * arrivals" can never degrade into a generic booking-board link.
 */
export function resolveLocalReadIntent(value: string): LocalReadIntent | null {
  const state = requestedOperationalState(value);
  if (state) return { kind: "state", state };
  const lane = requestedOperationalLane(value);
  if (lane) return { kind: "lane", lane };
  const metric = requestedMetric(value);
  if (metric) return { kind: "metric", metric };
  const workspace = requestedWorkspace(value);
  return workspace ? { kind: "workspace", workspace } : null;
}

function reservationQueryText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase()
    .replace(/[’']/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function optionInMessage(value: string, options: readonly string[]): string | null {
  const message = reservationQueryText(value);
  const compactMessage = message.replace(/[^a-z0-9]+/gu, "");
  const matches = options.filter((option) => {
    const normalized = reservationQueryText(option);
    const compact = normalized.replace(/[^a-z0-9]+/gu, "");
    return normalized.length >= 2 && (message.includes(normalized) || compactMessage.includes(compact));
  });
  return matches.length === 1 ? matches[0]! : null;
}

function propertyDateAt(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: "year" | "month" | "day") =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
}

function baseReservationQuery(view: ReservationQueryView): ReservationQueryContext {
  return Object.freeze({
    view,
    query: createMovementQuery(view === "due_out" ? "departure" : "arrival"),
  });
}

function withQuery(
  context: ReservationQueryContext,
  updates: Partial<Omit<MovementQuery, "movementTime">> & { movementTime?: MovementQuery["movementTime"] },
): ReservationQueryContext {
  return Object.freeze({
    view: context.view,
    query: createMovementQuery(
      updates.movementTime ?? context.query.movementTime,
      { ...context.query, ...updates },
    ),
  });
}

const knownChannelWords = /\b(?:airbnb|booking(?:\.com)?|agoda|expedia|vrbo|orbitz|makemytrip|goibibo|traveloka|trip\.com|direct)\b/iu;

/**
 * Resolve only finite reservation-board reads. Unknown qualifiers fail closed so
 * a compound request can never silently degrade to a broad arrivals list.
 */
export function resolveReservationQueryIntent(
  value: string,
  previous: ReservationQueryContext | null,
  options: ReservationQueryOptions,
): ReservationQueryResolution | null {
  const text = reservationQueryText(value);
  const exactState = requestedOperationalState(value);
  const departedHistory = /(?:departed|checked[ -]?out)\s+(?:guest\s+)?history|past\s+(?:departures|stays)/iu.test(value);
  const lane = requestedOperationalLane(value);
  const genericBoard = /\b(?:all\s+)?(?:reservations?|bookings?)\b/iu.test(value);
  const hasQualifier = /\b(?:today|tomorrow|source|channel|assigned|unassigned|room\s*type|rate\s*plan|earliest|latest|ascending|descending|clear|only|adults?|children|child|kids?|travel|pickup)\b/iu.test(value)
    || /(?:आज|उद्या|ನಾಳೆ|ಇಂದು|రేపు|ఈరోజు)/u.test(value)
    || /\d{4}-\d{2}-\d{2}/u.test(value)
    || knownChannelWords.test(value)
    || options.sources.some((item) => text.includes(reservationQueryText(item)))
    || options.roomTypes.some((item) => text.includes(reservationQueryText(item)))
    || options.ratePlans.some((item) => text.includes(reservationQueryText(item)));
  if (!exactState && !departedHistory && !lane && !genericBoard && !hasQualifier) return null;

  let context: ReservationQueryContext;
  if (exactState) {
    context = withQuery(baseReservationQuery(exactState === "checked_out_today" ? "all" : "in_house"), {
      state: exactState,
      movementTime: exactState === "checked_out_today" ? "departure" : "arrival",
    });
  } else if (departedHistory) {
    context = withQuery(baseReservationQuery("all"), { state: "checked_out", movementTime: "departure" });
  } else if (lane) {
    context = baseReservationQuery(lane);
  } else if (genericBoard) {
    context = baseReservationQuery("all");
  } else if (previous) {
    context = previous;
  } else {
    return { kind: "clarify", message: "Tell me which arrivals, departures, in-house guests or reservations to refine." };
  }

  const clearAll = /\bclear\s+(?:all\s+)?filters?\b/iu.test(value);
  if (clearAll) context = baseReservationQuery(context.view);
  const clearSource = /\bclear\s+(?:the\s+)?(?:source|channel)(?:\s+filter)?\b/iu.test(value);
  const clearAssignment = /\bclear\s+(?:the\s+)?assignment(?:\s+filter)?\b/iu.test(value);
  const clearDates = /\bclear\s+(?:the\s+)?dates?(?:\s+filter)?\b/iu.test(value);
  const clearRoomType = /\bclear\s+(?:the\s+)?room\s*type(?:\s+filter)?\b/iu.test(value);
  const clearRatePlan = /\bclear\s+(?:the\s+)?rate\s*plan(?:\s+filter)?\b/iu.test(value);
  const clearAdults = /\bclear\s+(?:the\s+)?adults?(?:\s+filter)?\b/iu.test(value);
  const clearChildren = /\bclear\s+(?:the\s+)?(?:children|child|kids?)(?:\s+filter)?\b/iu.test(value);
  const clearTravel = /\bclear\s+(?:the\s+)?travel(?:\s+filter)?\b/iu.test(value);
  const clearPickup = /\bclear\s+(?:the\s+)?pickup(?:\s+filter)?\b/iu.test(value);
  if (clearSource) context = withQuery(context, { source: "" });
  if (clearAssignment) context = withQuery(context, { assignment: "all" });
  if (clearDates) context = withQuery(context, { dateFrom: "", dateTo: "" });
  if (clearRoomType) context = withQuery(context, { roomType: "" });
  if (clearRatePlan) context = withQuery(context, { ratePlan: "" });
  if (clearAdults) context = withQuery(context, { minAdults: null });
  if (clearChildren) context = withQuery(context, { children: "all" });
  if (clearTravel) context = withQuery(context, { travel: "all" });
  if (clearPickup) context = withQuery(context, { pickup: "all" });

  const isoTokens = [...value.matchAll(/\b\d{4}-\d{2}-\d{2}\b/gu)].map((match) => match[0]);
  if (isoTokens.some((date) => !validIsoDate(date))) {
    return { kind: "clarify", message: "Use a valid date in YYYY-MM-DD format." };
  }
  let dateFrom = context.query.dateFrom;
  let dateTo = context.query.dateTo;
  const asksTomorrow = /\btomorrow\b/iu.test(value) || /(?:उद्या|ನಾಳೆ|రేపు)/u.test(value);
  const asksToday = /\btoday\b/iu.test(value) || /(?:आज|ಇಂದು|ఈరోజు)/u.test(value);
  if (asksTomorrow) {
    dateFrom = shiftDate(propertyDateAt(options.now, options.timezone), 1);
    dateTo = dateFrom;
  } else if (isoTokens.length >= 2) {
    dateFrom = isoTokens[0]!;
    dateTo = isoTokens[1]!;
  } else if (isoTokens.length === 1) {
    dateFrom = isoTokens[0]!;
    dateTo = isoTokens[0]!;
  } else if (asksToday && context.view === "all") {
    dateFrom = propertyDateAt(options.now, options.timezone);
    dateTo = dateFrom;
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return { kind: "clarify", message: "The start date must be on or before the end date." };
  }
  if (dateFrom !== context.query.dateFrom || dateTo !== context.query.dateTo) {
    context = withQuery(context, { dateFrom, dateTo, state: exactState || departedHistory ? context.query.state : "" });
  }

  const mentionedChannel = value.match(knownChannelWords)?.[0] ?? null;
  const source = optionInMessage(value, options.sources);
  if (source) context = withQuery(context, { source });
  else if (mentionedChannel && !clearSource) {
    return { kind: "clarify", message: `No recorded reservation source matches “${mentionedChannel}”.` };
  } else if (/\b(?:source|channel)\s+(?!filter\b)[a-z0-9. -]+/iu.test(value) && !clearSource) {
    return { kind: "clarify", message: "Name one source exactly as it appears on the reservation board." };
  }

  const roomType = optionInMessage(value, options.roomTypes);
  if (roomType) context = withQuery(context, { roomType });
  else if (/\broom\s*type\b/iu.test(value) && !clearRoomType) {
    return { kind: "clarify", message: "Name one recorded room type exactly as it appears on the reservation board." };
  }
  const ratePlan = optionInMessage(value, options.ratePlans);
  if (ratePlan) context = withQuery(context, { ratePlan });
  else if (/\brate\s*plan\b/iu.test(value) && !clearRatePlan) {
    return { kind: "clarify", message: "Name one recorded rate plan exactly as it appears on the reservation board." };
  }

  if (/\bunassigned\b/iu.test(value)) context = withQuery(context, { assignment: "unassigned" });
  else if (/\bassigned\b/iu.test(value)) context = withQuery(context, { assignment: "assigned" });

  const adultFilterPrefix = /\b(?:at\s+least|minimum|min)\b/iu.test(value);
  if (clearAdults && adultFilterPrefix) {
    return { kind: "clarify", message: "Clear the adult filter or set one minimum adult count, not both." };
  }
  const adultCountRules = [...value.matchAll(/\b(?:at\s+least|minimum|min)\b[^.,;!?]*?\badults?\b/giu)];
  if (adultFilterPrefix && adultCountRules.length !== 1) {
    return { kind: "clarify", message: "Use one whole-number minimum adult count from 1 to 20." };
  }
  const adultCountRule = adultCountRules[0]?.[0];
  const exactAdultRule = adultCountRule?.match(/^\s*(?:at\s+least|minimum|min)\s*(\d+)\s+adults?\s*$/iu);
  if (adultCountRule !== undefined && !exactAdultRule) {
    return { kind: "clarify", message: "Use a whole-number minimum adult count from 1 to 20." };
  }
  const remainingAdultText = (adultCountRule ? value.replace(adultCountRule, " ") : value)
    .replace(/\bclear\s+(?:the\s+)?adults?(?:\s+filter)?\b/giu, " ")
    .replace(/\b(?:most|fewest)\s+adults?(?:\s+first)?\b/giu, " ")
    .replace(/\bsort\s+by\s+adults?\b/giu, " ");
  if (/\badults?\b/iu.test(remainingAdultText)) {
    return { kind: "clarify", message: "Use one whole-number minimum adult count from 1 to 20." };
  }
  const adultCountToken = exactAdultRule?.[1];
  if (adultCountToken !== undefined) {
    if (!/^\d+$/u.test(adultCountToken)) {
      return { kind: "clarify", message: "Use a whole-number minimum adult count from 1 to 20." };
    }
    const count = Number(adultCountToken);
    if (!Number.isSafeInteger(count) || count < 1 || count > 20) {
      return { kind: "clarify", message: "Use a minimum adult count from 1 to 20." };
    }
    context = withQuery(context, { minAdults: count });
  }

  if (/\b(?:without|no)\s+(?:children|child|kids?)\b/iu.test(value)) {
    context = withQuery(context, { children: "absent" });
  } else if (/\b(?:with|having)\s+(?:children|child|kids?)\b/iu.test(value)) {
    context = withQuery(context, { children: "present" });
  }

  if (/\b(?:travel\s+(?:not\s+recorded|missing)|without\s+travel\s+(?:details|information))\b/iu.test(value)) {
    context = withQuery(context, { travel: "not_recorded" });
  } else if (/\b(?:travel\s+(?:recorded|provided)|with\s+travel\s+(?:details|information))\b/iu.test(value)) {
    context = withQuery(context, { travel: "recorded" });
  }

  if (/\b(?:no\s+pickup|pickup\s+not\s+recorded)\b/iu.test(value)) {
    context = withQuery(context, { pickup: "not_recorded" });
  } else if (/\b(?:pickup\s+requested|with\s+(?:a\s+)?pickup)\b/iu.test(value)) {
    context = withQuery(context, { pickup: "requested" });
  }

  let sortKey: MovementSortKey | null = null;
  if (/\b(?:earliest|latest)\b/iu.test(value)) sortKey = "eta";
  else if (/\bguest\s+(?:name\s+)?(?:first|order|sort)|alphabetical/iu.test(value)) sortKey = "guest";
  else if (/\broom\s+(?:first|order|sort)/iu.test(value)) sortKey = "room";
  else if (/\b(?:most|fewest)\s+adults?|sort\s+by\s+adults?/iu.test(value)) sortKey = "adults";
  else if (/\b(?:most|fewest)\s+(?:children|kids?)|sort\s+by\s+(?:children|kids?)/iu.test(value)) sortKey = "children";
  if (sortKey) {
    const direction = /\blatest|descending|most\b/iu.test(value) ? "desc" : "asc";
    context = withQuery(context, {
      sorts: [
        { key: sortKey, direction },
        ...(sortKey === "guest" ? [] : [{ key: "guest" as const, direction: "asc" as const }]),
      ],
    });
  }

  return { kind: "apply", context };
}

export type ReservationVoiceAction<TReservation extends VoiceReservation = VoiceReservation> = Readonly<{
  reservation: TReservation;
  workbench: "check-in" | "check-out" | "cashier" | "lifecycle" | null;
  lifecycleAction?: "cancel" | "reinstate" | "no_show";
  /** Present only when checkout opened one unique completed reservation from history. */
  completed?: boolean;
  /** The room label from the exact command-index row used for completed resolution. */
  roomLabel?: string;
}>;

export type CashierChargeIntent = Readonly<{
  currency: string;
  amountMinor: string;
  amountMajor: string;
  chargeQuery: string;
  guestQuery: string;
}>;

export type FolioBillWindowTransferIntent = Readonly<{
  chargeQuery: string;
  guestQuery: string;
  destination: Readonly<{ kind: "existing"; windowNo: number }> | Readonly<{ kind: "new"; name: string }>;
}>;

/**
 * A bill-window transfer is a whole, canonical charge-group move. Amounts,
 * percentages and quantities are deliberately not a grammar branch: Yellow
 * must refuse them rather than reinterpret a partial split as a full move.
 */
export function hasFolioBillWindowPartialSplitIntent(message: string): boolean {
  const value = message.trim();
  if (!/\b(?:move|transfer)\b/iu.test(value)) return false;
  return /(?:\b(?:partial|portion|half|quantity|units?)\b|\b\d+(?:\.\d+)?\s*(?:%|percent)(?=\s|$|[.!?,;:])|\b(?:sar|inr|usd|gbp|riyal|riyals|rupee|rupees|dollar|dollars|pound|pounds)\s*\d)/iu.test(value);
}

export function folioBillWindowTransferIntent(message: string): FolioBillWindowTransferIntent | null {
  const value = message.trim();
  if (hasFolioBillWindowPartialSplitIntent(value)) return null;
  const newWindow = /^(?:please\s+)?(?:move|transfer)\s+(.+?)\s+(?:for|from)\s+(.+?)\s+to\s+(?:a\s+)?new\s+(?:bill|window)(?:\s+called)?\s+(.+?)\s*[.!]?$/iu.exec(value);
  const existingWindow = /^(?:please\s+)?(?:move|transfer)\s+(.+?)\s+(?:for|from)\s+(.+?)\s+to\s+(?:bill\s+)?window\s+([1-9][0-9]?)\s*[.!]?$/iu.exec(value);
  const chargeQuery = (newWindow?.[1] ?? existingWindow?.[1] ?? "").trim();
  const guestQuery = (newWindow?.[2] ?? existingWindow?.[2] ?? "").trim();
  if (chargeQuery.length < 2 || chargeQuery.length > 80 || guestQuery.length < 2 || guestQuery.length > 120) return null;
  if (newWindow) {
    const name = newWindow[3]?.trim() ?? "";
    if (name.length < 1 || name.length > 80 || /[\x00-\x1f\x7f]/u.test(name)) return null;
    return Object.freeze({ chargeQuery, guestQuery, destination: Object.freeze({ kind: "new", name }) });
  }
  const windowNo = Number(existingWindow?.[3]);
  if (!Number.isSafeInteger(windowNo) || windowNo < 1 || windowNo > 99) return null;
  return Object.freeze({ chargeQuery, guestQuery, destination: Object.freeze({ kind: "existing", windowNo }) });
}

export type CashierChargeOptionResolution<TOption> =
  | Readonly<{ kind: "resolved"; option: TOption }>
  | Readonly<{ kind: "ambiguous" }>
  | Readonly<{ kind: "not_found" }>;

export function cashierChargeConfirmationIntent(message: string): "confirm" | "cancel" | null {
  const value = message.trim();
  if (/^(?:yes|yes please|go ahead|confirm|post it|haan|ha|हाँ)\s*[.!]?$/iu.test(value)) return "confirm";
  if (/^(?:no|no thanks|cancel|stop|not now|nahi|नहीं)\s*[.!]?$/iu.test(value)) return "cancel";
  return null;
}

function canonicalCurrency(value: string): string | null {
  const normalized = value.trim().toLocaleUpperCase().replaceAll(".", "");
  if (/^(?:SAR|RIYALS?)$/u.test(normalized) || value.trim() === "ر.س") return "SAR";
  if (/^(?:INR|RUPEES?)$/u.test(normalized) || value.trim() === "₹") return "INR";
  if (/^(?:GBP|POUNDS?)$/u.test(normalized) || value.trim() === "£") return "GBP";
  if (/^(?:USD|DOLLARS?)$/u.test(normalized) || value.trim() === "$") return "USD";
  return null;
}

function canonicalMinorUnits(value: string): Readonly<{ minor: string; major: string }> | null {
  if (!/^(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,2})?$/u.test(value)) return null;
  const [whole = "0", fractional = ""] = value.split(".");
  const minor = BigInt(whole) * 100n + BigInt(`${fractional}00`.slice(0, 2));
  if (minor < 1n || minor > 9_223_372_036_854_775_807n) return null;
  return Object.freeze({ minor: minor.toString(), major: `${whole}.${`${fractional}00`.slice(0, 2)}` });
}

/**
 * Parses only an explicit named-guest charge instruction with an explicit currency.
 * It prepares a proposal; this function never authorizes or performs a posting.
 */
export function cashierChargeIntent(message: string): CashierChargeIntent | null {
  const value = message.trim();
  const patterns = [
    /^(?:please\s+)?(?:post|add)\s+(?:a\s+|an\s+)?([A-Z]{3}|₹|£|\$|ر\.س|riyals?|rupees?|pounds?|dollars?)\s+(\d+(?:\.\d{1,2})?)\s+(.+?)\s+charge\s+(?:to|for)\s+(.+?)(?:'s)?(?:\s+(?:folio|bill))?\s*[.!]?$/iu,
    /^(?:please\s+)?(?:post|add)\s+(?:a\s+|an\s+)?(.+?)\s+charge\s+(?:of|for)\s+([A-Z]{3}|₹|£|\$|ر\.س|riyals?|rupees?|pounds?|dollars?)\s+(\d+(?:\.\d{1,2})?)\s+(?:to|for)\s+(.+?)(?:'s)?(?:\s+(?:folio|bill))?\s*[.!]?$/iu,
    /^(?:please\s+)?charge\s+(.+?)\s+([A-Z]{3}|₹|£|\$|ر\.س|riyals?|rupees?|pounds?|dollars?)\s+(\d+(?:\.\d{1,2})?)\s+for\s+(.+?)\s*[.!]?$/iu,
  ] as const;
  for (const [index, pattern] of patterns.entries()) {
    const match = pattern.exec(value);
    if (!match) continue;
    const currencyRaw = index === 1 ? match[2] : match[1 + (index === 2 ? 1 : 0)];
    const amountRaw = index === 1 ? match[3] : match[2 + (index === 2 ? 1 : 0)];
    const chargeQuery = (index === 0 ? match[3] : index === 1 ? match[1] : match[4])?.trim() ?? "";
    const guestQuery = (index === 0 ? match[4] : index === 1 ? match[4] : match[1])?.trim() ?? "";
    const currency = currencyRaw ? canonicalCurrency(currencyRaw) : null;
    const amount = amountRaw ? canonicalMinorUnits(amountRaw) : null;
    if (!currency || !amount || chargeQuery.length < 2 || chargeQuery.length > 80 || guestQuery.length < 2 || guestQuery.length > 120) return null;
    return Object.freeze({
      currency,
      amountMinor: amount.minor,
      amountMajor: amount.major,
      chargeQuery,
      guestQuery,
    });
  }
  return null;
}

export function resolveCashierChargeOption<TOption extends Readonly<{ code: string; name: string; usaliLine: string }>>(
  query: string,
  options: readonly TOption[],
): CashierChargeOptionResolution<TOption> {
  const wanted = reservationQueryText(query);
  if (!wanted) return Object.freeze({ kind: "not_found" });
  const exact = options.filter((option) =>
    reservationQueryText(option.code) === wanted || reservationQueryText(option.name) === wanted,
  );
  if (exact.length === 1) return Object.freeze({ kind: "resolved", option: exact[0]! });
  if (exact.length > 1) return Object.freeze({ kind: "ambiguous" });
  const terms = wanted.split(/\s+/u).filter((term) => term.length >= 2);
  const matches = options.filter((option) => {
    const searchable = reservationQueryText(`${option.code} ${option.name} ${option.usaliLine}`);
    return terms.length > 0 && terms.every((term) => searchable.includes(term));
  });
  if (matches.length === 1) return Object.freeze({ kind: "resolved", option: matches[0]! });
  return Object.freeze({ kind: matches.length > 1 ? "ambiguous" : "not_found" });
}

function normalise(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase();
}

export type GuestProfileVoiceAction = Readonly<{ partyId: string; displayName: string }>;
export type GuestProfileVoiceCandidate = Readonly<{ partyId: string; displayName: string; confirmations: readonly string[] }>;
export type ReservationGuestAllocationIntent =
  | Readonly<{
      kind: "add";
      query: string;
      role: "accompanying" | "sharer";
      sharePct: string | null;
      primarySharePct: string | null;
    }>
  | Readonly<{ kind: "remove"; query: string }>
  | Readonly<{ kind: "confirm" }>
  | Readonly<{ kind: "cancel" }>;

export function arrivalCleaningAttendantIntent(message: string): string | null {
  const match = /^(?:assign|send|give)\s+(?:the\s+)?(?:room\s+)?cleaning(?:\s+task)?\s+to\s+(.+?)\s*[.!]?$/iu.exec(message.trim());
  const query = match?.[1]?.trim() ?? "";
  return query.length >= 2 && query.length <= 120 ? query : null;
}

export type DepartureServiceVoiceIntent = Readonly<{
  serviceKind: "luggage_pickup" | "minibar_check" | "room_inspection" | "escalation";
  timing: "immediate" | 10 | 15 | 30 | 45 | "custom";
}>;

/** Parses only a departure-service request; it never authorizes or sends it. */
export function departureServiceVoiceIntent(message: string): DepartureServiceVoiceIntent | null {
  const value = message.trim();
  const serviceKind = /\b(?:luggage|bags?|baggage)\b.*\b(?:pick[ -]?up|collect)|\b(?:pick[ -]?up|collect)\b.*\b(?:luggage|bags?|baggage)\b/iu.test(value)
    ? "luggage_pickup"
    : /\bminibar\b/iu.test(value)
      ? "minibar_check"
      : /\b(?:room|damage|missing items?)\b.*\b(?:inspect|check)|\b(?:inspect|check)\b.*\b(?:room|damage|missing items?)\b/iu.test(value)
        ? "room_inspection"
        : /\bescalat(?:e|ion)\b/iu.test(value) ? "escalation" : null;
  if (!serviceKind) return null;
  const timing = /\b(?:immediate(?:ly)?|now)\b/iu.test(value) ? "immediate"
    : /\b(?:in|after)\s+10\s*(?:minutes?|mins?)\b/iu.test(value) ? 10
      : /\b(?:in|after)\s+15\s*(?:minutes?|mins?)\b/iu.test(value) ? 15
        : /\b(?:in|after)\s+30\s*(?:minutes?|mins?)\b/iu.test(value) ? 30
          : /\b(?:in|after)\s+45\s*(?:minutes?|mins?)\b/iu.test(value) ? 45 : "immediate";
  return Object.freeze({ serviceKind, timing });
}

export function departureServiceConfirmationIntent(message: string): "confirm" | "cancel" | null {
  const value = message.trim();
  if (/^(?:yes|yes please|go ahead|confirm|do it|haan|ha|हाँ)\s*[.!]?$/iu.test(value)) return "confirm";
  if (/^(?:no|no thanks|cancel|stop|not now|nahi|नहीं)\s*[.!]?$/iu.test(value)) return "cancel";
  return null;
}

export type HousekeepingTaskActionIntent = "start" | "complete" | "verify";

/**
 * Parses only an explicit human housekeeping declaration. It is deliberately
 * unusable as a generic "ready" or "do it" shortcut because each declaration
 * changes audited room/task truth after a separate confirmation in App.
 */
export function housekeepingTaskActionIntent(message: string): HousekeepingTaskActionIntent | null {
  const value = message.trim();
  if (/^(?:start|begin)\s+(?:the\s+)?(?:room\s+)?(?:cleaning|housekeeping)\s*[.!]?$/iu.test(value)) return "start";
  if (/^(?:mark\s+(?:the\s+)?room\s+clean|(?:the\s+)?cleaning\s+is\s+complete)\s*[.!]?$/iu.test(value)) return "complete";
  if (/^(?:inspect\s+(?:the\s+)?room|mark\s+(?:the\s+)?room\s+inspected)\s*[.!]?$/iu.test(value)) return "verify";
  return null;
}

export type ArrivalCleaningStaffResolution =
  | Readonly<{ kind: "resolved"; partyId: string; displayName: string }>
  | Readonly<{ kind: "ambiguous" }>
  | Readonly<{ kind: "ineligible" }>;

export function resolveArrivalCleaningAttendant(
  query: string,
  profiles: readonly Readonly<{
    partyId: string;
    displayName: string;
    status: string;
    roles: readonly string[];
  }>[],
): ArrivalCleaningStaffResolution {
  const normalized = reservationQueryText(query);
  const exact = profiles.filter((profile) =>
    reservationQueryText(profile.partyId) === normalized ||
    reservationQueryText(profile.displayName) === normalized,
  );
  if (exact.length > 1) return Object.freeze({ kind: "ambiguous" });
  if (exact.length !== 1 || exact[0]!.status !== "active" || !exact[0]!.roles.includes("staff")) {
    return Object.freeze({ kind: "ineligible" });
  }
  return Object.freeze({
    kind: "resolved",
    partyId: exact[0]!.partyId,
    displayName: exact[0]!.displayName,
  });
}

function canonicalSpokenPercentage(value: string | undefined): string | null {
  if (value === undefined || !/^\d{1,3}(?:\.\d{1,2})?$/u.test(value)) return null;
  const [whole = "", fraction = ""] = value.split(".");
  const basisPoints = Number.parseInt(whole, 10) * 100 + Number.parseInt(`${fraction}00`.slice(0, 2), 10);
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 1 || basisPoints > 10_000) return null;
  return `${Math.floor(basisPoints / 100)}.${String(basisPoints % 100).padStart(2, "0")}`;
}

/**
 * Parses only a follow-up for the reservation already visible inside Yellow.
 * Reservation and Party resolution remain server-backed responsibilities in App.
 */
export function reservationGuestAllocationIntent(message: string): ReservationGuestAllocationIntent | null {
  const value = message.trim();
  if (/^(?:yes|yes please|go ahead|confirm|haan|ha|हाँ)\s*[.!]?$/iu.test(value)) return Object.freeze({ kind: "confirm" });
  if (/^(?:no|no thanks|cancel|stop|not now|nahi|नहीं)\s*[.!]?$/iu.test(value)) return Object.freeze({ kind: "cancel" });
  const remove = /^(?:please\s+)?remove\s+(.+?)(?:\s+from\s+(?:this\s+)?reservation)?\s*[.!]?$/iu.exec(value);
  if (remove?.[1]?.trim() && remove[1].trim().length >= 2)
    return Object.freeze({ kind: "remove", query: remove[1].trim() });
  const add = /^(?:please\s+)?add\s+(.+?)\s+as\s+(?:an?\s+)?(accompanying(?:\s+guest)?|sharer)(?:\s+(?:with|at)\s+(\d{1,3}(?:\.\d{1,3})?)\s*(?:%|percent))?(?:\s*[,;]?\s*(?:and\s+)?(?:set\s+)?(?:the\s+)?primary(?:\s+guest)?(?:\s+(?:to|at|with))?\s+(\d{1,3}(?:\.\d{1,3})?)\s*(?:%|percent))?\s*[.!]?$/iu.exec(value);
  if (!add?.[1]?.trim() || add[1].trim().length < 2) return null;
  const role = /^sharer$/iu.test(add[2] ?? "") ? "sharer" : "accompanying";
  const sharePct = canonicalSpokenPercentage(add[3]);
  const primarySharePct = canonicalSpokenPercentage(add[4]);
  if ((add[3] !== undefined && sharePct === null) || (add[4] !== undefined && primarySharePct === null)) return null;
  return Object.freeze({
    kind: "add",
    query: add[1].trim(),
    role,
    sharePct: role === "sharer" ? sharePct : null,
    primarySharePct: role === "sharer" ? primarySharePct : null,
  });
}

function guestProfileIntent(value: string): boolean {
  return /(?:guest\s+profile|guest\s+history|stay\s+history|profile\s+for|अतिथि\s+प्रोफ़ाइल|पाहुण्याचा\s+इतिहास|ಅತಿಥಿ\s+ಪ್ರೊಫೈಲ್|అతిథి\s+ప్రొఫైల్)/iu.test(value);
}

function guestParties<TReservation extends VoiceReservation>(reservations: readonly TReservation[]): readonly GuestProfileVoiceCandidate[] {
  const parties = new Map<string, { partyId: string; displayName: string; confirmations: string[] }>();
  for (const reservation of reservations) {
    const displayName = reservation.primaryGuestDisplayName ?? reservation.primaryPartyName;
    if (!reservation.primaryPartyId || !displayName) continue;
    const existing = parties.get(reservation.primaryPartyId);
    if (existing) existing.confirmations.push(reservation.confirmationNo);
    else parties.set(reservation.primaryPartyId, { partyId: reservation.primaryPartyId, displayName, confirmations: [reservation.confirmationNo] });
  }
  return [...parties.values()].map((party) => Object.freeze({ ...party, confirmations: Object.freeze([...new Set(party.confirmations)].sort()) }));
}

/** Resolves a named profile to one Party, de-duplicating that Party's repeat stays. */
export function guestProfileVoiceAction<TReservation extends VoiceReservation>(
  message: string,
  reservations: readonly TReservation[],
): GuestProfileVoiceAction | null {
  if (!guestProfileIntent(message)) return null;
  const query = normalise(message);
  const parties = guestParties(reservations);
  const confirmationMatch = parties.filter((party) => party.confirmations.some((confirmation) => query.includes(normalise(confirmation))));
  if (confirmationMatch.length === 1) return Object.freeze({ partyId: confirmationMatch[0]!.partyId, displayName: confirmationMatch[0]!.displayName });
  const scored = parties.map((party) => {
    const name = normalise(party.displayName);
    const score = query.includes(name) ? 100 : name.split(/\s+/u).filter((part) => part.length >= 3 && query.includes(part)).length;
    return { party, score };
  });
  const best = Math.max(0, ...scored.map(({ score }) => score));
  const matches = scored.filter(({ score }) => score === best && score > 0).map(({ party }) => party);
  return matches.length === 1 ? Object.freeze({ partyId: matches[0]!.partyId, displayName: matches[0]!.displayName }) : null;
}

export function guestProfileVoiceCandidates<TReservation extends VoiceReservation>(
  message: string,
  reservations: readonly TReservation[],
): readonly GuestProfileVoiceCandidate[] {
  if (!guestProfileIntent(message)) return Object.freeze([]);
  const query = normalise(message);
  const scored = guestParties(reservations).map((party) => {
    const name = normalise(party.displayName);
    const score = query.includes(name) ? 100 : name.split(/\s+/u).filter((part) => part.length >= 3 && query.includes(part)).length;
    return { party, score };
  });
  const best = Math.max(0, ...scored.map(({ score }) => score));
  const matches = scored.filter(({ score }) => score === best && score > 0).map(({ party }) => party);
  return matches.length > 1 ? Object.freeze(matches) : Object.freeze([]);
}

/**
 * Resolves only a uniquely identifiable live reservation.  This deliberately
 * prepares a governed screen; it never performs a check-in or another write.
 */
export function reservationVoiceAction<TReservation extends VoiceReservation>(
  message: string,
  reservations: readonly TReservation[],
): ReservationVoiceAction<TReservation> | null {
  const checkInIntent =
    /(?:prepare\s+(?:a\s+)?check[ -]?in|check[ -]?in\s+(?:for\s+)?|allot|assign|चेक[ -]?इन\s+तैयार\s+करें|चेक[ -]?इन\s+तयार\s+करा|ಚೆಕ್[ -]?ಇನ್\s+ಸಿದ್ಧಪಡಿಸಿ|చెక్[ -]?ఇన్\s+సిద్ధం\s+చేయండి)/iu.test(
      message,
    );
  const checkoutIntent =
    /(?:prepare\s+(?:a\s+)?check[ -]?out|check[ -]?out\s+(?:for\s+)?|चेक[ -]?आउट|ಚೆಕ್[ -]?ಔಟ್|చెక్[ -]?అవుట్)/iu.test(
      message,
    );
  const departureServiceCommand = departureServiceVoiceIntent(message) !== null;
  const cashierIntent = /(?:cashier|cashiers|bill|billing|folio)/iu.test(message);
  const cancelIntent = /(?:cancel(?:lation)?\s+(?:the\s+)?reservation|reservation\s+cancel|बुकिंग\s+रद्द|आरक्षण\s+रद्द|ರಿಸರ್ವೇಶನ್\s+ರದ್ದು|రిజర్వేషన్\s+రద్దు)/iu.test(message);
  const reinstateIntent = /(?:reinstate|restore|reopen)\s+(?:the\s+)?reservation|reservation\s+(?:reinstate|restore)|आरक्षण\s+(?:बहाल|पुनर्स्थापित)|ರಿಸರ್ವೇಶನ್\s+ಮರುಸ್ಥಾಪಿಸಿ|రిజర్వేషన్\s+పునరుద్ధరించండి/iu.test(message);
  const noShowIntent = /(?:mark\b[^\r\n]{0,120}\bno[ -]?show|नो[ -]?शो|ನೋ[ -]?ಶೋ|నో[ -]?షో)/iu.test(message);
  const isReservationCommand =
    /(?:open|expand|pop[ -]?up|show|prepare\s+(?:a\s+)?check[ -]?in|check[ -]?in\s+(?:for\s+)?|allot|assign|bill|billing|folio|खोलें|उघडा|ತೆರೆಯಿರಿ|ತೆరవండి|चेक[ -]?इन\s+तैयार\s+करें|चेक[ -]?इन\s+तयार\s+करा|ಚೆಕ್[ -]?ಇನ್\s+ಸಿದ್ಧಪಡಿಸಿ|చెక్[ -]?ఇನ್\s+ಸಿದ್ಧం\s+చేయండి)/iu.test(
      message,
    ) ||
    checkInIntent ||
    checkoutIntent ||
    cashierIntent ||
    cancelIntent ||
    reinstateIntent ||
    noShowIntent;
  const isDepartureCommand = departureServiceCommand;
  const isAnyReservationCommand = isReservationCommand || isDepartureCommand;
  if (!isAnyReservationCommand) return null;
  const query = normalise(message);
  const eligibleReservations = (checkoutIntent || isDepartureCommand)
    ? reservations.filter((reservation) => {
        const state = reservation.operationalState ?? reservation.status;
        return state === "due_out" || state === "in_house";
      })
    : cashierIntent
      ? reservations.filter((reservation) => {
          if (reservation.status !== undefined) {
            return reservation.status === "in_house" || reservation.status === "due_out";
          }
          return reservation.operationalState === "in_house" || reservation.operationalState === "due_out" ||
            reservation.operationalState === "checked_in_today" || reservation.operationalState === "stayover";
        })
    : checkInIntent
      ? reservations.filter((reservation) => {
          const state = reservation.operationalState ?? reservation.status;
          return state === "due_in";
        })
      : reservations;
  const resolveFrom = (
    candidates: readonly TReservation[],
    confirmationCandidates: readonly TReservation[] = candidates,
  ): TReservation | null => {
    const confirmationMatches = confirmationCandidates.filter((reservation) =>
      query.includes(normalise(reservation.confirmationNo)),
    );
    const longestConfirmation = Math.max(0, ...confirmationMatches.map((reservation) => normalise(reservation.confirmationNo).length));
    const exactConfirmationMatches = confirmationMatches.filter(
      (reservation) => normalise(reservation.confirmationNo).length === longestConfirmation,
    );
    let selectedReservation: TReservation | null = null;
    if (exactConfirmationMatches.length) {
      if (exactConfirmationMatches.length !== 1 || !exactConfirmationMatches[0]) return null;
      const resolvedConfirmation = normalise(exactConfirmationMatches[0].confirmationNo);
      if (confirmationMatches.some((reservation) => !resolvedConfirmation.includes(normalise(reservation.confirmationNo)))) return null;
      if (!candidates.includes(exactConfirmationMatches[0])) return null;
      selectedReservation = exactConfirmationMatches[0];
    }
    const scored = candidates.map((reservation) => {
      const name = normalise(
        reservation.primaryGuestDisplayName ?? reservation.primaryPartyName ?? "",
      );
      if (!name) return { reservation, score: 0 };
      if (query.includes(name)) return { reservation, score: 100 };
      const score = name
        .split(/\s+/u)
        .filter((part) => part.length >= 3 && query.includes(part)).length;
      return { reservation, score };
    });
    if (!selectedReservation) {
      const bestScore = Math.max(0, ...scored.map(({ score }) => score));
      const matches = scored
        .filter(({ score }) => score === bestScore && score > 0)
        .map(({ reservation }) => reservation);
      if (matches.length !== 1 || !matches[0]) return null;
      selectedReservation = matches[0];
    }
    return selectedReservation;
  };

  let selectedReservation = checkoutIntent
    ? resolveFrom(eligibleReservations)
    : resolveFrom(eligibleReservations, reservations);
  let completed = false;
  const activeIdentityMatches = checkoutIntent && eligibleReservations.some((reservation) => {
    if (query.includes(normalise(reservation.confirmationNo))) return true;
    const name = normalise(reservation.primaryGuestDisplayName ?? reservation.primaryPartyName ?? "");
    return Boolean(name) && (query.includes(name) || name.split(/\s+/u).some((part) => part.length >= 3 && query.includes(part)));
  });
  if (!selectedReservation && checkoutIntent && !activeIdentityMatches) {
    const completedReservation = resolveFrom(
      reservations.filter((reservation) => reservation.status === "checked_out"),
    );
    if (completedReservation) {
      selectedReservation = completedReservation;
      completed = true;
    }
  }
  if (!selectedReservation) return null;
  if (cancelIntent || reinstateIntent || noShowIntent)
    return {
      reservation: selectedReservation,
      workbench: "lifecycle",
      lifecycleAction: cancelIntent ? "cancel" : reinstateIntent ? "reinstate" : "no_show",
    };
  if (cashierIntent || /(?:bill|billing|folio)/iu.test(message))
    return { reservation: selectedReservation, workbench: "cashier" };
  if (departureServiceCommand)
    return { reservation: selectedReservation, workbench: "check-out" };
  if (checkoutIntent)
    return completed
      ? {
          reservation: selectedReservation,
          workbench: "check-out",
          completed: true,
          ...(selectedReservation.sellableUnitLabel ? { roomLabel: selectedReservation.sellableUnitLabel } : {}),
        }
      : { reservation: selectedReservation, workbench: "check-out" };
  const workbench = checkInIntent ? "check-in" : null;
  return { reservation: selectedReservation, workbench };
}
