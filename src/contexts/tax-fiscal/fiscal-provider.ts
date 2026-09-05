/** Provider-neutral fiscal transport contract. Implementations verify and normalize
 * remote responses before returning them; these types confer no fiscal authority. */
export type FiscalSubmissionMode = "clearance" | "reporting" | "peppol" | "exchange";

export interface FiscalProviderBinding {
  readonly tenantId: string;
  readonly providerKey: string;
  readonly attemptId: string;
  readonly documentId: string;
  readonly payloadSha256: string;
}

export interface FiscalProviderSubmission extends FiscalProviderBinding {
  readonly payload: Uint8Array;
}

export interface FiscalProviderLookup extends FiscalProviderBinding {}

export type FiscalProviderResolution = Readonly<
  | { verified: true; outcome: "cleared" | "accepted" | "rejected";
      authorityRef: string; responseSha256: string }
  | { verified: true; outcome: "pending" | "timeout" | "duplicate" | "known_not_sent" }
>;

/** Lane A models one transition only. A future durable caller must enforce bounded
 * retries and unique historical attempts; a real adapter must authenticate and
 * verify provider responses before returning a `verified: true` resolution. */
export interface FiscalDocumentProvider {
  submit(input: FiscalProviderSubmission): Promise<FiscalProviderResolution>;
  lookup(input: FiscalProviderLookup): Promise<FiscalProviderResolution>;
}
