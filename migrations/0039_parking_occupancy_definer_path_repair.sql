-- Order 245: forward-only SECURITY DEFINER search-path repair for the two
-- occupancy overloads introduced by migration0037. Function bodies, signatures,
-- owners and ACLs remain unchanged.

ALTER FUNCTION public.record_occupancy(
  uuid, uuid, tstzrange, uuid, text, boolean, uuid
)
  SET search_path TO pg_catalog, public, pg_temp;

ALTER FUNCTION public.release_occupancy(uuid, uuid)
  SET search_path TO pg_catalog, public, pg_temp;
