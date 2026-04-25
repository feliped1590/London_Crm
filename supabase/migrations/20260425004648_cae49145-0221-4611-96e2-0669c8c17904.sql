CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

DROP POLICY IF EXISTS "System can insert violation logs" ON public.access_violation_log;
CREATE POLICY "Users can insert own violation logs"
ON public.access_violation_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert company audit logs" ON public.company_audit_log;
CREATE POLICY "Users can insert company audit logs"
ON public.company_audit_log
FOR INSERT
TO authenticated
WITH CHECK (changed_by = auth.uid());

DROP POLICY IF EXISTS "Service role pode inserir auditoria" ON public.credit_analysis_audit;
CREATE POLICY "Users can insert own credit audit"
ON public.credit_analysis_audit
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage addresses" ON public.crm_client_addresses;
CREATE POLICY "Service role can manage addresses"
ON public.crm_client_addresses
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage clients" ON public.crm_clients;
CREATE POLICY "Service role can manage clients"
ON public.crm_clients
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage products" ON public.crm_products;
CREATE POLICY "Service role can manage products"
ON public.crm_products
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can insert deal audit logs" ON public.deal_audit_log;
CREATE POLICY "Service role can insert deal audit logs"
ON public.deal_audit_log
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Deal owners can manage participants" ON public.deal_participants;
CREATE POLICY "Deal owners can manage participants"
ON public.deal_participants
FOR ALL
TO authenticated
USING (added_by = auth.uid() OR user_id = auth.uid())
WITH CHECK (added_by = auth.uid() OR user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert snapshots" ON public.documento_fiscal_snapshot;
CREATE POLICY "Authenticated users can insert fiscal snapshots"
ON public.documento_fiscal_snapshot
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role can update email logs" ON public.email_logs;
CREATE POLICY "Service role can update email logs"
ON public.email_logs
FOR UPDATE
TO service_role
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON public.erp_clients_cache;
CREATE POLICY "Service role full access"
ON public.erp_clients_cache
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage staging" ON public.erp_products_staging;
CREATE POLICY "Service role can manage staging"
ON public.erp_products_staging
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "System can insert sync logs" ON public.google_calendar_sync_logs;
CREATE POLICY "Users can insert own calendar sync logs"
ON public.google_calendar_sync_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "system_insert_notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can insert order audit logs" ON public.order_audit_log;
CREATE POLICY "Service role can insert order audit logs"
ON public.order_audit_log
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "System inserts sync logs" ON public.pipeline_sync_log;
CREATE POLICY "Authenticated users can insert pipeline sync logs"
ON public.pipeline_sync_log
FOR INSERT
TO authenticated
WITH CHECK (triggered_by = auth.uid());

DROP POLICY IF EXISTS "System inserts skip logs" ON public.pipeline_sync_skip_log;
CREATE POLICY "Authenticated users can insert pipeline skip logs"
ON public.pipeline_sync_skip_log
FOR INSERT
TO authenticated
WITH CHECK (triggered_by = auth.uid());

DROP POLICY IF EXISTS "System insert ncm_audit" ON public.product_ncm_audit;
CREATE POLICY "Authenticated users can insert ncm audit"
ON public.product_ncm_audit
FOR INSERT
TO authenticated
WITH CHECK (changed_by = auth.uid());

DROP POLICY IF EXISTS "Service role full access sync logs" ON public.product_sync_log;
CREATE POLICY "Service role full access sync logs"
ON public.product_sync_log
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can insert access logs" ON public.proposal_access_logs;
CREATE POLICY "Service role can insert access logs"
ON public.proposal_access_logs
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can insert reminders" ON public.task_reminders;
DROP POLICY IF EXISTS "Service role can insert task reminders" ON public.task_reminders;
CREATE POLICY "Service role can insert task reminders"
ON public.task_reminders
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can insert user audit log" ON public.user_audit_log;
CREATE POLICY "Users can insert own audit log"
ON public.user_audit_log
FOR INSERT
TO authenticated
WITH CHECK (performed_by = auth.uid());

REVOKE SELECT ON public.whatsapp_instances FROM anon, authenticated;
GRANT SELECT (id, user_id, instance_id, phone_number, name, status, connected_at, created_at, updated_at)
ON public.whatsapp_instances TO authenticated;