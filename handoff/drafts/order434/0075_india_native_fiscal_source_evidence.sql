-- Order434 source-intake expansion (WORK IN PROGRESS).
-- This file is not the complete 0075 candidate: dependent timing and the exact
-- native valuation/applicability/tax/accounting/origin unions must be appended
-- before publication. 0076 must finish the source graph before issue is granted.
-- Preserve every legacy source column, preimage and externally supplied digest.
REVOKE ALL ON FUNCTION public.commit_india_native_fiscal_invoice(
  uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid
) FROM PUBLIC,app_role,yellow_runtime;

ALTER TABLE public.india_gst_accommodation_service_provision_snapshot
  ADD COLUMN recording_actor_id uuid,
  ADD COLUMN recording_request_id uuid,
  ADD COLUMN request_key_hash text,
  ADD COLUMN request_hash text,
  ADD COLUMN recorded_at timestamptz,
  ADD COLUMN evidence_hash text,
  ADD CONSTRAINT india_service_recording_actor_fk
    FOREIGN KEY (tenant_id,recording_actor_id) REFERENCES public.app_user(tenant_id,id),
  ADD CONSTRAINT india_service_recording_shape_ck CHECK (
    pg_catalog.num_nonnulls(recording_actor_id,recording_request_id,
      request_key_hash,request_hash,recorded_at,evidence_hash)=0
    OR (pg_catalog.num_nonnulls(recording_actor_id,recording_request_id,
      request_key_hash,request_hash,recorded_at,evidence_hash)=6
      AND request_key_hash ~ '^[0-9a-f]{64}$'
      AND request_hash ~ '^[0-9a-f]{64}$'
      AND evidence_hash ~ '^[0-9a-f]{64}$'
      AND pg_catalog.isfinite(recorded_at))
  ),
  ADD CONSTRAINT india_service_recording_key_uq UNIQUE (tenant_id,request_key_hash),
  ADD CONSTRAINT india_service_recorded_identity_uq UNIQUE (
    tenant_id,id,property_node,reservation_lineage_id,hold_binding_id,
    attribution_id,reservation_id,segment_id,origin_quote_hash,snapshot_hash,
    currency,service_provision_date,service_provision_evidence_sha256,evidence_hash
  );

ALTER TABLE public.india_gst_accommodation_payment_receipt_snapshot
  ADD COLUMN recording_actor_id uuid,
  ADD COLUMN recording_request_id uuid,
  ADD COLUMN request_key_hash text,
  ADD COLUMN request_hash text,
  ADD COLUMN recorded_at timestamptz,
  ADD COLUMN evidence_hash text,
  ADD CONSTRAINT india_payment_recording_actor_fk
    FOREIGN KEY (tenant_id,recording_actor_id) REFERENCES public.app_user(tenant_id,id),
  ADD CONSTRAINT india_payment_recording_shape_ck CHECK (
    pg_catalog.num_nonnulls(recording_actor_id,recording_request_id,
      request_key_hash,request_hash,recorded_at,evidence_hash)=0
    OR (pg_catalog.num_nonnulls(recording_actor_id,recording_request_id,
      request_key_hash,request_hash,recorded_at,evidence_hash)=6
      AND request_key_hash ~ '^[0-9a-f]{64}$'
      AND request_hash ~ '^[0-9a-f]{64}$'
      AND evidence_hash ~ '^[0-9a-f]{64}$'
      AND pg_catalog.isfinite(recorded_at))
  ),
  ADD CONSTRAINT india_payment_recording_key_uq UNIQUE (tenant_id,request_key_hash);

CREATE TABLE public.india_gst_accommodation_ordinary_regime_evidence (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  property_node uuid NOT NULL,
  reservation_id uuid NOT NULL,
  service_provision_snapshot_id uuid NOT NULL,
  reservation_lineage_id uuid NOT NULL,
  hold_binding_id uuid NOT NULL,
  attribution_id uuid NOT NULL,
  segment_id uuid NOT NULL,
  origin_quote_hash text NOT NULL CHECK (origin_quote_hash ~ '^[0-9a-f]{64}$'),
  snapshot_hash text NOT NULL CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'),
  currency char(3) NOT NULL CHECK (currency='INR'),
  service_provision_date date NOT NULL CHECK (pg_catalog.isfinite(service_provision_date)),
  service_provision_evidence_sha256 text NOT NULL
    CHECK (service_provision_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  service_evidence_hash text NOT NULL CHECK (service_evidence_hash ~ '^[0-9a-f]{64}$'),
  regime text NOT NULL CHECK (regime='ordinary_rule47_30_day'),
  ordinary_regime_source text NOT NULL
    CHECK (ordinary_regime_source='governed_rule47_ordinary_regime_record'),
  legal_basis text NOT NULL
    CHECK (legal_basis='CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT'),
  ordinary_regime_evidence_sha256 text NOT NULL
    CHECK (ordinary_regime_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  recording_actor_id uuid NOT NULL,
  recording_request_id uuid NOT NULL,
  request_key_hash text NOT NULL CHECK (request_key_hash ~ '^[0-9a-f]{64}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp()
    CHECK (pg_catalog.isfinite(recorded_at)),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT india_ordinary_evidence_pk PRIMARY KEY (tenant_id,id),
  CONSTRAINT india_ordinary_evidence_service_uq
    UNIQUE (tenant_id,service_provision_snapshot_id),
  CONSTRAINT india_ordinary_evidence_key_uq UNIQUE (tenant_id,request_key_hash),
  CONSTRAINT india_ordinary_evidence_actor_fk
    FOREIGN KEY (tenant_id,recording_actor_id) REFERENCES public.app_user(tenant_id,id),
  CONSTRAINT india_ordinary_evidence_property_fk
    FOREIGN KEY (tenant_id,property_node) REFERENCES public.org_node(tenant_id,id),
  CONSTRAINT india_ordinary_evidence_service_fk FOREIGN KEY (
    tenant_id,service_provision_snapshot_id,property_node,reservation_lineage_id,
    hold_binding_id,attribution_id,reservation_id,segment_id,origin_quote_hash,
    snapshot_hash,currency,service_provision_date,service_provision_evidence_sha256,
    service_evidence_hash
  ) REFERENCES public.india_gst_accommodation_service_provision_snapshot (
    tenant_id,id,property_node,reservation_lineage_id,hold_binding_id,attribution_id,
    reservation_id,segment_id,origin_quote_hash,snapshot_hash,currency,
    service_provision_date,service_provision_evidence_sha256,evidence_hash
  )
);
CREATE INDEX india_ordinary_evidence_scope
  ON public.india_gst_accommodation_ordinary_regime_evidence
    (tenant_id,property_node,reservation_id,recorded_at,id);
ALTER TABLE public.india_gst_accommodation_ordinary_regime_evidence
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_accommodation_ordinary_regime_evidence
  FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation
  ON public.india_gst_accommodation_ordinary_regime_evidence
  USING (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE public.india_gst_accommodation_ordinary_regime_evidence OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.india_gst_accommodation_ordinary_regime_evidence
  FROM PUBLIC,app_role,yellow_runtime;
GRANT SELECT ON TABLE public.india_gst_accommodation_ordinary_regime_evidence TO app_role;

-- Canonical JSON for these private server-owned preimages: object keys sorted
-- bytewise, compact separators, array order retained. This also replays the
-- existing Order240 attribution snapshot's sorted-key SHA256 without changing it.
CREATE FUNCTION public.india_native_source_canonical_json(p_value jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog,public
AS $$
DECLARE v_result text;
BEGIN
  CASE pg_catalog.jsonb_typeof(p_value)
    WHEN 'object' THEN
      SELECT '{'||COALESCE(pg_catalog.string_agg(
        pg_catalog.to_jsonb(e.key)::text||':'||
        public.india_native_source_canonical_json(e.value),','
        ORDER BY e.key COLLATE "C"),'')||'}'
        INTO v_result FROM pg_catalog.jsonb_each(p_value) e;
    WHEN 'array' THEN
      SELECT '['||COALESCE(pg_catalog.string_agg(
        public.india_native_source_canonical_json(e.value),',' ORDER BY e.ordinality),'')||']'
        INTO v_result
        FROM pg_catalog.jsonb_array_elements(p_value) WITH ORDINALITY e(value,ordinality);
    ELSE v_result:=p_value::text;
  END CASE;
  RETURN v_result;
END;
$$;
ALTER FUNCTION public.india_native_source_canonical_json(jsonb) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_source_canonical_json(jsonb)
  FROM PUBLIC,app_role,yellow_runtime;

CREATE FUNCTION public.india_native_source_hash(p_value jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT
SET search_path=pg_catalog,public
AS $$
  SELECT pg_catalog.encode(public.digest(pg_catalog.convert_to(
    public.india_native_source_canonical_json(p_value),'UTF8'),'sha256'),'hex')
$$;
ALTER FUNCTION public.india_native_source_hash(jsonb) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_source_hash(jsonb) FROM PUBLIC,app_role,yellow_runtime;

CREATE FUNCTION public.prevent_india_native_intake_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India accommodation source evidence is immutable';
END;
$$;
ALTER FUNCTION public.prevent_india_native_intake_mutation() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.prevent_india_native_intake_mutation()
  FROM PUBLIC,app_role,yellow_runtime;
CREATE TRIGGER india_service_evidence_immutable BEFORE UPDATE OR DELETE
  ON public.india_gst_accommodation_service_provision_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.prevent_india_native_intake_mutation();
CREATE TRIGGER india_payment_evidence_immutable BEFORE UPDATE OR DELETE
  ON public.india_gst_accommodation_payment_receipt_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.prevent_india_native_intake_mutation();
CREATE TRIGGER india_ordinary_evidence_immutable BEFORE UPDATE OR DELETE
  ON public.india_gst_accommodation_ordinary_regime_evidence
  FOR EACH ROW EXECUTE FUNCTION public.prevent_india_native_intake_mutation();

-- Invoker-only private helper: the three governed SECURITY DEFINER entry points
-- supply yellow_owner. Lock every row carrying the current authorization before
-- any permanent replay or publication. Existing user_role has no expiry column;
-- the exact current grant and active actor/tenant are the supported authority.
CREATE FUNCTION public.lock_india_native_intake_authority(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_request uuid,p_actor uuid,
  p_key text,p_operation text
) RETURNS date LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public
AS $$
DECLARE v_context uuid; v_date date;
BEGIN
  IF session_user<>'yellow_runtime'
     OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='source intake requires governed runtime authority';
  END IF;
  BEGIN
    v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='source intake tenant context is invalid';
  END;
  IF p_tenant IS NULL OR v_context IS NULL OR v_context<>p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='source intake tenant context is invalid';
  END IF;
  IF p_property IS NULL OR p_reservation IS NULL OR p_request IS NULL OR p_actor IS NULL
     OR p_key IS NULL OR p_key COLLATE "C" !~ '^[!-~]{8,200}$'
     OR p_operation IS NULL OR p_operation NOT IN ('service','payment','ordinary') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='source intake identity or idempotency key is invalid';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-native-intake-scope:'||p_tenant::text||':'||p_reservation::text,434));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-native-intake-request:'||p_tenant::text||':'||p_operation||':'||
    pg_catalog.encode(public.digest(p_key,'sha256'),'hex'),434));
  PERFORM 1 FROM public.tenant t WHERE t.id=p_tenant AND t.status='active' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='source intake authority unavailable';
  END IF;
  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_date
    FROM public.app_user actor
    JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role role_row ON role_row.tenant_id=ur.tenant_id AND role_row.id=ur.role_id
    JOIN public.role_permission rp ON rp.role_id=role_row.id
      AND rp.permission_code='tax-fiscal.india-valuation:finalize'
    JOIN public.permission permission_row ON permission_row.code=rp.permission_code
    JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id
      AND grant_node.id=ur.scope_node
    JOIN public.org_node property ON property.tenant_id=actor.tenant_id
      AND property.id=p_property AND property.kind='property' AND property.currency='INR'
      AND grant_node.path @> property.path
    WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active'
    ORDER BY role_row.id,grant_node.id
    FOR SHARE OF actor,ur,role_row,rp,permission_row,grant_node,property;
  IF NOT FOUND OR v_date IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor lacks property valuation authority';
  END IF;
  RETURN v_date;
END;
$$;
ALTER FUNCTION public.lock_india_native_intake_authority(uuid,uuid,uuid,uuid,uuid,text,text)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_india_native_intake_authority(uuid,uuid,uuid,uuid,uuid,text,text)
  FROM PUBLIC,app_role,yellow_runtime;

-- Resolve and lock typed lineage before using any nested JSON. No caller
-- snapshot, amount or purported source graph participates in this lookup.
CREATE FUNCTION public.lock_india_native_intake_lineage(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_lineage uuid
) RETURNS public.tax_attribution_reservation_binding LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_attribution public.tax_attribution_snapshot%ROWTYPE;
BEGIN
  SELECT lineage.* INTO v_lineage
    FROM public.tax_attribution_reservation_binding lineage
    JOIN public.tax_attribution_hold_binding hb
      ON hb.tenant_id=lineage.tenant_id AND hb.id=lineage.binding_id
      AND hb.property_node=lineage.property_node AND hb.hold_id=lineage.hold_id
      AND hb.attribution_id=lineage.attribution_id AND hb.sellable_unit_id=lineage.sellable_unit_id
      AND hb.period=lineage.period AND hb.origin_quote_hash=lineage.origin_quote_hash
      AND hb.snapshot_hash=lineage.snapshot_hash AND hb.currency=lineage.currency
    JOIN public.tax_attribution_snapshot attribution
      ON attribution.tenant_id=hb.tenant_id AND attribution.id=hb.attribution_id
      AND attribution.property_node=hb.property_node AND attribution.actor_id=hb.bound_by
      AND attribution.origin_kind='rate_quote' AND attribution.schema_version=1
      AND attribution.origin_quote_hash=hb.origin_quote_hash
      AND attribution.snapshot_hash=hb.snapshot_hash AND attribution.currency=hb.currency
    JOIN public.hold h ON h.tenant_id=lineage.tenant_id AND h.id=lineage.hold_id
      AND h.property_node=lineage.property_node AND h.sellable_unit_id=lineage.sellable_unit_id
      AND h.period=lineage.period AND h.kind='cart' AND h.status='consumed'
    JOIN public.reservation reservation
      ON reservation.tenant_id=lineage.tenant_id AND reservation.id=lineage.reservation_id
      AND reservation.property_node=lineage.property_node AND reservation.currency=lineage.currency
    JOIN public.reservation_segment segment
      ON segment.tenant_id=lineage.tenant_id AND segment.id=lineage.segment_id
      AND segment.reservation_id=lineage.reservation_id
      AND segment.sellable_unit_id=lineage.sellable_unit_id AND segment.period=lineage.period
    WHERE lineage.tenant_id=p_tenant AND lineage.id=p_lineage
      AND lineage.property_node=p_property AND lineage.reservation_id=p_reservation
      AND lineage.currency='INR'
    FOR SHARE OF lineage,hb,attribution,h,reservation,segment;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='complete accommodation attribution lineage unavailable';
  END IF;
  SELECT attribution.* INTO STRICT v_attribution
    FROM public.tax_attribution_snapshot attribution
    WHERE attribution.tenant_id=p_tenant AND attribution.id=v_lineage.attribution_id;
  IF v_attribution.snapshot->>'snapshotHash' IS DISTINCT FROM v_lineage.snapshot_hash
     OR v_attribution.snapshot->>'currency' IS DISTINCT FROM 'INR'
     OR v_attribution.snapshot->'origin'->>'quoteHash' IS DISTINCT FROM v_lineage.origin_quote_hash
     OR pg_catalog.jsonb_typeof(v_attribution.snapshot->'evaluation') IS DISTINCT FROM 'object'
     OR v_attribution.snapshot->'evaluation'->'schemaVersion' IS DISTINCT FROM '1'::jsonb
     OR v_attribution.snapshot->'evaluation'->>'country' IS DISTINCT FROM 'IN'
     OR pg_catalog.jsonb_typeof(v_attribution.snapshot->'evaluation'->'grandTotalMinor')
        IS DISTINCT FROM 'string'
     OR public.india_native_source_hash(v_attribution.snapshot-'snapshotHash')
        IS DISTINCT FROM v_lineage.snapshot_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='canonical attribution snapshot identity is inconsistent';
  END IF;
  RETURN v_lineage;
END;
$$;
ALTER FUNCTION public.lock_india_native_intake_lineage(uuid,uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_india_native_intake_lineage(uuid,uuid,uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;

CREATE FUNCTION public.record_india_gst_accommodation_service_provision(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_lineage uuid,p_service_date date,
  p_external_sha text,p_request uuid,p_actor uuid,p_key text
) RETURNS TABLE(service_provision_snapshot_id uuid,
  service_provision_evidence_sha256 text,evidence_hash text,created boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD'
AS $$
DECLARE
  v_date date; v_key_hash text; v_request_hash text;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_row public.india_gst_accommodation_service_provision_snapshot%ROWTYPE;
  v_payload jsonb;
BEGIN
  v_date:=public.lock_india_native_intake_authority(
    p_tenant,p_property,p_reservation,p_request,p_actor,p_key,'service');
  IF p_lineage IS NULL OR p_service_date IS NULL OR NOT pg_catalog.isfinite(p_service_date)
     OR p_service_date NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
     OR p_external_sha IS NULL OR p_external_sha !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='service provision evidence is invalid';
  END IF;
  v_key_hash:=pg_catalog.encode(public.digest(p_key,'sha256'),'hex');
  -- The audit request UUID is deliberately outside semantic request identity.
  v_request_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-service-request-v1',p_tenant,p_property,p_reservation,p_lineage,
    p_service_date,p_external_sha,p_actor));
  SELECT s.* INTO v_row FROM public.india_gst_accommodation_service_provision_snapshot s
    WHERE s.tenant_id=p_tenant AND s.request_key_hash=v_key_hash FOR SHARE;
  IF FOUND THEN
    IF v_row.request_hash IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='service request key has different actor or evidence';
    END IF;
    RETURN QUERY SELECT v_row.id,v_row.service_provision_evidence_sha256,v_row.evidence_hash,false;
    RETURN;
  END IF;
  v_lineage:=public.lock_india_native_intake_lineage(p_tenant,p_property,p_reservation,p_lineage);
  IF EXISTS(SELECT 1 FROM public.india_gst_accommodation_service_provision_snapshot s
      WHERE s.tenant_id=p_tenant AND s.reservation_lineage_id=p_lineage
        AND s.service_provision_date=p_service_date) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='service date already has immutable evidence';
  END IF;
  v_row.tenant_id:=p_tenant; v_row.id:=pg_catalog.gen_random_uuid();
  v_row.property_node:=p_property; v_row.reservation_lineage_id:=v_lineage.id;
  v_row.hold_binding_id:=v_lineage.binding_id; v_row.attribution_id:=v_lineage.attribution_id;
  v_row.reservation_id:=p_reservation; v_row.segment_id:=v_lineage.segment_id;
  v_row.origin_quote_hash:=v_lineage.origin_quote_hash; v_row.snapshot_hash:=v_lineage.snapshot_hash;
  v_row.currency:='INR'; v_row.service_provision_date:=p_service_date;
  v_row.service_provision_source:='governed_service_provision_record';
  v_row.service_provision_evidence_sha256:=p_external_sha;
  v_row.legal_rule:='CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY';
  v_row.recording_actor_id:=p_actor; v_row.recording_request_id:=p_request;
  v_row.request_key_hash:=v_key_hash; v_row.request_hash:=v_request_hash;
  v_row.recorded_at:=pg_catalog.transaction_timestamp();
  v_row.evidence_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-service-root-v1',pg_catalog.to_jsonb(v_row)-'evidence_hash',
    pg_catalog.to_jsonb(v_lineage)));
  INSERT INTO public.india_gst_accommodation_service_provision_snapshot SELECT (v_row).*;
  v_payload:=pg_catalog.jsonb_build_object('serviceProvisionSnapshotId',v_row.id,
    'reservationId',p_reservation,'attributionId',v_lineage.attribution_id,'evidenceHash',v_row.evidence_hash);
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
    VALUES(p_tenant,'india_gst_accommodation_service_provision_snapshot',v_row.id,
      'recorded',v_row.recorded_at,v_date,p_actor,v_payload);
  PERFORM pg_catalog.pg_advisory_xact_lock(6441674055002974568);
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,
    event_type,event_version,actor_id,correlation_id,payload)
    VALUES(p_tenant,p_property,v_date,'india_gst_accommodation_service_provision_snapshot',
      v_row.id,'india_gst.accommodation_service_provision_recorded',1,p_actor,p_request,v_payload);
  RETURN QUERY SELECT v_row.id,v_row.service_provision_evidence_sha256,v_row.evidence_hash,true;
END;
$$;
ALTER FUNCTION public.record_india_gst_accommodation_service_provision(
  uuid,uuid,uuid,uuid,date,text,uuid,uuid,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_service_provision(
  uuid,uuid,uuid,uuid,date,text,uuid,uuid,text) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_india_gst_accommodation_service_provision(
  uuid,uuid,uuid,uuid,date,text,uuid,uuid,text) TO app_role;

CREATE FUNCTION public.record_india_gst_accommodation_payment_receipt(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_service uuid,p_expected_amount bigint,
  p_books_date date,p_bank_date date,p_external_sha text,p_request uuid,p_actor uuid,p_key text
) RETURNS TABLE(payment_receipt_snapshot_id uuid,
  payment_receipt_evidence_sha256 text,evidence_hash text,created boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD'
AS $$
DECLARE
  v_date date; v_key_hash text; v_request_hash text; v_amount_text text; v_amount bigint;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_service public.india_gst_accommodation_service_provision_snapshot%ROWTYPE;
  v_row public.india_gst_accommodation_payment_receipt_snapshot%ROWTYPE;
  v_payload jsonb;
BEGIN
  v_date:=public.lock_india_native_intake_authority(
    p_tenant,p_property,p_reservation,p_request,p_actor,p_key,'payment');
  IF p_service IS NULL OR p_expected_amount IS NULL OR p_expected_amount<=0
     OR p_books_date IS NULL OR p_bank_date IS NULL
     OR NOT pg_catalog.isfinite(p_books_date) OR NOT pg_catalog.isfinite(p_bank_date)
     OR p_books_date NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
     OR p_bank_date NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
     OR p_external_sha IS NULL OR p_external_sha !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='payment receipt evidence is invalid';
  END IF;
  v_key_hash:=pg_catalog.encode(public.digest(p_key,'sha256'),'hex');
  v_request_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-payment-request-v1',p_tenant,p_property,p_reservation,p_service,
    p_expected_amount::text,p_books_date,p_bank_date,p_external_sha,p_actor));
  SELECT s.* INTO v_row FROM public.india_gst_accommodation_payment_receipt_snapshot s
    WHERE s.tenant_id=p_tenant AND s.request_key_hash=v_key_hash FOR SHARE;
  IF FOUND THEN
    IF v_row.request_hash IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='payment request key has different actor or evidence';
    END IF;
    RETURN QUERY SELECT v_row.id,v_row.payment_receipt_evidence_sha256,v_row.evidence_hash,false;
    RETURN;
  END IF;
  SELECT s.* INTO v_service FROM public.india_gst_accommodation_service_provision_snapshot s
    WHERE s.tenant_id=p_tenant AND s.id=p_service AND s.property_node=p_property
      AND s.reservation_id=p_reservation AND s.currency='INR' AND s.evidence_hash IS NOT NULL
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='governed service provision source unavailable';
  END IF;
  v_lineage:=public.lock_india_native_intake_lineage(
    p_tenant,p_property,p_reservation,v_service.reservation_lineage_id);
  IF public.india_native_source_hash(pg_catalog.jsonb_build_array(
       'india-native-service-root-v1',pg_catalog.to_jsonb(v_service)-'evidence_hash',
       pg_catalog.to_jsonb(v_lineage))) IS DISTINCT FROM v_service.evidence_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='service provision root hash is inconsistent';
  END IF;
  SELECT a.snapshot->'evaluation'->>'grandTotalMinor' INTO v_amount_text
    FROM public.tax_attribution_snapshot a
    WHERE a.tenant_id=p_tenant AND a.id=v_lineage.attribution_id;
  IF v_amount_text IS NULL OR v_amount_text !~ '^[1-9][0-9]{0,18}$' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='full-attribution amount is unavailable';
  END IF;
  BEGIN v_amount:=v_amount_text::bigint;
  EXCEPTION WHEN numeric_value_out_of_range THEN
    RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='full-attribution amount exceeds signed int64';
  END;
  IF p_expected_amount<>v_amount THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='payment expected amount differs from canonical full attribution';
  END IF;
  IF EXISTS(SELECT 1 FROM public.india_gst_accommodation_payment_receipt_snapshot s
    WHERE s.tenant_id=p_tenant AND s.service_provision_snapshot_id=p_service) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='service already has immutable payment receipt evidence';
  END IF;
  v_row.tenant_id:=p_tenant; v_row.id:=pg_catalog.gen_random_uuid();
  v_row.service_provision_snapshot_id:=p_service; v_row.currency:='INR'; v_row.amount_minor:=v_amount;
  v_row.coverage_scope:='full_attribution'; v_row.supplier_books_entry_date:=p_books_date;
  v_row.supplier_bank_credit_date:=p_bank_date; v_row.payment_receipt_date:=LEAST(p_books_date,p_bank_date);
  v_row.payment_receipt_source:='governed_supplier_payment_receipt_record';
  v_row.payment_receipt_evidence_sha256:=p_external_sha;
  v_row.legal_rule:='CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY';
  v_row.recording_actor_id:=p_actor; v_row.recording_request_id:=p_request;
  v_row.request_key_hash:=v_key_hash; v_row.request_hash:=v_request_hash;
  v_row.recorded_at:=pg_catalog.transaction_timestamp();
  v_row.evidence_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-payment-root-v1',pg_catalog.to_jsonb(v_row)-'evidence_hash',
    pg_catalog.to_jsonb(v_service),pg_catalog.to_jsonb(v_lineage)));
  INSERT INTO public.india_gst_accommodation_payment_receipt_snapshot SELECT (v_row).*;
  v_payload:=pg_catalog.jsonb_build_object('paymentReceiptSnapshotId',v_row.id,
    'serviceProvisionSnapshotId',p_service,'reservationId',p_reservation,'evidenceHash',v_row.evidence_hash);
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
    VALUES(p_tenant,'india_gst_accommodation_payment_receipt_snapshot',v_row.id,
      'recorded',v_row.recorded_at,v_date,p_actor,v_payload);
  PERFORM pg_catalog.pg_advisory_xact_lock(6441674055002974568);
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,
    event_type,event_version,actor_id,correlation_id,payload)
    VALUES(p_tenant,p_property,v_date,'india_gst_accommodation_payment_receipt_snapshot',
      v_row.id,'india_gst.accommodation_payment_receipt_recorded',1,p_actor,p_request,v_payload);
  RETURN QUERY SELECT v_row.id,v_row.payment_receipt_evidence_sha256,v_row.evidence_hash,true;
END;
$$;
ALTER FUNCTION public.record_india_gst_accommodation_payment_receipt(
  uuid,uuid,uuid,uuid,bigint,date,date,text,uuid,uuid,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_payment_receipt(
  uuid,uuid,uuid,uuid,bigint,date,date,text,uuid,uuid,text) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_india_gst_accommodation_payment_receipt(
  uuid,uuid,uuid,uuid,bigint,date,date,text,uuid,uuid,text) TO app_role;

CREATE FUNCTION public.record_india_gst_accommodation_ordinary_regime_evidence(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_service uuid,p_regime text,
  p_source text,p_legal_basis text,p_external_sha text,p_request uuid,p_actor uuid,p_key text
) RETURNS TABLE(ordinary_regime_evidence_id uuid,service_provision_snapshot_id uuid,
  evidence_hash text,created boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD'
AS $$
DECLARE
  v_date date; v_key_hash text; v_request_hash text;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_service public.india_gst_accommodation_service_provision_snapshot%ROWTYPE;
  v_row public.india_gst_accommodation_ordinary_regime_evidence%ROWTYPE;
  v_payload jsonb;
BEGIN
  v_date:=public.lock_india_native_intake_authority(
    p_tenant,p_property,p_reservation,p_request,p_actor,p_key,'ordinary');
  IF p_service IS NULL OR p_regime IS DISTINCT FROM 'ordinary_rule47_30_day'
     OR p_source IS DISTINCT FROM 'governed_rule47_ordinary_regime_record'
     OR p_legal_basis IS DISTINCT FROM 'CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT'
     OR p_external_sha IS NULL OR p_external_sha !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='affirmative ordinary Rule47 evidence is required';
  END IF;
  v_key_hash:=pg_catalog.encode(public.digest(p_key,'sha256'),'hex');
  v_request_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-ordinary-request-v1',p_tenant,p_property,p_reservation,p_service,
    p_regime,p_source,p_legal_basis,p_external_sha,p_actor));
  SELECT s.* INTO v_row FROM public.india_gst_accommodation_ordinary_regime_evidence s
    WHERE s.tenant_id=p_tenant AND s.request_key_hash=v_key_hash FOR SHARE;
  IF FOUND THEN
    IF v_row.request_hash IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='ordinary request key has different actor or evidence';
    END IF;
    RETURN QUERY SELECT v_row.id,v_row.service_provision_snapshot_id,v_row.evidence_hash,false;
    RETURN;
  END IF;
  SELECT s.* INTO v_service FROM public.india_gst_accommodation_service_provision_snapshot s
    WHERE s.tenant_id=p_tenant AND s.id=p_service AND s.property_node=p_property
      AND s.reservation_id=p_reservation AND s.currency='INR' AND s.evidence_hash IS NOT NULL
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='governed service provision source unavailable';
  END IF;
  v_lineage:=public.lock_india_native_intake_lineage(
    p_tenant,p_property,p_reservation,v_service.reservation_lineage_id);
  IF public.india_native_source_hash(pg_catalog.jsonb_build_array(
       'india-native-service-root-v1',pg_catalog.to_jsonb(v_service)-'evidence_hash',
       pg_catalog.to_jsonb(v_lineage))) IS DISTINCT FROM v_service.evidence_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='service provision root hash is inconsistent';
  END IF;
  IF EXISTS(SELECT 1 FROM public.india_gst_accommodation_ordinary_regime_evidence s
    WHERE s.tenant_id=p_tenant AND s.service_provision_snapshot_id=p_service) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='service already has immutable ordinary evidence';
  END IF;
  v_row.tenant_id:=p_tenant; v_row.id:=pg_catalog.gen_random_uuid();
  v_row.property_node:=p_property; v_row.reservation_id:=p_reservation;
  v_row.service_provision_snapshot_id:=p_service;
  v_row.reservation_lineage_id:=v_service.reservation_lineage_id;
  v_row.hold_binding_id:=v_service.hold_binding_id; v_row.attribution_id:=v_service.attribution_id;
  v_row.segment_id:=v_service.segment_id; v_row.origin_quote_hash:=v_service.origin_quote_hash;
  v_row.snapshot_hash:=v_service.snapshot_hash; v_row.currency:='INR';
  v_row.service_provision_date:=v_service.service_provision_date;
  v_row.service_provision_evidence_sha256:=v_service.service_provision_evidence_sha256;
  v_row.service_evidence_hash:=v_service.evidence_hash;
  v_row.regime:=p_regime; v_row.ordinary_regime_source:=p_source;
  v_row.legal_basis:=p_legal_basis; v_row.ordinary_regime_evidence_sha256:=p_external_sha;
  v_row.recording_actor_id:=p_actor; v_row.recording_request_id:=p_request;
  v_row.request_key_hash:=v_key_hash; v_row.request_hash:=v_request_hash;
  v_row.recorded_at:=pg_catalog.transaction_timestamp();
  v_row.evidence_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-ordinary-root-v1',pg_catalog.to_jsonb(v_row)-'evidence_hash',
    pg_catalog.to_jsonb(v_service),pg_catalog.to_jsonb(v_lineage)));
  INSERT INTO public.india_gst_accommodation_ordinary_regime_evidence SELECT (v_row).*;
  v_payload:=pg_catalog.jsonb_build_object('ordinaryRegimeEvidenceId',v_row.id,
    'serviceProvisionSnapshotId',p_service,'reservationId',p_reservation,
    'attributionId',v_service.attribution_id,'evidenceHash',v_row.evidence_hash);
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
    VALUES(p_tenant,'india_gst_accommodation_ordinary_regime_evidence',v_row.id,
      'recorded',v_row.recorded_at,v_date,p_actor,v_payload);
  PERFORM pg_catalog.pg_advisory_xact_lock(6441674055002974568);
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,
    event_type,event_version,actor_id,correlation_id,payload)
    VALUES(p_tenant,p_property,v_date,'india_gst_accommodation_ordinary_regime_evidence',
      v_row.id,'india_gst.accommodation_ordinary_regime_recorded',1,p_actor,p_request,v_payload);
  RETURN QUERY SELECT v_row.id,v_row.service_provision_snapshot_id,v_row.evidence_hash,true;
END;
$$;
ALTER FUNCTION public.record_india_gst_accommodation_ordinary_regime_evidence(
  uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_ordinary_regime_evidence(
  uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,text) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_india_gst_accommodation_ordinary_regime_evidence(
  uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,text) TO app_role;
