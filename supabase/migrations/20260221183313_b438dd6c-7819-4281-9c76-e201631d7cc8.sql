ALTER TABLE public.legal_entities ADD COLUMN logo_url TEXT;

-- Criar bucket para logos de entidades jurídicas
INSERT INTO storage.buckets (id, name, public) VALUES ('legal-entity-logos', 'legal-entity-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Política de leitura pública
CREATE POLICY "Public read access for legal entity logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'legal-entity-logos');

-- Política de upload para autenticados
CREATE POLICY "Authenticated users can upload legal entity logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'legal-entity-logos');

-- Política de update para autenticados
CREATE POLICY "Authenticated users can update legal entity logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'legal-entity-logos');

-- Política de delete para autenticados
CREATE POLICY "Authenticated users can delete legal entity logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'legal-entity-logos');