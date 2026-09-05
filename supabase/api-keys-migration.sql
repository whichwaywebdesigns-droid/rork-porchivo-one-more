-- api_keys — Enterprise API access for the manager portal.
--
-- Keys are Bearer tokens (`pvk_live_…`) verified by the api-gateway edge
-- function. Only a SHA-256 hash of the key is stored — the plaintext key is
-- shown ONCE at creation in the manager portal (ManageApiKeys) and never
-- persisted. Keys are revoked (revoked_at), never deleted — audit trail.

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT api_keys_name_len CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT api_keys_prefix_len CHECK (char_length(key_prefix) BETWEEN 4 AND 24)
);

CREATE INDEX IF NOT EXISTS api_keys_org_idx ON public.api_keys (org_id, created_at DESC);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Staff of the org can view their keys (prefix only — hashes are useless)
DROP POLICY IF EXISTS api_keys_select ON public.api_keys;
CREATE POLICY api_keys_select ON public.api_keys
  FOR SELECT TO authenticated USING (public.is_org_staff(org_id));

-- Only the creating staff member is recorded as creator
DROP POLICY IF EXISTS api_keys_insert ON public.api_keys;
CREATE POLICY api_keys_insert ON public.api_keys
  FOR INSERT TO authenticated WITH CHECK (
    public.is_org_staff(org_id) AND created_by = auth.uid()
  );

-- Staff can revoke (set revoked_at); no DELETE policy by design
DROP POLICY IF EXISTS api_keys_update ON public.api_keys;
CREATE POLICY api_keys_update ON public.api_keys
  FOR UPDATE TO authenticated USING (public.is_org_staff(org_id))
  WITH CHECK (public.is_org_staff(org_id));
