-- Order 232: expose only bounded tenant/property discovery for reservations
-- whose database-derived property-local calendar date is their coherent latest
-- arrival date. The runtime worker receives no reservation or segment details.

CREATE FUNCTION public.runtime_due_arrival_scopes(p_limit integer)
RETURNS TABLE(tenant_id uuid, property_node uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_due_arrival_scopes$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'limit must be between 1 and 1000' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT reservation.tenant_id, reservation.property_node
    FROM public.reservation AS reservation
    JOIN public.tenant AS tenant
      ON tenant.id = reservation.tenant_id
     AND tenant.status = 'active'
    JOIN public.org_node AS property
      ON property.tenant_id = reservation.tenant_id
     AND property.id = reservation.property_node
     AND property.kind = 'property'
    JOIN pg_catalog.pg_timezone_names AS timezone
      ON timezone.name = property.timezone
    JOIN LATERAL (
      SELECT segment.status, segment.period
        FROM public.reservation_segment AS segment
       WHERE segment.tenant_id = reservation.tenant_id
         AND segment.reservation_id = reservation.id
       ORDER BY segment.seq DESC, segment.id DESC
       LIMIT 1
    ) AS latest ON latest.status = 'booked'
   WHERE reservation.status = 'reserved'
     AND (pg_catalog.lower(latest.period) AT TIME ZONE timezone.name)::date =
         (pg_catalog.transaction_timestamp() AT TIME ZONE timezone.name)::date
   GROUP BY reservation.tenant_id, reservation.property_node
   ORDER BY reservation.tenant_id, reservation.property_node
   LIMIT p_limit;
END
$runtime_due_arrival_scopes$;

ALTER FUNCTION public.runtime_due_arrival_scopes(integer) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.runtime_due_arrival_scopes(integer)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.runtime_due_arrival_scopes(integer) TO yellow_runtime;
