-- GO-LIVE: Dropar triggers novamente para limpeza final
DROP TRIGGER IF EXISTS prevent_credit_audit_delete ON public.credit_analysis_audit;
DROP TRIGGER IF EXISTS prevent_credit_audit_update ON public.credit_analysis_audit;
DROP TRIGGER IF EXISTS prevent_credit_audit_changes ON public.credit_analysis_audit;

-- Limpar credit
DELETE FROM public.credit_analysis_audit;
DELETE FROM public.credit_analyses;

-- Limpar deals
DELETE FROM public.deal_stage_history;
DELETE FROM public.deal_audit_log;
DELETE FROM public.deal_checklist_completions;
DELETE FROM public.deal_participants;
DELETE FROM public.deals;

-- Limpar companies
DELETE FROM public.company_audit_log;
DELETE FROM public.contacts;
DELETE FROM public.companies;

-- Limpar ERP
DELETE FROM public.crm_client_addresses;
DELETE FROM public.crm_order_items;
DELETE FROM public.crm_orders;
DELETE FROM public.crm_products;
DELETE FROM public.crm_clients;

-- Recriar proteção de auditoria
CREATE TRIGGER prevent_credit_audit_delete
    BEFORE DELETE ON public.credit_analysis_audit
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_modification();

CREATE TRIGGER prevent_credit_audit_update
    BEFORE UPDATE ON public.credit_analysis_audit
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_modification();