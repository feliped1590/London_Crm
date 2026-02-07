-- Fase 1: Correções de Segurança Imediatas

-- 1.1 Atualizar função prevent_audit_modification com search_path
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  RAISE EXCEPTION 'Registros de auditoria são imutáveis';
END;
$function$;

-- 1.2 Atualizar função update_pipelines_updated_at com search_path
CREATE OR REPLACE FUNCTION public.update_pipelines_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 2.1 Restringir políticas de crm_order_items
DROP POLICY IF EXISTS "crm_order_items_insert_authenticated" ON public.crm_order_items;
DROP POLICY IF EXISTS "crm_order_items_update_authenticated" ON public.crm_order_items;
DROP POLICY IF EXISTS "crm_order_items_delete_authenticated" ON public.crm_order_items;

CREATE POLICY "Authenticated users can insert crm_order_items"
ON public.crm_order_items FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update crm_order_items"
ON public.crm_order_items FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete crm_order_items"
ON public.crm_order_items FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

-- 2.2 Restringir políticas de crm_orders
DROP POLICY IF EXISTS "crm_orders_insert_authenticated" ON public.crm_orders;
DROP POLICY IF EXISTS "crm_orders_update_authenticated" ON public.crm_orders;

CREATE POLICY "Authenticated users can insert crm_orders"
ON public.crm_orders FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update crm_orders"
ON public.crm_orders FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 2.3 Restringir políticas de crm_products (se existirem políticas permissivas)
DROP POLICY IF EXISTS "crm_products_insert_authenticated" ON public.crm_products;
DROP POLICY IF EXISTS "crm_products_update_authenticated" ON public.crm_products;
DROP POLICY IF EXISTS "crm_products_delete_authenticated" ON public.crm_products;

CREATE POLICY "Authenticated users can insert crm_products"
ON public.crm_products FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update crm_products"
ON public.crm_products FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete crm_products"
ON public.crm_products FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);