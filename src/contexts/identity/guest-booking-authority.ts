import type { Tx } from "../../kernel";

export const GUEST_BOOKING_ISSUER_SCOPES = Object.freeze([
  "inventory.availability:read", "rates.configuration:read", "inventory.holds:write",
  "reservations.booking:write", "crm.parties:read",
] as const);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class GuestBookingAuthorityError extends Error {
  constructor() { super("Booking access is unavailable"); this.name = "GuestBookingAuthorityError"; }
}

/** Live issuer authority, locked through transaction settlement, never a guest scope. */
export class GuestBookingAuthority {
  async authorize(tx: Tx, input: {
    readonly tenantId: string; readonly propertyNode: string; readonly actorId: string; readonly primaryPartyId: string; readonly ratePlanId?: string;
  }): Promise<Date> {
    if (![input.tenantId, input.propertyNode, input.actorId, input.primaryPartyId, ...(input.ratePlanId ? [input.ratePlanId] : [])].every((id) => UUID.test(id))) {
      throw new GuestBookingAuthorityError();
    }
    const { tenantId, propertyNode, actorId, primaryPartyId, ratePlanId } = input;
    let rows: { now: Date }[];
    try {
      rows = await tx<{ now: Date }[]>`SELECT public.assert_guest_booking_authority(
        ${tenantId}::uuid,${propertyNode}::uuid,${actorId}::uuid,${primaryPartyId}::uuid,${ratePlanId ?? null}::uuid) AS now`;
    } catch (error) {
      if (typeof error === "object" && error !== null && "errno" in error && error.errno === "42501") {
        throw new GuestBookingAuthorityError();
      }
      throw error;
    }
    const now = rows[0]?.now;
    if (rows.length !== 1 || !(now instanceof Date) || !Number.isFinite(now.getTime())) throw new GuestBookingAuthorityError();
    return new Date(now);
  }
}
