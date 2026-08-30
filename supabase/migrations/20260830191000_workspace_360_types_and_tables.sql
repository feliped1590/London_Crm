-- Workspace 360: enums and operational tables (London).
-- Re-runnable. Does not assume a single tenant.
-- Does not modify 20260830180000 (already applied on CRM_London).

BEGIN;

DO $$ BEGIN
  CREATE TYPE public.task_waiting_on AS ENUM ('internal', 'customer', 'third_party');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_kind AS ENUM (
    'follow_up', 'documentation', 'meeting', 'visit', 'training',
    'renewal', 'internal', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.customer_document_status AS ENUM (
    'not_requested', 'requested', 'waiting_customer', 'received',
    'in_review', 'approved', 'rejected', 'expired', 'waived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.client_contract_status AS ENUM (
    'draft', 'active', 'pending_renewal', 'expired', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.service_engagement_status AS ENUM (
    'planned', 'active', 'paused', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  default_validity_days integer,
  default_warning_days integer NOT NULL DEFAULT 30,
  requires_approval boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_types_name_len_chk CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT document_types_validity_chk CHECK (default_validity_days IS NULL OR default_validity_days > 0),
  CONSTRAINT document_types_warning_chk CHECK (default_warning_days >= 0)
);

CREATE TABLE IF NOT EXISTS public.customer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES public.document_types(id) ON DELETE RESTRICT,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  service_engagement_id uuid,
  status public.customer_document_status NOT NULL DEFAULT 'not_requested',
  responsible_user_id uuid,
  customer_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  requested_at timestamptz,
  due_date date,
  received_at timestamptz,
  reviewed_at timestamptz,
  expires_at date,
  renewal_interval_months integer,
  next_due_date date,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_documents_notes_len_chk CHECK (notes IS NULL OR char_length(notes) <= 5000),
  CONSTRAINT customer_documents_renewal_chk CHECK (renewal_interval_months IS NULL OR renewal_interval_months > 0)
);

CREATE TABLE IF NOT EXISTS public.client_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  contract_number text,
  status public.client_contract_status NOT NULL DEFAULT 'draft',
  starts_on date,
  ends_on date,
  renewal_interval_months integer,
  next_renewal_on date,
  responsible_user_id uuid,
  customer_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_contracts_title_chk CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  CONSTRAINT client_contracts_notes_chk CHECK (notes IS NULL OR char_length(notes) <= 5000),
  CONSTRAINT client_contracts_renewal_chk CHECK (renewal_interval_months IS NULL OR renewal_interval_months > 0)
);

CREATE TABLE IF NOT EXISTS public.service_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.client_contracts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  service_type text NOT NULL DEFAULT 'consultoria',
  title text NOT NULL,
  status public.service_engagement_status NOT NULL DEFAULT 'planned',
  starts_on date,
  due_on date,
  completed_on date,
  responsible_user_id uuid,
  customer_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_engagements_title_chk CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  CONSTRAINT service_engagements_type_chk CHECK (char_length(btrim(service_type)) BETWEEN 1 AND 80),
  CONSTRAINT service_engagements_notes_chk CHECK (notes IS NULL OR char_length(notes) <= 5000)
);

CREATE TABLE IF NOT EXISTS public.service_engagement_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES public.service_engagements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT service_engagement_members_role_chk CHECK (role = ANY (ARRAY['owner','member','observer']::text[]))
);

ALTER TABLE public.customer_documents
  DROP CONSTRAINT IF EXISTS customer_documents_service_engagement_id_fkey;
ALTER TABLE public.customer_documents
  ADD CONSTRAINT customer_documents_service_engagement_id_fkey
  FOREIGN KEY (service_engagement_id) REFERENCES public.service_engagements(id) ON DELETE SET NULL;

COMMIT;
