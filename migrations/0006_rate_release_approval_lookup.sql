-- Bounded keyset discovery for the rate-plan publication approval inbox.
-- Keep rate_plan_id as text so malformed historical JSON cannot make migration/index reads cast-fail.
CREATE INDEX approval_request_rate_release_plan_cursor
  ON approval_request (
    tenant_id,
    (payload ->> 'rate_plan_id'),
    created_at DESC,
    id DESC
  )
  WHERE kind = 'rate_plan_release'
    AND subject_type = 'extension';
