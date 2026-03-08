
-- Table for credit document uploads
CREATE TABLE public.credit_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view credit documents"
  ON public.credit_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert credit documents"
  ON public.credit_documents FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete credit documents"
  ON public.credit_documents FOR DELETE TO authenticated USING (true);

-- Storage bucket for credit documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('credit-documents', 'credit-documents', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload credit docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'credit-documents');

CREATE POLICY "Authenticated users can view credit docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'credit-documents');

CREATE POLICY "Authenticated users can delete credit docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'credit-documents');
