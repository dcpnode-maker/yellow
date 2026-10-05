export interface LocalAuthRecord {
  readonly provider: "local";
  readonly hash: string;
}

export async function hashLocalPassword(password: string): Promise<LocalAuthRecord> {
  if (password.length === 0) throw new Error("Password must not be empty");
  const hash = await Bun.password.hash(password, { algorithm: "argon2id" });
  if (!hash.startsWith("$argon2id$")) throw new Error("Bun did not produce an argon2id hash");
  return { provider: "local", hash };
}

export function isLocalAuthRecord(value: unknown): value is LocalAuthRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 2 &&
    record.provider === "local" &&
    typeof record.hash === "string" &&
    record.hash.startsWith("$argon2id$");
}

export async function verifyLocalPassword(password: string, auth: unknown): Promise<boolean> {
  if (password.length === 0 || !isLocalAuthRecord(auth)) return false;
  try {
    return await Bun.password.verify(password, auth.hash, "argon2id");
  } catch {
    return false;
  }
}
