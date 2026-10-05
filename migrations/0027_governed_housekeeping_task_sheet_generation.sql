-- Order 202: one exact-tenant capability owns both the read-only preview and the
-- atomic daily/on-departure housekeeping sheet generation command. The mode is
-- selected by trusted server code; cadence, rooms and task truth remain server-owned.

CREATE UNIQUE INDEX task_sheet_property_date_unique
  ON public.task_sheet (tenant_id, property_node, sheet_date);

CREATE UNIQUE INDEX task_housekeeping_sheet_space_unique
  ON public.task (tenant_id, sheet_id, subject_id)
  WHERE kind = 'housekeeping' AND subject_type = 'space' AND sheet_id IS NOT NULL;

CREATE FUNCTION public.govern_housekeeping_task_sheet(
  p_tenant uuid,
  p_property uuid,
  p_sheet_date date,
  p_attendant uuid,
  p_actor uuid,
  p_mode text,
  p_limit integer
) RETURNS TABLE (
  sheet_id uuid,
  sheet_date date,
  attendant_party uuid,
  created boolean,
  rooms jsonb
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_timezone text;
  v_room_count integer;
  v_bad_profile_count integer;
  v_cadence_count integer;
  v_unsupported_count integer;
  v_candidates jsonb;
  v_sheet_id uuid;
  v_existing_attendant uuid;
  v_created boolean := false;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'housekeeping sheet requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'housekeeping sheet tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'housekeeping sheet tenant context is invalid';
  END IF;

  IF p_property IS NULL OR p_sheet_date IS NULL OR p_mode NOT IN ('preview', 'generate')
     OR (p_mode = 'preview' AND (
       p_attendant IS NOT NULL OR p_actor IS NOT NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     ))
     OR (p_mode = 'generate' AND (p_attendant IS NULL OR p_actor IS NULL OR p_limit IS NOT NULL)) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'housekeeping sheet input is invalid';
  END IF;

  SELECT property.timezone
    INTO v_timezone
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property';
  IF NOT FOUND OR v_timezone IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'housekeeping sheet target is unavailable';
  END IF;

  IF p_mode = 'generate' THEN
    PERFORM 1
      FROM public.app_user AS actor
     WHERE actor.tenant_id = p_tenant
       AND actor.id = p_actor
       AND actor.status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'housekeeping sheet target is unavailable';
    END IF;

    PERFORM 1
      FROM public.party AS attendant
      JOIN public.party_role AS staff
        ON staff.tenant_id = attendant.tenant_id
       AND staff.party_id = attendant.id
       AND staff.role = 'staff'
     WHERE attendant.tenant_id = p_tenant
       AND attendant.id = p_attendant
       AND attendant.status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'housekeeping sheet target is unavailable';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'housekeeping-sheet:' || p_tenant::text || ':' || p_property::text || ':' || p_sheet_date::text,
        202
      )
    );
  END IF;

  WITH day_bounds AS MATERIALIZED (
    SELECT (p_sheet_date::timestamp AT TIME ZONE v_timezone) AS starts_at,
           ((p_sheet_date + 1)::timestamp AT TIME ZONE v_timezone) AS ends_at
  ), occupied AS MATERIALIZED (
    SELECT room.id AS space_id,
           room.code AS space_code,
           room.floor,
           room.profile_key,
           pg_catalog.min(pg_catalog.lower(segment.period)) AS arrival_at,
           pg_catalog.max(pg_catalog.upper(segment.period)) AS departure_at,
           pg_catalog.bool_or(
             (pg_catalog.upper(segment.period) AT TIME ZONE v_timezone)::date = p_sheet_date
           ) AS departs_on_sheet_date
      FROM public.space AS room
      JOIN public.space_occupancy AS occupancy
        ON occupancy.tenant_id = room.tenant_id
       AND occupancy.space_id = room.id
       AND occupancy.slot_kind = 'segment'
      JOIN public.reservation_segment AS segment
        ON segment.tenant_id = occupancy.tenant_id
       AND segment.id = occupancy.slot_ref
       AND segment.status = 'in_house'
      JOIN public.reservation AS reservation
        ON reservation.tenant_id = segment.tenant_id
       AND reservation.id = segment.reservation_id
       AND reservation.property_node = room.property_node
       AND reservation.status = 'in_house'
      CROSS JOIN day_bounds
     WHERE room.tenant_id = p_tenant
       AND room.property_node = p_property
       AND room.status = 'active'
       AND occupancy.period && pg_catalog.tstzrange(day_bounds.starts_at, day_bounds.ends_at, '[)')
       AND segment.period && pg_catalog.tstzrange(day_bounds.starts_at, day_bounds.ends_at, '[)')
     GROUP BY room.id, room.code, room.floor, room.profile_key
  ), profile_candidates AS MATERIALIZED (
    SELECT occupied.*,
           profile.id AS profile_id,
           profile.content ->> 'housekeeping_cadence' AS cadence,
           CASE WHEN profile.tenant_id = p_tenant THEN 1 ELSE 0 END AS precedence
      FROM occupied
      LEFT JOIN public.extension AS profile
        ON profile.type = 'vertical_profile'
       AND profile.key = occupied.profile_key
       AND profile.status = 'active'
       AND profile.effective @> pg_catalog.transaction_timestamp()
       AND (profile.tenant_id = p_tenant OR profile.tenant_id IS NULL)
  ), winning_precedence AS MATERIALIZED (
    SELECT space_id, pg_catalog.max(precedence) AS precedence
      FROM profile_candidates
     WHERE profile_id IS NOT NULL
     GROUP BY space_id
  ), resolved AS MATERIALIZED (
    SELECT candidate.space_id,
           candidate.space_code,
           candidate.floor,
           candidate.profile_key,
           candidate.arrival_at,
           candidate.departure_at,
           candidate.departs_on_sheet_date,
           pg_catalog.count(candidate.profile_id) FILTER (
             WHERE candidate.precedence = winning.precedence
           )::integer AS profile_count,
           pg_catalog.min(candidate.cadence) FILTER (
             WHERE candidate.precedence = winning.precedence
           ) AS cadence
      FROM profile_candidates AS candidate
      LEFT JOIN winning_precedence AS winning ON winning.space_id = candidate.space_id
     GROUP BY candidate.space_id, candidate.space_code, candidate.floor,
              candidate.profile_key, candidate.arrival_at, candidate.departure_at,
              candidate.departs_on_sheet_date
  )
  SELECT pg_catalog.count(*)::integer,
         pg_catalog.count(*) FILTER (WHERE profile_count <> 1 OR cadence IS NULL)::integer,
         pg_catalog.count(DISTINCT cadence) FILTER (WHERE profile_count = 1)::integer,
         pg_catalog.count(*) FILTER (
           WHERE profile_count = 1 AND cadence NOT IN ('daily', 'on_departure')
         )::integer,
         COALESCE(
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'space_id', space_id,
               'space_code', space_code,
               'floor', floor,
               'profile_key', profile_key,
               'cadence', cadence,
               'arrival_at', arrival_at,
               'departure_at', departure_at
             ) ORDER BY space_code, space_id
           ) FILTER (
             WHERE profile_count = 1
               AND (cadence = 'daily' OR (cadence = 'on_departure' AND departs_on_sheet_date))
           ),
           '[]'::jsonb
         )
    INTO v_room_count, v_bad_profile_count, v_cadence_count, v_unsupported_count, v_candidates
    FROM resolved;

  IF v_bad_profile_count <> 0 OR v_unsupported_count <> 0 OR v_cadence_count > 1 THEN
    RAISE EXCEPTION USING ERRCODE = '0A000',
      MESSAGE = 'housekeeping cadence is unsupported for this property date';
  END IF;

  IF p_mode = 'preview' THEN
    SELECT COALESCE(pg_catalog.jsonb_agg(candidate.value ORDER BY candidate.ordinality), '[]'::jsonb)
      INTO v_candidates
      FROM pg_catalog.jsonb_array_elements(v_candidates) WITH ORDINALITY AS candidate(value, ordinality)
     WHERE candidate.ordinality <= p_limit;
    RETURN QUERY SELECT NULL::uuid, p_sheet_date, NULL::uuid, false, v_candidates;
    RETURN;
  END IF;

  IF pg_catalog.jsonb_array_length(v_candidates) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '55001',
      MESSAGE = 'housekeeping sheet has no eligible rooms for this property date';
  END IF;

  v_sheet_id := (
    pg_catalog.substr(pg_catalog.md5(
      'yellow:housekeeping-sheet:' || p_tenant::text || ':' || p_property::text || ':' || p_sheet_date::text
    ), 1, 8) || '-' ||
    pg_catalog.substr(pg_catalog.md5(
      'yellow:housekeeping-sheet:' || p_tenant::text || ':' || p_property::text || ':' || p_sheet_date::text
    ), 9, 4) || '-5' ||
    pg_catalog.substr(pg_catalog.md5(
      'yellow:housekeeping-sheet:' || p_tenant::text || ':' || p_property::text || ':' || p_sheet_date::text
    ), 14, 3) || '-a' ||
    pg_catalog.substr(pg_catalog.md5(
      'yellow:housekeeping-sheet:' || p_tenant::text || ':' || p_property::text || ':' || p_sheet_date::text
    ), 18, 3) || '-' ||
    pg_catalog.substr(pg_catalog.md5(
      'yellow:housekeeping-sheet:' || p_tenant::text || ':' || p_property::text || ':' || p_sheet_date::text
    ), 21, 12)
  )::uuid;

  SELECT existing.attendant_party
    INTO v_existing_attendant
    FROM public.task_sheet AS existing
   WHERE existing.tenant_id = p_tenant
     AND existing.property_node = p_property
     AND existing.sheet_date = p_sheet_date
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing_attendant IS DISTINCT FROM p_attendant THEN
      RAISE EXCEPTION USING ERRCODE = '23505',
        MESSAGE = 'housekeeping sheet already belongs to another attendant';
    END IF;
  ELSE
    INSERT INTO public.task_sheet (
      id, tenant_id, property_node, sheet_date, attendant_party, target_credits
    ) VALUES (
      v_sheet_id, p_tenant, p_property, p_sheet_date, p_attendant, NULL
    );
    v_created := true;

    INSERT INTO public.task (
      id, tenant_id, property_node, kind, status, subject_type, subject_id,
      assignee_party, department, due_at, priority, credits, sheet_id, payload
    )
    SELECT (
             pg_catalog.substr(pg_catalog.md5(
               'yellow:housekeeping-task:' || p_tenant::text || ':' || p_property::text || ':' ||
               p_sheet_date::text || ':' || (candidate.value ->> 'space_id')
             ), 1, 8) || '-' ||
             pg_catalog.substr(pg_catalog.md5(
               'yellow:housekeeping-task:' || p_tenant::text || ':' || p_property::text || ':' ||
               p_sheet_date::text || ':' || (candidate.value ->> 'space_id')
             ), 9, 4) || '-5' ||
             pg_catalog.substr(pg_catalog.md5(
               'yellow:housekeeping-task:' || p_tenant::text || ':' || p_property::text || ':' ||
               p_sheet_date::text || ':' || (candidate.value ->> 'space_id')
             ), 14, 3) || '-a' ||
             pg_catalog.substr(pg_catalog.md5(
               'yellow:housekeeping-task:' || p_tenant::text || ':' || p_property::text || ':' ||
               p_sheet_date::text || ':' || (candidate.value ->> 'space_id')
             ), 18, 3) || '-' ||
             pg_catalog.substr(pg_catalog.md5(
               'yellow:housekeeping-task:' || p_tenant::text || ':' || p_property::text || ':' ||
               p_sheet_date::text || ':' || (candidate.value ->> 'space_id')
             ), 21, 12)
           )::uuid,
           p_tenant,
           p_property,
           'housekeeping',
           'assigned',
           'space',
           (candidate.value ->> 'space_id')::uuid,
           p_attendant,
           'Housekeeping',
           NULL,
           3,
           NULL,
           v_sheet_id,
           pg_catalog.jsonb_build_object(
             'sheet_id', v_sheet_id,
             'sheet_date', p_sheet_date,
             'profile_key', candidate.value ->> 'profile_key',
             'cadence', candidate.value ->> 'cadence',
             'attendant_party_id', p_attendant
           )
      FROM pg_catalog.jsonb_array_elements(v_candidates) AS candidate(value);
  END IF;

  SELECT COALESCE(
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'task_id', task.id,
               'space_id', room.id,
               'space_code', room.code,
               'profile_key', task.payload ->> 'profile_key',
               'cadence', task.payload ->> 'cadence'
             ) ORDER BY room.code, room.id
           ),
           '[]'::jsonb
         )
    INTO v_candidates
    FROM public.task AS task
    JOIN public.space AS room
      ON room.tenant_id = task.tenant_id
     AND room.id = task.subject_id
     AND room.property_node = task.property_node
   WHERE task.tenant_id = p_tenant
     AND task.property_node = p_property
     AND task.sheet_id = v_sheet_id
     AND task.kind = 'housekeeping'
     AND task.subject_type = 'space';

  RETURN QUERY SELECT v_sheet_id, p_sheet_date, p_attendant, v_created, v_candidates;
END;
$$;

ALTER FUNCTION public.govern_housekeeping_task_sheet(
  uuid, uuid, date, uuid, uuid, text, integer
) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.govern_housekeeping_task_sheet(
  uuid, uuid, date, uuid, uuid, text, integer
) FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.govern_housekeeping_task_sheet(
  uuid, uuid, date, uuid, uuid, text, integer
) TO app_role;

-- Raw runtime mutation stays denied. Generation is possible only through the
-- exact capability above; task lifecycle remains exclusively owned by migration0026.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.task_sheet FROM app_role, yellow_runtime;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.task FROM app_role, yellow_runtime;
