
-- =========================================================
-- 1) EXTENSÃO DA TABELA notifications (idempotente)
-- =========================================================
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS legal_entity_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS origin_module text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS origin_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_by uuid;

-- Constraint de status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_status_check') THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_status_check
      CHECK (status IN ('pending','resolved','archived'));
  END IF;
END $$;

-- Constraint de type (inclui valor legado 'transfer_request' já presente em prod)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check') THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (type IN ('info','alert','approval','task','system','transfer_request'));
  END IF;
END $$;

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_notifications_user_status_created
  ON public.notifications (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_active
  ON public.notifications (user_id, is_read)
  WHERE is_read = false AND status <> 'archived';

CREATE INDEX IF NOT EXISTS idx_notifications_dedup
  ON public.notifications (user_id, origin_module, origin_id, type, created_at DESC)
  WHERE origin_module IS NOT NULL AND origin_id IS NOT NULL;

-- =========================================================
-- 2) REALTIME (idempotente)
-- =========================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- =========================================================
-- 3) RPCs (apenas próprio usuário)
-- =========================================================
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
     SET is_read = true,
         read_at = COALESCE(read_at, now())
   WHERE id = p_id
     AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.notifications
       SET is_read = true,
           read_at = COALESCE(read_at, now())
     WHERE user_id = auth.uid()
       AND is_read = false
       AND status <> 'archived'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_notification(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
     SET status = 'archived',
         is_read = true,
         read_at = COALESCE(read_at, now())
   WHERE id = p_id
     AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
    FROM public.notifications
   WHERE user_id = auth.uid()
     AND is_read = false
     AND status <> 'archived';
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_notification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;

-- =========================================================
-- 4) HELPER: inserir notificação com deduplicação de 24h
-- =========================================================
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_user_id uuid,
  p_tenant_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_origin_module text DEFAULT NULL,
  p_origin_id uuid DEFAULT NULL,
  p_action_url text DEFAULT NULL,
  p_legal_entity_id uuid DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;
  IF p_created_by IS NOT NULL AND p_created_by = p_user_id THEN
    RETURN NULL; -- não notificar a si mesmo
  END IF;

  -- Deduplicação 24h por (user, module, origin_id, type)
  IF p_origin_module IS NOT NULL AND p_origin_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.notifications
       WHERE user_id = p_user_id
         AND origin_module = p_origin_module
         AND origin_id = p_origin_id
         AND type = p_type
         AND created_at > now() - interval '24 hours'
    ) THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.notifications (
    user_id, tenant_id, type, title, message,
    origin_module, origin_id, action_url, legal_entity_id,
    created_by, metadata, link
  ) VALUES (
    p_user_id, p_tenant_id, p_type, p_title, p_message,
    p_origin_module, p_origin_id, p_action_url, p_legal_entity_id,
    p_created_by, p_metadata, p_action_url
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- =========================================================
-- 5) TRIGGERS — fase 1
-- =========================================================

-- 5.1 Tarefa atribuída
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.assigned_to IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.assigned_to::text,'') = COALESCE(NEW.assigned_to::text,'') THEN
    RETURN NEW;
  END IF;

  PERFORM public.enqueue_notification(
    p_user_id        => NEW.assigned_to,
    p_tenant_id      => NEW.tenant_id,
    p_type           => 'task',
    p_title          => 'Nova tarefa atribuída',
    p_message        => COALESCE(NEW.title, 'Você recebeu uma nova tarefa.'),
    p_origin_module  => 'tasks',
    p_origin_id      => NEW.id,
    p_action_url     => '/tasks',
    p_created_by     => COALESCE(v_actor, NEW.created_by)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
CREATE TRIGGER trg_notify_task_assigned
AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- 5.2 Pedido aguardando aprovação → notifica admins do tenant
CREATE OR REPLACE FUNCTION public.notify_order_approval_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin record;
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;

  FOR v_admin IN
    SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      JOIN public.user_tenants ut
        ON ut.user_id = ur.user_id
       AND ut.tenant_id = NEW.tenant_id
     WHERE ur.role IN ('admin','developer')
  LOOP
    PERFORM public.enqueue_notification(
      p_user_id        => v_admin.user_id,
      p_tenant_id      => NEW.tenant_id,
      p_type           => 'approval',
      p_title          => 'Pedido aguardando aprovação',
      p_message        => 'Há um pedido aguardando sua análise (' || NEW.request_type || ').',
      p_origin_module  => 'orders',
      p_origin_id      => NEW.order_id,
      p_action_url     => '/orders',
      p_created_by     => COALESCE(v_actor, NEW.requested_by)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_approval_pending ON public.order_approval_requests;
CREATE TRIGGER trg_notify_order_approval_pending
AFTER INSERT ON public.order_approval_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_order_approval_pending();

-- 5.3 Erro de integração ERP do pedido
CREATE OR REPLACE FUNCTION public.notify_order_sync_error()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_targets uuid[];
  v_uid uuid;
BEGIN
  IF NEW.status NOT IN ('error','failed','permanent_failure','blocked_validation') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT created_by, sales_rep_id, legal_entity_id
    INTO v_order
    FROM public.orders WHERE id = NEW.order_id;

  v_targets := ARRAY(
    SELECT DISTINCT x FROM unnest(ARRAY[
      v_order.created_by,
      (SELECT usr.user_id FROM public.user_sales_reps usr
        WHERE usr.sales_rep_id = v_order.sales_rep_id LIMIT 1)
    ]) AS t(x) WHERE x IS NOT NULL
  );

  FOREACH v_uid IN ARRAY v_targets LOOP
    PERFORM public.enqueue_notification(
      p_user_id        => v_uid,
      p_tenant_id      => NEW.tenant_id,
      p_type           => 'alert',
      p_title          => 'Erro de integração ERP',
      p_message        => COALESCE(NEW.error_message, 'O pedido não pôde ser sincronizado com o ERP.'),
      p_origin_module  => 'orders',
      p_origin_id      => NEW.order_id,
      p_action_url     => '/orders',
      p_legal_entity_id=> v_order.legal_entity_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_sync_error ON public.order_sync_queue;
CREATE TRIGGER trg_notify_order_sync_error
AFTER INSERT OR UPDATE OF status ON public.order_sync_queue
FOR EACH ROW EXECUTE FUNCTION public.notify_order_sync_error();
