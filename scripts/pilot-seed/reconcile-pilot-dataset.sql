-- =============================================================================
-- RECONCILE PILOT DATASET (READ-ONLY)
-- =============================================================================
-- Script de reconciliacao do dataset piloto.
-- Nao faz escrita em banco.
-- =============================================================================

with profile_ctx as (
  select count(*)::bigint as pilot_profiles_total
  from public.profiles
  where full_name in ('Admin Piloto', 'Vendedor Piloto', 'Assistente Piloto')
),
expected_base(table_name, expected_count) as (
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
    ('tasks', 5)
),
expected(table_name, expected_count) as (
  select table_name, expected_count from expected_base
  union all
  select
    'notifications'::text as table_name,
    case when (select pilot_profiles_total from profile_ctx) > 0 then 5 else 0 end as expected_count
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
    and nome_impresso like 'PILOTO IMPRESSO %'
  union all
  select 'carriers', count(*) from public.carriers
  where name ilike 'CARRIER PILOTO %'
    and erp_code in (999001, 999002)
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

-- Contexto da expectativa de notifications para evitar falso positivo:
-- sem profiles piloto, notifications=0 e comportamento esperado do seed.
with profile_ctx as (
  select count(*)::bigint as pilot_profiles_total
  from public.profiles
  where full_name in ('Admin Piloto', 'Vendedor Piloto', 'Assistente Piloto')
),
notif_ctx as (
  select count(*)::bigint as notifications_actual
  from public.notifications
  where title like 'Notif PILOTO_MIGRACAO_20260621 %'
),
expected_ctx as (
  select
    p.pilot_profiles_total,
    n.notifications_actual,
    case when p.pilot_profiles_total > 0 then 5::bigint else 0::bigint end as expected_notifications
  from profile_ctx p
  cross join notif_ctx n
)
select
  pilot_profiles_total,
  notifications_actual,
  expected_notifications,
  case
    when notifications_actual = expected_notifications then 'OK'
    else 'DIVERGENTE'
  end as status,
  case
    when pilot_profiles_total = 0 then 'notifications skipped because pilot profiles were not present'
    else 'notifications expected from direct seed insert block'
  end as reason
from expected_ctx;

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

-- Carriers piloto sem ERP code (esperado = 0)
select
  c.id as carrier_id,
  c.name as carrier_name,
  c.erp_code
from public.carriers c
where c.name ilike 'CARRIER PILOTO %'
  and c.erp_code is null;

-- Duplicidade tecnica em products piloto (esperado = 0 linhas)
with pilot_products as (
  select *
  from public.products
  where sku like 'PIL-SKU-%'
    and nome_impresso like 'PILOTO IMPRESSO %'
    and active = true
)
select
  p.tenant_id,
  coalesce(p.tipo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) as tipo_key,
  coalesce(p.grupo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) as grupo_key,
  coalesce(p.subgrupo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) as subgrupo_key,
  coalesce(p.family_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) as family_key,
  coalesce(p.class_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) as class_key,
  coalesce(p.width::text, '-1') as width_key,
  coalesce(p.length::text, '-1') as length_key,
  coalesce(p.thickness::text, '-1') as thickness_key,
  coalesce(p.nome_impresso, '') as nome_impresso_key,
  count(*) as duplicate_count
from pilot_products p
group by 1,2,3,4,5,6,7,8,9,10
having count(*) > 1;

-- Nome impresso piloto fora do tenant piloto (esperado = 0 linhas)
select
  p.id as product_id,
  p.sku,
  p.nome_impresso,
  t.slug as tenant_slug
from public.products p
left join public.tenants t on t.id = p.tenant_id
where p.nome_impresso like 'PILOTO IMPRESSO %'
  and coalesce(t.slug, '') <> 'piloto-migracao-20260621';

-- Possivel colateral de integracao (heuristica)
-- Fase 17A: logs/filas reais fora de escopo; checagem tolerante a tabela ausente.
do $$
declare
  v_count bigint;
  v_pilot_products bigint;
  v_pilot_queue_rows bigint;
  v_outside_pilot_queue_rows bigint;
  v_pending_rows bigint;
  v_non_pending_rows bigint;
  v_processed_rows bigint;
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

    execute $sql$
      select count(*)
      from public.products p
      where p.sku like 'PIL-SKU-%'
         or p.nome_impresso like 'PILOTO IMPRESSO %'
    $sql$ into v_pilot_products;

    execute $sql$
      select count(*)
      from public.product_sync_queue q
      join public.products p on p.id = q.product_id
      where p.sku like 'PIL-SKU-%'
         or p.nome_impresso like 'PILOTO IMPRESSO %'
    $sql$ into v_pilot_queue_rows;

    execute $sql$
      select count(*)
      from public.product_sync_queue q
      left join public.products p on p.id = q.product_id
      where p.id is null
         or (p.sku not like 'PIL-SKU-%' and coalesce(p.nome_impresso, '') not like 'PILOTO IMPRESSO %')
    $sql$ into v_outside_pilot_queue_rows;

    execute 'select count(*) from public.product_sync_queue where status = ''pending''' into v_pending_rows;
    execute 'select count(*) from public.product_sync_queue where status <> ''pending''' into v_non_pending_rows;
    execute 'select count(*) from public.product_sync_queue where processed_at is not null' into v_processed_rows;

    if v_pilot_products = 20
       and v_pilot_queue_rows = 20
       and v_outside_pilot_queue_rows = 0
       and v_pending_rows = 20
       and v_non_pending_rows = 0
       and v_processed_rows = 0 then
      raise notice 'product_sync_queue_classification: EXPECTED_PENDING_EXTERNAL (20/20 produtos piloto enfileirados por trigger; drainer fora desta trilha).';
    else
      raise notice 'product_sync_queue_classification: DIVERGENTE (pilot_products=%, pilot_queue=%, outside_pilot=%, pending=%, non_pending=%, processed=%).',
        v_pilot_products, v_pilot_queue_rows, v_outside_pilot_queue_rows, v_pending_rows, v_non_pending_rows, v_processed_rows;
    end if;
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
