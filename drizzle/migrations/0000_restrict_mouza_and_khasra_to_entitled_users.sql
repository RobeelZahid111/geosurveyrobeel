CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = _user_id
      AND (
        (s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'trialing' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at > now())
      )
  )
$$;

REVOKE ALL ON FUNCTION public.has_active_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_access(uuid) TO authenticated;

DROP POLICY IF EXISTS "Signed-in users can read mouza catalogue" ON public.mouza_layers;
CREATE POLICY "Entitled users can read mouza catalogue"
ON public.mouza_layers
FOR SELECT
TO authenticated
USING (public.has_active_access(auth.uid()));

DROP POLICY IF EXISTS "Signed-in users can read khasra data" ON storage.objects;
CREATE POLICY "Entitled users can read khasra data"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'khasra-data'::text AND public.has_active_access(auth.uid()));