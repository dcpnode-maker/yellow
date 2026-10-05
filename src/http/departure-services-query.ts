const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface DepartureServicesQuery {
  readonly targetRoleId: string | null;
}

/**
 * Parses the optional property queue filter. Reservation history deliberately
 * remains an exact, unfiltered view; this parser makes no role lookup or grant
 * decision and therefore grants no authority.
 */
export function parseDepartureServicesQuery(request: Request, reservationId: string | null): DepartureServicesQuery | null {
  const query = new URL(request.url).searchParams;
  const keys = [...query.keys()];
  if (reservationId !== null && keys.length > 0) return null;
  if (keys.some((key) => key !== "target_role_id") || query.getAll("target_role_id").length > 1) return null;

  const targetRoleId = query.get("target_role_id");
  if (targetRoleId === null) return Object.freeze({ targetRoleId: null });
  if (reservationId !== null || !UUID.test(targetRoleId)) return null;
  return Object.freeze({ targetRoleId });
}
