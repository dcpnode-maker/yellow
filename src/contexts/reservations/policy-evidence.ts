import {
  parseCancellationPolicyContent,
  type CancellationPolicyContent,
} from "../rates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;

export interface FrozenCancellationPolicyEvidence {
  readonly policyId: string;
  readonly content: CancellationPolicyContent;
  readonly contentHash: string;
}

export interface StoredCancellationPolicyEvidence {
  readonly policy_id: string;
  readonly content: CancellationPolicyContent;
  readonly content_hash: string;
}

export class ReservationPolicyEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationPolicyEvidenceError";
  }
}

function requireRecord(value: unknown, subject: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReservationPolicyEvidenceError(`${subject} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
  subject: string,
): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new ReservationPolicyEvidenceError(`${subject} contains unsupported or missing fields`);
  }
}

function freezeCancellationContent(content: CancellationPolicyContent): CancellationPolicyContent {
  const rules = content.rules.map((rule) => Object.freeze({
    before_hours: rule.before_hours,
    penalty: Object.freeze({ ...rule.penalty }),
  }));
  return Object.freeze({ kind: "cancellation" as const, rules: Object.freeze(rules) });
}

function contentHash(content: CancellationPolicyContent): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(content)).digest("hex");
}

export function freezeCancellationPolicyEvidence(
  policyId: string,
  rawContent: Readonly<Record<string, unknown>>,
): FrozenCancellationPolicyEvidence {
  if (!UUID.test(policyId)) throw new ReservationPolicyEvidenceError("cancellation policy id must be a UUID");
  let content: CancellationPolicyContent;
  try {
    content = freezeCancellationContent(parseCancellationPolicyContent(rawContent));
  } catch (error) {
    if (error instanceof ReservationPolicyEvidenceError) throw error;
    throw new ReservationPolicyEvidenceError(
      error instanceof Error ? error.message : "cancellation policy content is invalid",
    );
  }
  return Object.freeze({ policyId, content, contentHash: contentHash(content) });
}

export function toStoredCancellationPolicyEvidence(
  evidence: FrozenCancellationPolicyEvidence,
): StoredCancellationPolicyEvidence {
  return Object.freeze({
    policy_id: evidence.policyId,
    content: evidence.content,
    content_hash: evidence.contentHash,
  });
}

export function parseStoredCancellationPolicyEvidence(
  value: unknown,
): FrozenCancellationPolicyEvidence {
  const source = requireRecord(value, "stored cancellation policy evidence");
  requireExactKeys(source, ["policy_id", "content", "content_hash"], "stored cancellation policy evidence");
  if (typeof source.policy_id !== "string" || !UUID.test(source.policy_id)) {
    throw new ReservationPolicyEvidenceError("stored cancellation policy id must be a UUID");
  }
  if (typeof source.content_hash !== "string" || !SHA256.test(source.content_hash)) {
    throw new ReservationPolicyEvidenceError("stored cancellation policy hash must be lowercase SHA-256");
  }
  const content = requireRecord(source.content, "stored cancellation policy content");
  const evidence = freezeCancellationPolicyEvidence(source.policy_id, content);
  if (evidence.contentHash !== source.content_hash) {
    throw new ReservationPolicyEvidenceError("stored cancellation policy hash does not match its content");
  }
  return evidence;
}
