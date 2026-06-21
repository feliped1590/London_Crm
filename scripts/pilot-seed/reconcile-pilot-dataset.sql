-- =============================================================================
-- RECONCILE PILOT DATASET (READ-ONLY)
-- =============================================================================
-- Script de reconciliacao do dataset piloto.
-- Nao faz escrita em banco.
-- =============================================================================

with expected(table_name, expected_count) as (
  values
    ('tenants', 1),
    ('legal_entities', 2),
    ('companies', 20),
    ('contacts', 20),
    ('products', 20),
    ('carriers', 2),
    ('sales_reps', 2),
    ('deals', 10),
    ('proposals', 10),
    ('proposal_items', 20),
    ('orders', 10),
    ('order_items', 20),
    ('tasks', 5),
    ('notifications', 5)
),
actual as (
  select 'tenants' as table_name, count(*)::bigint as actual_count
  from public.tenants where slug = 'piloto-migracao-20260621'
  union all
  select 'legal_entities', count(*) from public.legal_entities
  where name in ('Empresa Piloto A', 'Empresa Piloto B')
  union all
  select 'companies', count(*) from public.companies
  where name ilike 'CLIENTE PILOTO %'
  union all
  select 'contacts', count(*) from public.contacts
  where first_name ilike 'CONTATO PILOTO %'
  union all
  select 'products', count(*) from public.products
  where sku like 'PIL-SKU-%'
  union all
  select 'carriers', count(*) from public.carriers
  where name ilike 'CARRIER PILOTO %'
  union all
  select 'sales_reps', count(*) from public.sales_reps
  where name like 'Vendedor Piloto %'
  union all
  select 'deals', count(*) from public.deals
  where name ilike 'DEAL PILOTO %'
  union all
  select 'proposals', count(*) from public.proposals
  where number like 'PROP-PIL-%'
  union all
  select 'proposal_items', count(*)
  from public.proposal_items pi
  join public.proposals p on p.id = pi.proposal_id
  where p.number like 'PROP-PIL-%'
  union all
  select 'orders', count(*) from public.orders
  where number like 'ORD-PIL-%'
  union all
  select 'order_items', count(*)
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.number like 'ORD-PIL-%'
  union all
  select 'tasks', count(*) from public.tasks
  where title ilike 'TASK PILOTO_MIGRACAO_20260621 %'
  union all
  select 'notifications', count(*) from public.notifications
  where title like 'Notif PILOTO_MIGRACAO_20260621 %'
)
select
  e.table_name,
  e.expected_count,
  coalesce(a.actual_count, 0) as actual_count,
  coalesce(a.actual_count, 0) - e.expected_count as delta,
  case when coalesce(a.actual_count, 0) = e.expected_count then 'OK' else 'DIVERGENTE' end as status
from expected e
left join actual a on a.table_name = e.table_name
order by e.table_name;

-- FKs orfas criticas (esperado = 0)
select 'proposal_items_without_proposal' as check_name, count(*) as orphan_count
from public.proposal_items pi
left join public.proposals p on p.id = pi.proposal_id
where p.id is null
union all
select 'proposal_items_without_product', count(*)
from public.proposal_items pi
left join public.products pr on pr.id = pi.product_id
where pr.id is null
union all
select 'orders_without_proposal', count(*)
from public.orders o
left join public.proposals p on p.id = o.proposal_id
where o.number like 'ORD-PIL-%'
  and p.id is null
union all
select 'order_items_without_order', count(*)
from public.order_items oi
left join public.orders o on o.id = oi.order_id
where o.id is null
union all
select 'order_items_without_product', count(*)
from public.order_items oi
left join public.products pr on pr.id = oi.product_id
where pr.id is null;

-- Status invalidos para propostas/pedidos piloto (esperado = 0 linhas)
-- Fase 19C: enum real do alvo usa proposal_status/order_status em pt-BR.
select 'invalid_proposal_status' as issue_type, p.id::text as entity_id, p.status::text as current_status
from public.proposals p
where p.number like 'PROP-PIL-%'
  and p.status not in ('rascunho','recusada')
union all
select 'invalid_order_status', o.id::text, o.status::text
from public.orders o
where o.number like 'ORD-PIL-%'
  and o.status not in ('pendente','em_producao');

-- Vínculos ausentes tenant/legal entity em entidades piloto (esperado = 0 linhas)
select
  c.id as company_id,
  c.name as company_name,
  case when c.tenant_id is null then 'tenant_missing' end as tenant_issue,
  case when c.legal_entity_id is null then 'legal_entity_missing' end as legal_entity_issue
from public.companies c
where c.name ilike 'CLIENTE PILOTO %'
  and (c.tenant_id is null or c.legal_entity_id is null);

-- Possivel colateral de integracao (heuristica)
-- Fase 17A: logs/filas reais fora de escopo; checagem tolerante a tabela ausente.
do $$
declare
  v_count bigint;
begin
  if to_regclass('public.order_sync_queue') is not null then
    execute 'select count(*) from public.order_sync_queue' into v_count;
    raise notice 'order_sync_queue_nonzero: %', v_count;
  else
    raise notice 'order_sync_queue ausente (OK para este ambiente).';
  end if;

  if to_regclass('public.product_sync_queue') is not null then
    execute 'select count(*) from public.product_sync_queue' into v_count;
    raise notice 'product_sync_queue_nonzero: %', v_count;
  else
    raise notice 'product_sync_queue ausente (OK para este ambiente).';
  end if;

  if to_regclass('public.company_sync_queue') is not null then
    execute 'select count(*) from public.company_sync_queue' into v_count;
    raise notice 'company_sync_queue_nonzero: %', v_count;
  else
    raise notice 'company_sync_queue ausente (OK para este ambiente).';
  end if;
end $$;
