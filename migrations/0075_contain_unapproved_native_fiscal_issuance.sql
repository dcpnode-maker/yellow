-- Order439: Order430's native issue authority is not approved for release.
-- Preserve immutable documents, numbering history and all other capabilities.
-- Order434's replacement remains outside the runner until independent acceptance.
REVOKE EXECUTE ON FUNCTION public.commit_india_native_fiscal_invoice(
  uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb, uuid
) FROM PUBLIC, app_role, yellow_runtime;
