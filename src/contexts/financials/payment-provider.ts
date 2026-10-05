export type PaymentProviderPhase = "auth" | "incremental_auth" | "capture" | "void" | "refund";
export type PaymentProviderOutcomeKind = "approved" | "declined" | "indeterminate";

export interface PaymentProviderRequest {
  readonly commandId: string;
  readonly phase: PaymentProviderPhase;
  readonly provider: string;
  readonly method: "card" | "upi";
  readonly token: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly priorProviderReference?: string;
}

export interface PaymentProviderOutcome {
  readonly outcome: PaymentProviderOutcomeKind;
  readonly providerReference: string;
  readonly resultCode: string;
}

export interface PaymentProvider {
  execute(request: PaymentProviderRequest): Promise<PaymentProviderOutcome>;
}

export interface LocalPaymentProviderOptions {
  readonly decide?: (request: Omit<PaymentProviderRequest, "token">) => PaymentProviderOutcomeKind;
}

const ID = /^[a-z0-9][a-z0-9._:-]{7,199}$/;
const PROVIDER = /^[a-z][a-z0-9._-]{0,63}$/;
const MONEY = /^[1-9][0-9]*$/;
const CURRENCY = /^[A-Z]{3}$/;
const TOKEN = /^[!-~]{16,512}$/;

export class LocalPaymentProvider implements PaymentProvider {
  readonly #decide: NonNullable<LocalPaymentProviderOptions["decide"]>;

  constructor(options: LocalPaymentProviderOptions = {}) {
    this.#decide = options.decide ?? (() => "approved");
  }

  async execute(request: PaymentProviderRequest): Promise<PaymentProviderOutcome> {
    if (!ID.test(request.commandId) || !PROVIDER.test(request.provider) ||
        !MONEY.test(request.amountMinor) || !CURRENCY.test(request.currency) ||
        !TOKEN.test(request.token) || /^[0-9]{12,19}$/.test(request.token)) {
      throw new Error("Payment provider request is invalid");
    }
    const safe = Object.freeze({
      commandId: request.commandId,
      phase: request.phase,
      provider: request.provider,
      method: request.method,
      amountMinor: request.amountMinor,
      currency: request.currency,
      ...(request.priorProviderReference === undefined ? {} : {
        priorProviderReference: request.priorProviderReference,
      }),
    });
    const outcome = this.#decide(safe);
    const digest = new Bun.CryptoHasher("sha256")
      .update(JSON.stringify(safe)).digest("hex").slice(0, 32);
    return Object.freeze({
      outcome,
      providerReference: `local-${digest}`,
      resultCode: outcome === "approved" ? "approved" : outcome,
    });
  }
}
