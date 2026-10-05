const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function namespaceBytes(namespace: string): Uint8Array {
  if (!CANONICAL_UUID.test(namespace)) {
    throw new TypeError(`Malformed namespace UUID: ${namespace}`);
  }

  return Uint8Array.from(namespace.replaceAll("-", "").match(/../g) ?? [], (value) =>
    Number.parseInt(value, 16),
  );
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function uuidV5(namespace: string, name: string): Promise<string> {
  const namespaceValue = namespaceBytes(namespace);
  const nameValue = new TextEncoder().encode(name);
  const input = new Uint8Array(namespaceValue.length + nameValue.length);
  input.set(namespaceValue);
  input.set(nameValue, namespaceValue.length);

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", input));
  const uuid = digest.slice(0, 16);
  uuid[6] = (uuid[6]! & 0x0f) | 0x50;
  uuid[8] = (uuid[8]! & 0x3f) | 0x80;
  return formatUuid(uuid);
}
