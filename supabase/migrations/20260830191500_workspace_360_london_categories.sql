-- Replace Qualyvac commercial follow-up seeds with London operational categories.
-- Does not delete historical follow-ups; deactivates incompatible group names.
-- Never seeds with the zero UUID.

BEGIN;

UPDATE public.followup_groups
SET is_active = false, updated_at = now()
WHERE lower(name) IN ('financeiro', 'orçamento', 'orcamento', 'comercial', 'cadastro', 'pedido');

WITH london_groups (name, icon, color, sort_order) AS (
  VALUES
    ('Documentação', 'FileText', '#0EA5E9', 10),
    ('Consultoria', 'Briefcase', '#6366F1', 20),
    ('Reunião', 'Users', '#22C55E', 30),
    ('Pendência do cliente', 'Clock', '#F59E0B', 40),
    ('Pendência interna', 'ListTodo', '#64748B', 50),
    ('Renovação', 'RefreshCw', '#14B8A6', 60),
    ('Treinamento', 'GraduationCap', '#8B5CF6', 70),
    ('Visita técnica', 'MapPin', '#F97316', 80),
    ('Contrato', 'FileSignature', '#0F766E', 90)
),
tenant_actors AS (
  SELECT t.id AS tenant_id,
         COALESCE(
           (SELECT p.user_id FROM public.profiles p WHERE p.active_tenant_id = t.id AND p.user_id IS NOT NULL LIMIT 1),
           (SELECT ut.user_id FROM public.user_tenants ut WHERE ut.tenant_id = t.id LIMIT 1)
         ) AS actor_id
  FROM public.tenants t
)
INSERT INTO public.followup_groups (tenant_id, name, icon, color, sort_order, is_active, created_by)
SELECT ta.tenant_id, lg.name, lg.icon, lg.color, lg.sort_order, true, ta.actor_id
FROM tenant_actors ta
CROSS JOIN london_groups lg
WHERE ta.actor_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.followup_groups g
    WHERE g.tenant_id = ta.tenant_id AND lower(g.name) = lower(lg.name)
  );

INSERT INTO public.followup_subgroups (
  tenant_id, group_id, name, sort_order, is_active, requires_description, created_by
)
SELECT g.tenant_id, g.id, 'Registro', 10, true, true, g.created_by
FROM public.followup_groups g
WHERE g.is_active
  AND g.name IN (
    'Documentação','Consultoria','Reunião','Pendência do cliente','Pendência interna',
    'Renovação','Treinamento','Visita técnica','Contrato'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.followup_subgroups s
    WHERE s.group_id = g.id AND lower(s.name) = 'registro'
  );

WITH london_docs (name, description, default_warning_days, default_validity_days) AS (
  VALUES
    ('Contrato social', 'Documento societário', 30, 365),
    ('Procuração', 'Instrumento de representação', 30, 365),
    ('Documento de identificação', 'RG, CNH ou equivalente', 15, NULL),
    ('Comprovante de endereço', 'Comprovante recente', 15, 90),
    ('Contrato de prestação', 'Contrato do serviço', 45, 365),
    ('Certidão', 'Certidão operacional ou fiscal', 20, 180),
    ('Relatório técnico', 'Entrega de consultoria', 7, NULL)
),
tenant_actors AS (
  SELECT t.id AS tenant_id,
         COALESCE(
           (SELECT p.user_id FROM public.profiles p WHERE p.active_tenant_id = t.id AND p.user_id IS NOT NULL LIMIT 1),
           (SELECT ut.user_id FROM public.user_tenants ut WHERE ut.tenant_id = t.id LIMIT 1)
         ) AS actor_id
  FROM public.tenants t
)
INSERT INTO public.document_types (
  tenant_id, name, description, default_warning_days, default_validity_days, created_by
)
SELECT ta.tenant_id, d.name, d.description, d.default_warning_days, d.default_validity_days, ta.actor_id
FROM tenant_actors ta
CROSS JOIN london_docs d
WHERE ta.actor_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.document_types dt
    WHERE dt.tenant_id = ta.tenant_id AND lower(dt.name) = lower(d.name)
  );

COMMIT;
