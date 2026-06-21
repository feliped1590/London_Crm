-- =============================================================================
-- CLEANUP PILOT DATASET (LOGICAL CLEANUP ONLY)
-- =============================================================================
-- NAO EXECUTAR EM PRODUCAO.
-- NAO EXECUTAR EM STAGING (cansbrrwrprcycjvgvqm).
-- EXECUTAR SOMENTE EM crm-qualyvac-restore-test (nsnmlleplpzsefzkuxlb).
-- SEM TRUNCATE. SEM DELETE FORA DO NAMESPACE PILOTO.
-- =============================================================================

-- Parametros obrigatorios antes da execucao:
--   set app.pilot_target_ref = 'nsnmlleplpzsefzkuxlb';
--   set app.pilot_target_name = 'crm-qualyvac-restore-test';
--   set app.pilot_execution_approved = 'YES';
--   set app.pilot_cleanup_execute = 'NO'; -- NO para preview, YES para executar

do $$
declare
  v_target_ref text := current_setting('app.pilot_target_ref', true);
  v_target_name text := current_setting('app.pilot_target_name', true);
  v_execution_approved text := current_setting('app.pilot_execution_approved', true);
begin
  if v_target_ref is null or v_target_name is null or v_execution_approved is null then
    raise exception 'Hard-stop cleanup: defina app.pilot_target_ref, app.pilot_target_name e app.pilot_execution_approved.';
  end if;
  if v_target_ref <> 'nsnmlleplpzsefzkuxlb' then
    raise exception 'Hard-stop cleanup: ref invalido (%).', coalesce(v_target_ref, 'null');
  end if;
  if v_target_ref = 'cansbrrwrprcycjvgvqm' then
    raise exception 'Hard-stop cleanup: staging detectado.';
  end if;
  if v_target_name <> 'crm-qualyvac-restore-test' then
    raise exception 'Hard-stop cleanup: nome alvo invalido (%).', coalesce(v_target_name, 'null');
  end if;
  if coalesce(v_execution_approved, 'NO') <> 'YES' then
    raise exception 'Hard-stop cleanup: app.pilot_execution_approved deve ser YES.';
  end if;
end $$;

-- PREVIEW (sempre executar antes dos deletes)
select 'notifications' as table_name, count(*) as to_delete
from public.notifications
where title like 'Notif PILOTO_MIGRACAO_20260621 %'
union all
select 'tasks', count(*) from public.tasks
where title ilike 'TASK PILOTO_MIGRACAO_20260621 %'
union all
select 'order_items', count(*)
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.number like 'ORD-PIL-%'
union all
select 'orders', count(*) from public.orders
where number like 'ORD-PIL-%'
union all
select 'proposal_items', count(*)
from public.proposal_items pi
join public.proposals p on p.id = pi.proposal_id
where p.number like 'PROP-PIL-%'
union all
select 'proposals', count(*) from public.proposals
where number like 'PROP-PIL-%'
union all
select 'deals', count(*) from public.deals
where name ilike 'DEAL PILOTO %'
union all
select 'contacts', count(*) from public.contacts
where first_name ilike 'CONTATO PILOTO %'
union all
select 'products', count(*) from public.products
where sku like 'PIL-SKU-%'
  and nome_impresso like 'PILOTO IMPRESSO %'
union all
select 'companies', count(*) from public.companies
where name ilike 'CLIENTE PILOTO %'
union all
select 'sales_reps', count(*) from public.sales_reps
where name like 'Vendedor Piloto %'
union all
select 'carriers', count(*) from public.carriers
where name ilike 'CARRIER PILOTO %'
  and erp_code in (999001, 999002)
union all
select 'user_roles', count(*) from public.user_roles
where user_id in (
  select user_id from public.profiles
  where full_name in ('Admin Piloto','Vendedor Piloto','Assistente Piloto')
)
union all
select 'user_tenants', count(*) from public.user_tenants
where user_id in (
  select user_id from public.profiles
  where full_name in ('Admin Piloto','Vendedor Piloto','Assistente Piloto')
)
union all
select 'profiles', count(*) from public.profiles
where full_name in ('Admin Piloto','Vendedor Piloto','Assistente Piloto')
union all
select 'legal_entities', count(*) from public.legal_entities
where name in ('Empresa Piloto A','Empresa Piloto B')
union all
select 'tenants', count(*) from public.tenants
where slug = 'piloto-migracao-20260621';

-- EXECUCAO CONTROLADA DOS DELETES
-- Por seguranca, os deletes so executam se app.pilot_cleanup_execute = 'YES'.
do $$
declare
  v_exec text := current_setting('app.pilot_cleanup_execute', true);
begin
  if v_exec is null or coalesce(v_exec, 'NO') <> 'YES' then
    raise notice 'Cleanup em modo PREVIEW. Defina app.pilot_cleanup_execute=YES para executar deletes.';
    return;
  end if;

  -- Ordem inversa de dependencia
  delete from public.notifications
  where title like 'Notif PILOTO_MIGRACAO_20260621 %';

  delete from public.tasks
  where title ilike 'TASK PILOTO_MIGRACAO_20260621 %';

  delete from public.order_items
  where order_id in (
    select id from public.orders where number like 'ORD-PIL-%'
  );

  delete from public.orders
  where number like 'ORD-PIL-%';

  delete from public.proposal_items
  where proposal_id in (
    select id from public.proposals where number like 'PROP-PIL-%'
  );

  delete from public.proposals
  where number like 'PROP-PIL-%';

  delete from public.deals
  where name ilike 'DEAL PILOTO %';

  delete from public.contacts
  where first_name ilike 'CONTATO PILOTO %';

  delete from public.products
  where sku like 'PIL-SKU-%'
    and nome_impresso like 'PILOTO IMPRESSO %';

  delete from public.companies
  where name ilike 'CLIENTE PILOTO %';

  delete from public.sales_reps
  where name like 'Vendedor Piloto %';

  delete from public.carriers
  where name ilike 'CARRIER PILOTO %'
    and erp_code in (999001, 999002);

  delete from public.user_roles
  where user_id in (
    select user_id from public.profiles
    where full_name in ('Admin Piloto','Vendedor Piloto','Assistente Piloto')
  );

  delete from public.user_tenants
  where user_id in (
    select user_id from public.profiles
    where full_name in ('Admin Piloto','Vendedor Piloto','Assistente Piloto')
  );

  delete from public.profiles
  where full_name in ('Admin Piloto','Vendedor Piloto','Assistente Piloto');

  delete from public.legal_entities
  where name in ('Empresa Piloto A','Empresa Piloto B');

  delete from public.tenants
  where slug = 'piloto-migracao-20260621';
end $$;
