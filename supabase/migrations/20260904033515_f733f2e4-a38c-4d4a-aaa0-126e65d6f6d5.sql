CREATE TABLE public.mouza_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district text,
  tehsil text NOT NULL,
  qh text NOT NULL,
  mouza text NOT NULL,
  mouza_id text NOT NULL,
  file_path text NOT NULL,
  feature_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mouza_id)
);

GRANT SELECT ON public.mouza_layers TO authenticated;
GRANT ALL ON public.mouza_layers TO service_role;

ALTER TABLE public.mouza_layers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read mouza catalogue"
ON public.mouza_layers FOR SELECT TO authenticated USING (true);

CREATE INDEX mouza_layers_tehsil_idx ON public.mouza_layers (tehsil);
CREATE INDEX mouza_layers_qh_idx ON public.mouza_layers (tehsil, qh);
CREATE INDEX mouza_layers_search_idx ON public.mouza_layers USING gin (
  to_tsvector('simple', coalesce(tehsil,'') || ' ' || coalesce(qh,'') || ' ' || coalesce(mouza,''))
);

CREATE TRIGGER mouza_layers_set_updated_at
BEFORE UPDATE ON public.mouza_layers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();