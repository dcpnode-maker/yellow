import type { PartyProfile } from "../yellow-api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const E164 = /^\+[1-9][0-9]{6,14}$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const ROLES = new Set(["guest", "company", "agent", "source", "vendor", "owner", "staff", "contact"]);
const CONTACTS = new Set(["email", "phone", "whatsapp"]);

export type GuestProfileDraft = Readonly<{
  displayName: string;
  legalName?: string;
  email?: string;
  phone?: string;
}>;

export type GuestPartyPayload = Readonly<{
  kind: "person";
  displayName: string;
  legalName?: string;
  roles: readonly ["guest"];
  contacts: readonly Readonly<{ kind: "email" | "phone"; value: string; isPrimary: true }>[];
  acknowledgedDuplicatePartyIds: readonly string[];
}>;

export type DuplicateCandidate = Readonly<{
  partyId: string;
  displayNameHint: string;
  reasons: readonly string[];
  contacts: readonly Readonly<{ kind: string; hint: string; isPrimary: boolean }>[];
}>;

export type GuestProfileState = Readonly<{
  status: "idle" | "posting" | "duplicates" | "uncertain" | "rejected" | "ready";
  busy: boolean;
  candidates: readonly DuplicateCandidate[];
  profile?: PartyProfile;
  created?: boolean;
  message?: string;
  lookupBusy?: boolean;
}>;

export type GuestProfileFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type GuestProfileController = Readonly<{
  getState(): GuestProfileState;
  subscribe(listener: () => void): () => void;
  submit(draft: GuestProfileDraft): Promise<GuestProfileState>;
  acknowledgeDistinct(): Promise<GuestProfileState>;
  reconcile(): Promise<GuestProfileState>;
  useCandidate(partyId: string): Promise<GuestProfileState>;
  reset(): void;
  setProperty(propertyId: string): void;
  activate(): void;
  dispose(): void;
}>;

type Attempt = Readonly<{
  payload: GuestPartyPayload;
  idempotencyKey: string;
  uncertain?: boolean;
  knownPartyId?: string;
}>;

type Capture = Readonly<{ propertyId: string; generation: number }>;

const idle = (): GuestProfileState => Object.freeze({ status: "idle", busy: false, candidates: Object.freeze([]) });
const messages = Object.freeze({
  invalid: "Enter a guest name, valid email, and E.164 phone number.",
  forbidden: "You do not have permission to create or select guest profiles for this property.",
  invalidRequest: "Yellow could not validate this guest profile. Review the fields and try again.",
  conflict: "The guest profile request conflicts with current server state. The original request is retained.",
  uncertain: "The save outcome is not confirmed. Reconcile the same request to verify the server profile.",
  duplicate: "Review every masked possible match. No new profile was created.",
  lookup: "Yellow could not confirm that profile. Search again or review another candidate.",
  mismatch: "Yellow could not verify the saved guest profile. Reconcile the same request.",
});

export function normalizeGuestName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function makeGuestPartyPayload(draft: GuestProfileDraft): GuestPartyPayload | null {
  const displayName = normalizeGuestName(draft.displayName);
  const legalName = draft.legalName === undefined ? "" : normalizeGuestName(draft.legalName);
  const email = draft.email?.normalize("NFKC").trim().toLowerCase() ?? "";
  const phone = draft.phone?.trim() ?? "";
  if (!displayName || displayName.length > 200 || /[\u0000-\u001f\u007f]/u.test(displayName)) return null;
  if (legalName.length > 300 || /[\u0000-\u001f\u007f]/u.test(legalName)) return null;
  if (email && (email.length > 254 || !EMAIL.test(email))) return null;
  if (phone && !E164.test(phone)) return null;
  const contacts: GuestPartyPayload["contacts"] = Object.freeze([
    ...(email ? [Object.freeze({ kind: "email" as const, value: email, isPrimary: true as const })] : []),
    ...(phone ? [Object.freeze({ kind: "phone" as const, value: phone, isPrimary: true as const })] : []),
  ]);
  return Object.freeze({
    kind: "person",
    displayName,
    ...(legalName ? { legalName } : {}),
    roles: Object.freeze(["guest"] as const),
    contacts,
    acknowledgedDuplicatePartyIds: Object.freeze([]),
  });
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMaskedHint(kind: string, hint: unknown, payload?: GuestPartyPayload): hint is string {
  if (typeof hint !== "string" || hint.length > 254 || /[\u0000-\u001f\u007f]/u.test(hint)) return false;
  if (kind === "email") {
    if (!/^[^\s@•]{1}•••@[^\s@]+$/u.test(hint)) return false;
  } else if (!/^•{4}[0-9]{4}$/u.test(hint)) return false;
  return !payload?.contacts.some((contact) => contact.value.toLowerCase() === hint.toLowerCase());
}

function canonicalContactHint(kind: string, value: string): string {
  if (kind === "email") return `${Array.from(value)[0] ?? "•"}•••@${value.slice(value.lastIndexOf("@") + 1)}`;
  return `••••${value.slice(-4)}`;
}

export function validatePartyProfile(value: unknown, payload?: GuestPartyPayload): PartyProfile | null {
  if (!isRecord(value) || !exactKeys(value, ["partyId", "kind", "displayName", "legalName", "status", "roles", "contacts"])) return null;
  if (typeof value.partyId !== "string" || !UUID.test(value.partyId) ||
      (value.kind !== "person" && value.kind !== "org") || typeof value.displayName !== "string" ||
      typeof value.status !== "string" || value.status !== "active" ||
      (value.legalName !== null && typeof value.legalName !== "string") ||
      !Array.isArray(value.roles) || value.roles.some((role) => typeof role !== "string" || !ROLES.has(role)) ||
      !Array.isArray(value.contacts) || value.contacts.length > 6) return null;
  const displayName = normalizeGuestName(value.displayName);
  if (!displayName || displayName !== value.displayName || displayName.length > 200) return null;
  if (value.legalName !== null && (normalizeGuestName(value.legalName) !== value.legalName || value.legalName.length > 300)) return null;
  for (const raw of value.contacts) {
    if (!isRecord(raw) || !exactKeys(raw, ["kind", "hint", "isPrimary"]) ||
        typeof raw.kind !== "string" || !CONTACTS.has(raw.kind) ||
        !isMaskedHint(raw.kind, raw.hint, payload) || typeof raw.isPrimary !== "boolean") return null;
    if (payload) {
      const source = payload.contacts.find((contact) => contact.kind === raw.kind);
      if (!source || raw.hint !== canonicalContactHint(raw.kind, source.value) || raw.isPrimary !== source.isPrimary) return null;
    }
  }
  return value as PartyProfile;
}

export function validateDuplicateCandidates(value: unknown, payload: GuestPartyPayload): readonly DuplicateCandidate[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const candidates: DuplicateCandidate[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || !exactKeys(raw, ["partyId", "displayNameHint", "reasons", "contacts"]) ||
        typeof raw.partyId !== "string" || !UUID.test(raw.partyId) ||
        typeof raw.displayNameHint !== "string" || !raw.displayNameHint.endsWith("…") ||
        Array.from(raw.displayNameHint).length > 3 || !Array.isArray(raw.reasons) || raw.reasons.length < 1 ||
        raw.reasons.some((reason) => !["display_name", "email", "phone", "whatsapp"].includes(String(reason))) ||
        !Array.isArray(raw.contacts) || raw.contacts.length > 6) return null;
    const contacts: Array<{ kind: string; hint: string; isPrimary: boolean }> = [];
    for (const contact of raw.contacts) {
      if (!isRecord(contact) || !exactKeys(contact, ["kind", "hint", "isPrimary"]) ||
          typeof contact.kind !== "string" || !CONTACTS.has(contact.kind) ||
          !isMaskedHint(contact.kind, contact.hint, payload) || typeof contact.isPrimary !== "boolean") return null;
      contacts.push(Object.freeze({ kind: contact.kind, hint: contact.hint as string, isPrimary: contact.isPrimary }));
    }
    candidates.push(Object.freeze({
      partyId: raw.partyId,
      displayNameHint: raw.displayNameHint,
      reasons: Object.freeze([...raw.reasons] as string[]),
      contacts: Object.freeze(contacts),
    }));
  }
    const ids = candidates.map(({ partyId }) => partyId);
  if (new Set(ids).size !== ids.length || ids.some((id, index) => index > 0 && ids[index - 1]! >= id)) return null;
  return Object.freeze(candidates);
}

function matchesGuestDraft(profile: PartyProfile, payload: GuestPartyPayload): boolean {
  return profile.kind === "person" && profile.status === "active" && profile.roles.includes("guest") &&
    profile.displayName === payload.displayName && profile.legalName === (payload.legalName ?? null) &&
    profile.contacts.length === payload.contacts.length &&
    payload.contacts.every((contact) => profile.contacts.some((saved) => saved.kind === contact.kind));
}

export function createGuestProfileController(options: Readonly<{
  propertyId: string;
  getToken: () => Promise<string>;
  fetcher?: GuestProfileFetch;
  keyFactory?: () => string;
}>): GuestProfileController {
  const fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  const keyFactory = options.keyFactory ?? (() => crypto.randomUUID());
  let propertyId = options.propertyId;
  let generation = 0;
  let active = true;
  let attempt: Attempt | null = null;
  let state: GuestProfileState = idle();
  const listeners = new Set<() => void>();
  const getState = () => state;
  const emit = (next: GuestProfileState) => {
    state = Object.freeze(next);
    for (const listener of listeners) listener();
  };
  const capture = (): Capture => Object.freeze({ propertyId, generation });
  const isCurrent = (value: Capture) => active && value.propertyId === propertyId && value.generation === generation;
  const finish = (value: Capture, next: GuestProfileState) => {
    if (isCurrent(value)) emit(next);
    return state;
  };

  const token = async (): Promise<string | null> => {
    try {
      const value = await options.getToken();
      return typeof value === "string" && value.trim() ? value : null;
    } catch {
      return null;
    }
  };

  const lookup = async (partyId: string, value: Capture, profilePayload?: GuestPartyPayload): Promise<PartyProfile | null> => {
    const bearer = await token();
    if (!bearer || !isCurrent(value)) return null;
    let response: Response;
    try {
      response = await fetcher(`/api/v1/properties/${encodeURIComponent(value.propertyId)}/parties:search`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ query: partyId, limit: 50 }),
        cache: "no-store",
      });
    } catch {
      return null;
    }
    if (!isCurrent(value) || !response.ok) return null;
    let body: unknown;
    try { body = await response.json(); } catch { return null; }
    if (!isCurrent(value) || !isRecord(body) || !exactKeys(body, ["profiles"]) || !Array.isArray(body.profiles)) return null;
    const profiles = body.profiles.map((item) => validatePartyProfile(item, profilePayload));
    const match = profiles.find((profile) => profile?.partyId === partyId) ?? null;
    if (!match || profiles.filter((profile) => profile?.partyId === partyId).length !== 1) return null;
    return profilePayload && !matchesGuestDraft(match, profilePayload) ? null : match;
  };

  const execute = async (): Promise<GuestProfileState> => {
    const currentAttempt = attempt;
    if (!currentAttempt || state.status === "posting" || !active) return state;
    const value = capture();
    emit({ status: "posting", busy: true, candidates: state.candidates });
    const uncertain = (message: string = messages.uncertain, knownPartyId = currentAttempt.knownPartyId) => {
      attempt = Object.freeze({ ...currentAttempt, uncertain: true, ...(knownPartyId ? { knownPartyId } : {}) });
      return finish(value, { status: "uncertain", busy: true, candidates: [], message });
    };
    const bearer = await token();
    if (!isCurrent(value)) return state;
    if (!bearer) {
      if (currentAttempt.uncertain) return finish(value, { status: "uncertain", busy: true, candidates: [], message: messages.uncertain });
      attempt = null;
      return finish(value, { status: "rejected", busy: false, candidates: [], message: messages.forbidden });
    }

    if (currentAttempt.knownPartyId) {
      const readback = await lookup(currentAttempt.knownPartyId, value, currentAttempt.payload);
      if (!isCurrent(value)) return state;
      if (readback && matchesGuestDraft(readback, currentAttempt.payload)) {
        attempt = null;
        return finish(value, { status: "ready", busy: false, candidates: [], profile: readback, created: true });
      }
    }

    let response: Response;
    try {
      response = await fetcher(`/api/v1/properties/${encodeURIComponent(value.propertyId)}/parties`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${bearer}`, "idempotency-key": currentAttempt.idempotencyKey },
        body: JSON.stringify(currentAttempt.payload),
      });
    } catch {
      return uncertain();
    }
    if (!isCurrent(value)) return state;
    if (response.status === 409) {
      let problem: unknown;
      try { problem = await response.json(); } catch { problem = null; }
      if (!isCurrent(value)) return state;
      if (isRecord(problem) && problem.type === "profiles/duplicate_review_required") {
        const candidates = validateDuplicateCandidates(problem.candidates, currentAttempt.payload);
        if (candidates) return finish(value, { status: "duplicates", busy: false, candidates, message: messages.duplicate });
      }
      if (currentAttempt.uncertain) return finish(value, { status: "uncertain", busy: true, candidates: [], message: messages.uncertain });
      return finish(value, { status: "rejected", busy: false, candidates: [], message: messages.conflict });
    }
    if (response.status === 403) {
      if (currentAttempt.uncertain) return finish(value, { status: "uncertain", busy: true, candidates: [], message: messages.uncertain });
      attempt = null;
      return finish(value, { status: "rejected", busy: false, candidates: [], message: messages.forbidden });
    }
    if (response.status === 400) {
      if (currentAttempt.uncertain) return finish(value, { status: "uncertain", busy: true, candidates: [], message: messages.uncertain });
      attempt = null;
      return finish(value, { status: "rejected", busy: false, candidates: [], message: messages.invalidRequest });
    }
    if (response.status >= 500 || (response.status >= 200 && response.status < 300 && response.status !== 201)) return uncertain();
    if (response.status !== 201) {
      if (currentAttempt.uncertain) return finish(value, { status: "uncertain", busy: true, candidates: [], message: messages.uncertain });
      attempt = null;
      return finish(value, { status: "rejected", busy: false, candidates: [], message: messages.conflict });
    }
    let receiptBody: unknown;
    try { receiptBody = await response.json(); } catch { receiptBody = null; }
    if (!isCurrent(value)) return state;
    const receipt = isRecord(receiptBody) && exactKeys(receiptBody, ["party"]) ? validatePartyProfile(receiptBody.party, currentAttempt.payload) : null;
    if (!receipt || !matchesGuestDraft(receipt, currentAttempt.payload)) {
      return uncertain(messages.mismatch);
    }
    attempt = Object.freeze({ ...currentAttempt, uncertain: true, knownPartyId: receipt.partyId });
    const profile = await lookup(receipt.partyId, value, currentAttempt.payload);
    if (!isCurrent(value)) return state;
    if (!profile || !matchesGuestDraft(profile, currentAttempt.payload)) {
      return finish(value, { status: "uncertain", busy: true, candidates: [], message: messages.mismatch });
    }
    attempt = null;
    return finish(value, { status: "ready", busy: false, candidates: [], profile, created: true });
  };

  return Object.freeze({
    getState,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    async submit(draft: GuestProfileDraft) {
      if (state.busy || state.status === "uncertain") return state;
      const payload = makeGuestPartyPayload(draft);
      if (!payload) return (emit({ status: "rejected", busy: false, candidates: [], message: messages.invalid }), state);
      attempt = Object.freeze({ payload, idempotencyKey: keyFactory() });
      return execute();
    },
    async acknowledgeDistinct() {
      if (state.status !== "duplicates" || !attempt || state.busy) return state;
      const ids = Object.freeze(state.candidates.map(({ partyId }) => partyId));
      attempt = Object.freeze({
        ...attempt,
        payload: Object.freeze({ ...attempt.payload, acknowledgedDuplicatePartyIds: ids }),
      });
      return execute();
    },
    async reconcile() {
      if (state.status !== "uncertain" || !attempt) return state;
      return execute();
    },
    async useCandidate(partyId: string) {
      if (state.status !== "duplicates" || state.busy || !state.candidates.some((candidate) => candidate.partyId === partyId)) return state;
      const value = capture();
      emit({ ...state, busy: true, lookupBusy: true, message: undefined });
      const profile = await lookup(partyId, value);
      if (!isCurrent(value)) return state;
      if (!profile) return finish(value, { ...state, busy: false, lookupBusy: false, message: messages.lookup });
      attempt = null;
      return finish(value, { status: "ready", busy: false, candidates: [], profile, created: false });
    },
    reset() {
      if (state.status === "posting" || state.status === "uncertain" || state.lookupBusy) return;
      generation += 1;
      attempt = null;
      emit(idle());
    },
    setProperty(nextPropertyId: string) {
      if (nextPropertyId === propertyId) return;
      propertyId = nextPropertyId;
      generation += 1;
      attempt = null;
      emit(idle());
    },
    activate() {
      active = true;
    },
    dispose() {
      active = false;
      generation += 1;
      attempt = null;
      state = idle();
    },
  });
}
