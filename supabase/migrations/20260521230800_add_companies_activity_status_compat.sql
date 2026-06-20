-- Fase 06 — Compatibilidade para recriação do Supabase Staging
-- Motivo: a migration 20260521230824 cria a função public.get_activity_status_counts()
-- usando public.companies.activity_status. Em ambiente staging novo, esta coluna
-- ainda não existe nesse ponto da cadeia de migrations.

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS activity_status text;
