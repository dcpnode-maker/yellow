-- Order 356: guarded, audited business-day seal capability.
-- The application owns idempotency/fact/outbox evidence; this function owns only
-- the authorization, complete readiness revalidation and one-way database latch.

CREATE FUNCTION public.seal_business_day_audited(
  p_tenant uuid,
  p_property uuid,
  p_date date,
  p_actor uuid
) RETURNS TABLE(
  tenant_id uuid,
  property_node uuid,
  business_date date,
  previous_state text,
  state text,
  sealed_at timestamptz,
  sealed_by uuid
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_context uuid;
  v_day public.business_day%ROWTYPE;
  v_sealed_at timestamptz;
  v_ready boolean;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='audited business-day seal requires governed runtime';
  END IF;

  BEGIN
    v_context := NULLIF(pg_catalog.current_setting('app.tenant_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='invalid tenant context';
  END;

  IF p_tenant IS NULL OR p_property IS NULL OR p_date IS NULL OR p_actor IS NULL
     OR v_context IS NULL OR v_context <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='invalid audited business-day seal context';
  END IF;

  -- Fixed lexical relation order. SHARE conflicts with every ordinary writer, so
  -- the readiness snapshot cannot be invalidated before this transaction commits.
  LOCK TABLE public.app_user IN SHARE MODE;
  LOCK TABLE public.business_day IN SHARE MODE;
  LOCK TABLE public.business_day_discrepancy_carry IN SHARE MODE;
  LOCK TABLE public.cashier_session IN SHARE MODE;
  LOCK TABLE public.discrepancy IN SHARE MODE;
  LOCK TABLE public.document IN SHARE MODE;
  LOCK TABLE public.fiscal_submission IN SHARE MODE;
  LOCK TABLE public.inbound_message IN SHARE MODE;
  LOCK TABLE public.org_node IN SHARE MODE;
  LOCK TABLE public.outbox IN SHARE MODE;
  LOCK TABLE public.payment IN SHARE MODE;
  LOCK TABLE public.payment_operation IN SHARE MODE;
  LOCK TABLE public.reservation IN SHARE MODE;
  LOCK TABLE public.role_permission IN SHARE MODE;
  LOCK TABLE public.space IN SHARE MODE;
  LOCK TABLE public.statutory_submission IN SHARE MODE;
  LOCK TABLE public.tenant IN SHARE MODE;
  LOCK TABLE public.user_role IN SHARE MODE;

  PERFORM 1
    FROM public.tenant AS t
    JOIN public.app_user AS actor
      ON actor.tenant_id=t.id AND actor.id=p_actor AND actor.status='active'
    JOIN public.user_role AS ur
      ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role_permission AS rp
      ON rp.role_id=ur.role_id AND rp.permission_code='business_day.seal'
    JOIN public.org_node AS grant_node
      ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
    JOIN public.org_node AS property
      ON property.tenant_id=t.id AND property.id=p_property
      AND property.kind='property' AND grant_node.path @> property.path
   WHERE t.id=p_tenant AND t.status='active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='business-day seal actor is unauthorized';
  END IF;

  SELECT day.* INTO v_day
    FROM public.business_day AS day
   WHERE day.tenant_id=p_tenant
     AND day.property_node=p_property
     AND day.business_date=p_date
     AND day.sealed_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='business day is missing or already sealed';
  END IF;

  WITH target AS MATERIALIZED (
          SELECT day.tenant_id, day.property_node, day.business_date,
                 pg_catalog.transaction_timestamp() AS captured_at
            FROM public.business_day AS day
            JOIN public.tenant ON tenant.id=day.tenant_id AND tenant.status='active'
            JOIN public.org_node AS property ON property.tenant_id=day.tenant_id
              AND property.id=day.property_node AND property.kind='property'
            JOIN public.app_user AS actor ON actor.tenant_id=day.tenant_id
              AND actor.id=p_actor AND actor.status='active'
           WHERE day.tenant_id=p_tenant
             AND day.property_node=p_property
             AND day.business_date=p_date
             AND day.sealed_at IS NULL
        ),
        due AS MATERIALIZED (
          SELECT count(*) FILTER (WHERE reservation.status='due_in' AND transition.safe
            AND transition.property_node=(SELECT property_node FROM target)
            AND transition.business_date=(SELECT business_date FROM target))::bigint AS due_in,
                 count(*) FILTER (WHERE reservation.status='due_out' AND transition.safe
            AND transition.property_node=(SELECT property_node FROM target)
            AND transition.business_date=(SELECT business_date FROM target))::bigint AS due_out,
                 count(*) FILTER (WHERE NOT COALESCE(transition.safe,false))::bigint AS unknown_due
            FROM public.reservation
            LEFT JOIN LATERAL (
              SELECT event.property_node, event.business_date,
                     event.event_type=('reservation.' || reservation.status) AND event.property_node IS NOT NULL
                       AND property.id IS NOT NULL AS safe
                FROM public.outbox AS event
                LEFT JOIN public.org_node AS property ON property.tenant_id=event.tenant_id
                  AND property.id=event.property_node AND property.kind='property'
               WHERE event.tenant_id=reservation.tenant_id
                 AND event.aggregate_type='reservation' AND event.aggregate_id=reservation.id
                 AND event.event_type IN ('reservation.due_in','reservation.due_out')
               ORDER BY event.seq DESC LIMIT 1
            ) AS transition ON true
           WHERE reservation.tenant_id=(SELECT tenant_id FROM target)
             AND reservation.status IN ('due_in','due_out')
        ),
        cashiers AS MATERIALIZED (
          SELECT count(*)::bigint AS open_cashiers FROM public.cashier_session
           WHERE tenant_id=(SELECT tenant_id FROM target)
             AND property_node=(SELECT property_node FROM target)
             AND business_date=(SELECT business_date FROM target) AND closed_at IS NULL
        ),
        reported_discrepancy_evidence AS MATERIALIZED (
          SELECT discrepancy.id,
                 count(event.seq)::bigint AS event_count,
                 min(event.property_node::text)::uuid AS event_property,
                 min(event.business_date) AS event_date
            FROM public.discrepancy
            LEFT JOIN public.outbox AS event ON event.tenant_id=discrepancy.tenant_id
              AND event.aggregate_type='discrepancy' AND event.aggregate_id=discrepancy.id
              AND event.event_type='discrepancy.reported'
           WHERE discrepancy.tenant_id=(SELECT tenant_id FROM target) AND discrepancy.resolved_at IS NULL
           GROUP BY discrepancy.id
        ),
        carried_discrepancy_event_evidence AS MATERIALIZED (
          SELECT discrepancy.id,
                 count(event.seq)::bigint AS event_count,
                 min(event.property_node::text)::uuid AS event_property,
                 min(event.business_date) AS event_date,
                 min(event.actor_id::text)::uuid AS event_actor,
                 min(event.correlation_id::text)::uuid AS event_request,
                 min(event.created_at) AS event_created_at
            FROM public.discrepancy
            LEFT JOIN public.outbox AS event ON event.tenant_id=discrepancy.tenant_id
              AND event.aggregate_type='discrepancy' AND event.aggregate_id=discrepancy.id
              AND event.event_type='discrepancy.carried'
           WHERE discrepancy.tenant_id=(SELECT tenant_id FROM target) AND discrepancy.resolved_at IS NULL
           GROUP BY discrepancy.id
        ),
        carried_discrepancy_link_evidence AS MATERIALIZED (
          SELECT target_discrepancy.id,
                 count(carry.id)::bigint AS link_count,
                 count(carry.id) FILTER (WHERE
                   source_discrepancy.id IS NOT NULL
                   AND source_discrepancy.id<>target_discrepancy.id
                   AND carry.source_business_date<>carry.target_business_date
                   AND carry.property_node=target_space.property_node
                   AND carry.space_id=target_discrepancy.space_id
                   AND carry.space_id=source_discrepancy.space_id
                   AND source_space.property_node=carry.property_node
                   AND source_discrepancy.resolution='carried_forward'
                   AND source_discrepancy.resolved_at=carry.carried_at
                   AND source_report.event_count=1
                   AND source_report.event_property=carry.property_node
                   AND source_report.event_date=carry.source_business_date
                   AND target_discrepancy.reported=source_discrepancy.reported
                   AND target_discrepancy.system_state=source_discrepancy.system_state
                   AND target_discrepancy.reported_by=carry.requested_by
                   AND target_discrepancy.reported_at=carry.carried_at
                   AND carry.resolution='carried_forward'
                   AND carry.requested_by<>carry.approved_by
                   AND carry.approval_requested_at<=carry.approval_decided_at
                   AND carry.approval_decided_at<=carry.carried_at
                   AND source_day.tenant_id IS NOT NULL
                   AND target_day.tenant_id IS NOT NULL
                   AND target_day.opened_at=carry.target_opened_at
                   AND carry.discrepancy_state_hash ~ '^[0-9a-f]{64}$'
                   AND carry.request_hash ~ '^[0-9a-f]{64}$'
                   AND carry.discrepancy_state_hash=canonical.discrepancy_state_hash
                   AND carry.request_hash=canonical.request_hash
                 )::bigint AS safe_link_count,
                 min(carry.property_node::text)::uuid AS link_property,
                 min(carry.target_business_date) AS link_target_date,
                 min(carry.requested_by::text)::uuid AS link_requester,
                 min(carry.request_id::text)::uuid AS link_request,
                 min(carry.carried_at) AS link_carried_at
            FROM public.discrepancy AS target_discrepancy
            LEFT JOIN public.space AS target_space ON target_space.tenant_id=target_discrepancy.tenant_id
              AND target_space.id=target_discrepancy.space_id
            LEFT JOIN public.business_day_discrepancy_carry AS carry
              ON carry.tenant_id=target_discrepancy.tenant_id
              AND carry.target_discrepancy_id=target_discrepancy.id
            LEFT JOIN public.discrepancy AS source_discrepancy ON source_discrepancy.tenant_id=carry.tenant_id
              AND source_discrepancy.id=carry.source_discrepancy_id
            LEFT JOIN public.space AS source_space ON source_space.tenant_id=source_discrepancy.tenant_id
              AND source_space.id=source_discrepancy.space_id
            LEFT JOIN public.business_day AS source_day ON source_day.tenant_id=carry.tenant_id
              AND source_day.property_node=carry.property_node
              AND source_day.business_date=carry.source_business_date
            LEFT JOIN LATERAL (
              SELECT count(event.seq)::bigint AS event_count,
                     min(event.property_node::text)::uuid AS event_property,
                     min(event.business_date) AS event_date
                FROM public.outbox AS event
               WHERE event.tenant_id=carry.tenant_id
                 AND event.aggregate_type='discrepancy'
                 AND event.aggregate_id=source_discrepancy.id
                 AND event.event_type='discrepancy.reported'
            ) AS source_report ON carry.id IS NOT NULL AND source_discrepancy.id IS NOT NULL
            LEFT JOIN public.business_day AS target_day ON target_day.tenant_id=carry.tenant_id
              AND target_day.property_node=carry.property_node
              AND target_day.business_date=carry.target_business_date
            LEFT JOIN LATERAL (
              SELECT state.discrepancy_state_hash,
                     pg_catalog.encode(public.digest(pg_catalog.jsonb_build_object(
                       'v',1,'tenantId',carry.tenant_id,'propertyNode',carry.property_node,
                       'discrepancyId',source_discrepancy.id,
                       'sourceBusinessDate',carry.source_business_date,
                       'targetBusinessDate',carry.target_business_date,'reason',carry.reason,
                       'discrepancyStateHash',state.discrepancy_state_hash,
                       'targetOpenedAt',carry.target_opened_at
                     )::text,'sha256'),'hex') AS request_hash
                FROM LATERAL (
                  SELECT pg_catalog.encode(public.digest(pg_catalog.jsonb_build_object(
                    'v',1,'tenantId',carry.tenant_id,'discrepancyId',source_discrepancy.id,
                    'spaceId',source_discrepancy.space_id,'reported',source_discrepancy.reported,
                    'systemState',source_discrepancy.system_state,
                    'reportedBy',source_discrepancy.reported_by,
                    'reportedAt',source_discrepancy.reported_at,'resolvedAt',NULL
                  )::text,'sha256'),'hex') AS discrepancy_state_hash
                ) AS state
            ) AS canonical ON carry.id IS NOT NULL AND source_discrepancy.id IS NOT NULL
           WHERE target_discrepancy.tenant_id=(SELECT tenant_id FROM target)
             AND target_discrepancy.resolved_at IS NULL
           GROUP BY target_discrepancy.id
        ),
        discrepancy_evidence AS MATERIALIZED (
          SELECT discrepancy.id, space.property_node AS space_property,
                 reported.event_count AS reported_event_count,
                 reported.event_property AS reported_event_property,
                 reported.event_date AS reported_event_date,
                 carried_event.event_count AS carried_event_count,
                 carried_event.event_property AS carried_event_property,
                 carried_event.event_date AS carried_event_date,
                 carry.link_count, carry.safe_link_count, carry.link_property,
                 carry.link_target_date, carry.link_requester, carry.link_request,
                 carry.link_carried_at, carried_event.event_actor,
                 carried_event.event_request, carried_event.event_created_at,
                 (carry.link_count=1 AND carry.safe_link_count=1
                   AND reported.event_count=0 AND carried_event.event_count=1
                   AND carry.link_property=carried_event.event_property
                   AND carry.link_target_date=carried_event.event_date
                   AND carry.link_requester=carried_event.event_actor
                   AND carry.link_request=carried_event.event_request
                   AND carry.link_carried_at=carried_event.event_created_at) AS safe_carry
            FROM public.discrepancy
            LEFT JOIN public.space ON space.tenant_id=discrepancy.tenant_id AND space.id=discrepancy.space_id
            JOIN reported_discrepancy_evidence AS reported ON reported.id=discrepancy.id
            JOIN carried_discrepancy_event_evidence AS carried_event ON carried_event.id=discrepancy.id
            JOIN carried_discrepancy_link_evidence AS carry ON carry.id=discrepancy.id
           WHERE discrepancy.tenant_id=(SELECT tenant_id FROM target) AND discrepancy.resolved_at IS NULL
        ),
        discrepancies AS MATERIALIZED (
          SELECT count(*) FILTER (WHERE
                   (reported_event_count=1 AND carried_event_count=0 AND link_count=0
                     AND space_property=reported_event_property
                     AND reported_event_property=(SELECT property_node FROM target)
                     AND reported_event_date=(SELECT business_date FROM target))
                   OR (safe_carry AND link_property=(SELECT property_node FROM target)
                     AND link_target_date=(SELECT business_date FROM target)))::bigint AS discrepancies,
                 count(*) FILTER (WHERE NOT safe_carry AND (
                   reported_event_count<>1 OR carried_event_count<>0 OR link_count<>0
                   OR space_property IS NULL OR reported_event_property IS NULL
                   OR space_property<>reported_event_property
                   OR (reported_event_property=(SELECT property_node FROM target)
                     AND reported_event_date IS DISTINCT FROM (SELECT business_date FROM target))))::bigint
                   AS unknown_discrepancy
            FROM discrepancy_evidence
        ),
        target_outbox AS MATERIALIZED (
          SELECT min(created_at) AS oldest_unpublished
            FROM public.outbox
           WHERE tenant_id=(SELECT tenant_id FROM target)
             AND property_node=(SELECT property_node FROM target)
             AND business_date=(SELECT business_date FROM target)
             AND published_at IS NULL AND created_at<=(SELECT captured_at FROM target)
        ),
        unsafe_outbox AS MATERIALIZED (
          SELECT count(*)::bigint AS unknown_outbox
            FROM public.outbox AS event
            LEFT JOIN public.org_node AS property ON property.tenant_id=event.tenant_id
              AND property.id=event.property_node AND property.kind='property'
           WHERE event.tenant_id=(SELECT tenant_id FROM target)
             AND event.business_date=(SELECT business_date FROM target) AND event.published_at IS NULL
             AND (event.property_node IS NULL OR property.id IS NULL OR
                  (event.property_node=(SELECT property_node FROM target)
                    AND event.created_at>(SELECT captured_at FROM target)))
        ),
        financial AS MATERIALIZED (
          SELECT 0::bigint AS financial_interface,
                 count(*)::bigint AS unknown_financial
            FROM public.payment_operation
            JOIN LATERAL (
              SELECT attempt.status
                FROM public.payment AS attempt
               WHERE attempt.tenant_id=payment_operation.tenant_id
                 AND attempt.operation_id=payment_operation.id
               ORDER BY attempt.attempt_no DESC, attempt.id DESC LIMIT 1
            ) AS head ON true
           WHERE payment_operation.tenant_id=(SELECT tenant_id FROM target)
             AND payment_operation.property_node=(SELECT property_node FROM target)
             AND head.status='pending'
        ),
        fiscal AS MATERIALIZED (
          SELECT count(*) FILTER (WHERE document.property_node=(SELECT property_node FROM target)
            AND document.business_date=(SELECT business_date FROM target))::bigint AS fiscal_interface,
                 count(*) FILTER (WHERE document.id IS NULL OR document.property_node IS NULL
                   OR document.business_date IS NULL OR property.id IS NULL)::bigint AS unknown_fiscal
            FROM public.fiscal_submission
            LEFT JOIN public.document ON document.tenant_id=fiscal_submission.tenant_id
              AND document.id=fiscal_submission.document_id
            LEFT JOIN public.org_node AS property ON property.tenant_id=document.tenant_id
              AND property.id=document.property_node AND property.kind='property'
           WHERE fiscal_submission.tenant_id=(SELECT tenant_id FROM target)
             AND fiscal_submission.status IN ('pending','submitted','rejected','error')
        ),
        statutory AS MATERIALIZED (
          SELECT 0::bigint AS statutory_interface,
                 count(*)::bigint AS unknown_statutory
            FROM public.statutory_submission
           WHERE tenant_id=(SELECT tenant_id FROM target)
             AND property_node=(SELECT property_node FROM target)
             AND status IN ('pending','submitted','failed')
        ),
        channel_work AS MATERIALIZED (
          SELECT 0::bigint AS channel_delivery,
            ((SELECT count(*) FROM public.inbound_message
               WHERE tenant_id=(SELECT tenant_id FROM target) AND status IN ('received','error'))
             + (SELECT count(*) FROM public.outbox
                 WHERE tenant_id=(SELECT tenant_id FROM target)
                   AND property_node=(SELECT property_node FROM target)
                   AND business_date=(SELECT business_date FROM target)
                   AND event_type='ari.push_requested' AND published_at IS NULL))::bigint AS unknown_channel
        )
        SELECT target.captured_at,
               due.due_in=0 AND due.due_out=0 AND cashiers.open_cashiers=0
               AND discrepancies.discrepancies=0 AND financial.financial_interface=0
               AND fiscal.fiscal_interface=0 AND statutory.statutory_interface=0
               AND channel_work.channel_delivery=0 AND due.unknown_due=0
               AND discrepancies.unknown_discrepancy=0 AND unsafe_outbox.unknown_outbox=0
               AND financial.unknown_financial=0 AND fiscal.unknown_fiscal=0
               AND statutory.unknown_statutory=0 AND channel_work.unknown_channel=0
               AND (target_outbox.oldest_unpublished IS NULL OR
                 target.captured_at-target_outbox.oldest_unpublished < interval '5 minutes')
          INTO v_sealed_at, v_ready
          FROM target CROSS JOIN due CROSS JOIN cashiers CROSS JOIN discrepancies
          CROSS JOIN target_outbox CROSS JOIN unsafe_outbox CROSS JOIN financial CROSS JOIN fiscal
          CROSS JOIN statutory CROSS JOIN channel_work;

  IF NOT FOUND OR v_ready IS DISTINCT FROM true OR v_sealed_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='business day is not ready to seal';
  END IF;

  UPDATE public.business_day AS day
     SET sealed_at=v_sealed_at, sealed_by=p_actor
   WHERE day.tenant_id=p_tenant
     AND day.property_node=p_property
     AND day.business_date=p_date
     AND day.sealed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='business day seal latch lost';
  END IF;

  RETURN QUERY SELECT p_tenant,p_property,p_date,'open'::text,'sealed'::text,
                      v_sealed_at,p_actor;
END
$$;

ALTER FUNCTION public.seal_business_day_audited(uuid,uuid,date,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.seal_business_day_audited(uuid,uuid,date,uuid)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.seal_business_day_audited(uuid,uuid,date,uuid)
  TO app_role;

COMMENT ON FUNCTION public.seal_business_day_audited(uuid,uuid,date,uuid) IS
  'Governed runtime-only one-way seal after same-transaction complete readiness revalidation.';
