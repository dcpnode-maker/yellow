param(
  [string]$ProjectName = "yellow-public-demo",
  [string]$DatabaseName = "yellow_public_demo",
  [string]$PropertyId = "6081b544-22a1-534f-a86d-bb1ae0519e14"
)

$ErrorActionPreference = "Stop"

$sql = @"
BEGIN;

CREATE TEMP TABLE yellow_order642_previous_totals ON COMMIT DROP AS
WITH property_scope AS (
  SELECT tenant_id, id AS property_node, timezone,
         (transaction_timestamp() AT TIME ZONE timezone)::date AS business_date
  FROM org_node
  WHERE id = '$PropertyId'::uuid
    AND kind = 'property'
)
SELECT property_scope.tenant_id, property_scope.property_node, property_scope.business_date,
       COALESCE(sum(stats_daily.rooms_available), 0)::int AS rooms_available,
       COALESCE(sum(stats_daily.rooms_sold), 0)::int AS rooms_sold,
       COALESCE(sum(stats_daily.room_revenue_minor), 0)::bigint AS room_revenue_minor
FROM property_scope
LEFT JOIN stats_daily
  ON stats_daily.tenant_id = property_scope.tenant_id
 AND stats_daily.property_node = property_scope.property_node
 AND stats_daily.business_date = property_scope.business_date
GROUP BY property_scope.tenant_id, property_scope.property_node, property_scope.business_date;

CREATE TEMP TABLE yellow_order642_detail_rows ON COMMIT DROP AS
WITH property_scope AS (
  SELECT tenant_id, id AS property_node, timezone,
         (transaction_timestamp() AT TIME ZONE timezone)::date AS business_date
  FROM org_node
  WHERE id = '$PropertyId'::uuid
    AND kind = 'property'
), stay_rows AS (
  SELECT reservation.tenant_id,
         reservation.property_node,
         property_scope.business_date,
         segment.unit_type_id,
         upper(COALESCE(NULLIF(reservation.market_code, ''), 'ALL')) AS market_code,
         upper(COALESCE(NULLIF(reservation.source_code, ''), 'ALL')) AS source_code,
         upper(COALESCE(NULLIF(reservation.channel_code, ''), 'ALL')) AS channel_code,
         count(*)::int AS rooms_sold,
         count(*) FILTER (
           WHERE (lower(segment.period) AT TIME ZONE property_scope.timezone)::date = property_scope.business_date
         )::int AS arrivals,
         count(*) FILTER (
           WHERE (upper(segment.period) AT TIME ZONE property_scope.timezone)::date = property_scope.business_date
         )::int AS departures
  FROM property_scope
  JOIN reservation
    ON reservation.tenant_id = property_scope.tenant_id
   AND reservation.property_node = property_scope.property_node
   AND reservation.status <> 'cancelled'
  JOIN reservation_segment AS segment
    ON segment.tenant_id = reservation.tenant_id
   AND segment.reservation_id = reservation.id
   AND segment.status <> 'cancelled'
  CROSS JOIN LATERAL generate_series(
    (lower(segment.period) AT TIME ZONE property_scope.timezone)::date,
    (upper(segment.period) AT TIME ZONE property_scope.timezone)::date - 1,
    '1 day'::interval
  ) AS stay_night(stay_date)
  WHERE stay_night.stay_date::date = property_scope.business_date
  GROUP BY reservation.tenant_id, reservation.property_node, property_scope.business_date,
           segment.unit_type_id, market_code, source_code, channel_code
), ranked AS (
  SELECT stay_rows.*,
         row_number() OVER (ORDER BY market_code, source_code, channel_code, unit_type_id) AS rn,
         count(*) OVER () AS row_count,
         sum(stay_rows.rooms_sold) OVER () AS total_rooms_sold,
         previous.rooms_available AS total_rooms_available,
         previous.room_revenue_minor AS total_room_revenue_minor,
         COALESCE(sum(floor(previous.rooms_available::numeric * stay_rows.rooms_sold / NULLIF(previous.rooms_sold, 0))::int)
           OVER (ORDER BY market_code, source_code, channel_code, unit_type_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS prior_available,
         COALESCE(sum(floor(previous.room_revenue_minor::numeric * stay_rows.rooms_sold / NULLIF(previous.rooms_sold, 0))::bigint)
           OVER (ORDER BY market_code, source_code, channel_code, unit_type_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS prior_revenue
  FROM stay_rows
  JOIN yellow_order642_previous_totals AS previous
    ON previous.tenant_id = stay_rows.tenant_id
   AND previous.property_node = stay_rows.property_node
   AND previous.business_date = stay_rows.business_date
)
SELECT tenant_id, property_node, business_date, unit_type_id, market_code, source_code, channel_code,
       CASE WHEN rn = row_count THEN greatest(total_rooms_available - prior_available, 0)
            ELSE floor(total_rooms_available::numeric * rooms_sold / NULLIF(total_rooms_sold, 0))::int END AS rooms_available,
       rooms_sold,
       arrivals,
       departures,
       0::int AS no_shows,
       CASE WHEN rn = row_count THEN total_room_revenue_minor - prior_revenue
            ELSE floor(total_room_revenue_minor::numeric * rooms_sold / NULLIF(total_rooms_sold, 0))::bigint END AS room_revenue_minor,
       0::bigint AS fnb_revenue_minor,
       0::bigint AS other_revenue_minor
FROM ranked
WHERE total_rooms_sold > 0
  AND total_rooms_available > 0;

DO `$`$
DECLARE
  v_previous yellow_order642_previous_totals%ROWTYPE;
  v_new record;
BEGIN
  SELECT * INTO v_previous FROM yellow_order642_previous_totals;
  SELECT COALESCE(sum(rooms_available), 0)::int AS rooms_available,
         COALESCE(sum(rooms_sold), 0)::int AS rooms_sold,
         COALESCE(sum(room_revenue_minor), 0)::bigint AS room_revenue_minor
    INTO v_new
  FROM yellow_order642_detail_rows;
  IF v_previous.rooms_sold <= 0 OR v_previous.rooms_available <= 0 THEN
    RAISE EXCEPTION 'current business-date stats are unavailable';
  END IF;
  IF v_previous.rooms_available <> v_new.rooms_available
     OR v_previous.rooms_sold <> v_new.rooms_sold
     OR v_previous.room_revenue_minor <> v_new.room_revenue_minor THEN
    RAISE EXCEPTION 'detailed commercial stats do not preserve totals';
  END IF;
END
`$`$;

DELETE FROM stats_daily
USING yellow_order642_previous_totals previous
WHERE stats_daily.tenant_id = previous.tenant_id
  AND stats_daily.property_node = previous.property_node
  AND stats_daily.business_date = previous.business_date;

INSERT INTO stats_daily (
  tenant_id, property_node, business_date, unit_type_id, market_code, source_code, channel_code,
  rooms_available, rooms_sold, arrivals, departures, no_shows,
  room_revenue_minor, fnb_revenue_minor, other_revenue_minor
)
SELECT tenant_id, property_node, business_date, unit_type_id, market_code, source_code, channel_code,
       rooms_available, rooms_sold, arrivals, departures, no_shows,
       room_revenue_minor, fnb_revenue_minor, other_revenue_minor
FROM yellow_order642_detail_rows;

COMMIT;

SELECT business_date, market_code, source_code, channel_code,
       sum(rooms_available)::int AS rooms_available,
       sum(rooms_sold)::int AS rooms_sold,
       sum(room_revenue_minor)::bigint AS room_revenue_minor
FROM stats_daily
WHERE property_node = '$PropertyId'::uuid
  AND business_date = (
    SELECT (transaction_timestamp() AT TIME ZONE timezone)::date
    FROM org_node
    WHERE id = '$PropertyId'::uuid
  )
GROUP BY business_date, market_code, source_code, channel_code
ORDER BY rooms_sold DESC, market_code, source_code, channel_code;
"@

$sql | docker compose -p $ProjectName exec -T postgres psql -v ON_ERROR_STOP=1 -U yellow_deploy -d $DatabaseName
