-- =============================================================================
-- VALIDATE PILOT DATASET (READ-ONLY)
-- =============================================================================
-- Script somente de leitura para validar o dataset do namespace
-- PILOTO_MIGRACAO_20260621.
-- Nao faz inserts/updates/deletes.
-- =============================================================================

-- Parametro de namespace do piloto
with cfg as (
  select
    'PILOTO_MIGRACAO_20260621'::text as ns,
    'piloto-migracao-20260621'::text as tenant_slug
)
select * from cfg;

-- Presenca de tenant piloto
select id, name, slug
from public.tenants
where slug = 'piloto-migracao-20260621';

-- Presenca de legal entities piloto
select id, tenant_id, name, cnpj
from public.legal_entities
where name in ('Empresa Piloto A', 'Empresa Piloto B')
order by name;

-- Perfis sinteticos (dependente de estrategia auth/profiles)
select user_id, full_name, active_tenant_id, active_legal_entity_id
from public.profiles
where full_name in ('Admin Piloto', 'Vendedor Piloto', 'Assistente Piloto')
order by full_name;

-- Contagem por tabela do escopo principal
select 'companies' as table_name, count(*) as cnt from public.companies where name ilike 'CLIENTE PILOTO %'
union all
select 'contacts', count(*) from public.contacts where first_name ilike 'CONTATO PILOTO %'
union all
select 'products', count(*) from public.products
where sku like 'PIL-SKU-%'
  and nome_impresso like 'PILOTO IMPRESSO %'
union all
select 'carriers', count(*) from public.carriers
where name ilike 'CARRIER PILOTO %'
  and erp_code in (999001, 999002)
union all
select 'sales_reps', count(*) from public.sales_reps where name ilike 'Vendedor Piloto %'
union all
select 'deals', count(*) from public.deals where name ilike 'DEAL PILOTO %'
union all
select 'proposals', count(*) from public.proposals where number like 'PROP-PIL-%'
union all
select 'proposal_items', count(*)
from public.proposal_items pi
join public.proposals p on p.id = pi.proposal_id
where p.number like 'PROP-PIL-%'
union all
select 'orders', count(*) from public.orders where number like 'ORD-PIL-%'
union all
select 'order_items', count(*)
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.number like 'ORD-PIL-%'
union all
select 'tasks', count(*) from public.tasks where title ilike 'TASK PILOTO_MIGRACAO_20260621 %'
union all
select 'notifications', count(*) from public.notifications where title like 'Notif PILOTO_MIGRACAO_20260621 %'
order by table_name;

-- Regra ERP de transportadora piloto (esperado = 0)
select count(*) as pilot_carriers_missing_erp_code
from public.carriers
where name ilike 'CARRIER PILOTO %'
  and erp_code is null;

-- Duplicidade tecnica de produtos piloto (esperado = 0)
with pilot_products as (
  select *
  from public.products
  where sku like 'PIL-SKU-%'
    and nome_impresso like 'PILOTO IMPRESSO %'
    and active = true
)
select count(*) as pilot_products_technical_duplicates
from (
  select
    tenant_id,
    coalesce(tipo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) as tipo_key,
    coalesce(grupo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) as grupo_key,
    coalesce(subgrupo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) as subgrupo_key,
    coalesce(family_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) as family_key,
    coalesce(class_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) as class_key,
    coalesce(width::text, '-1') as width_key,
    coalesce(length::text, '-1') as length_key,
    coalesce(thickness::text, '-1') as thickness_key,
    coalesce(nome_impresso, '') as nome_impresso_key,
    count(*) as dup_count
  from pilot_products
  group by 1,2,3,4,5,6,7,8,9,10
  having count(*) > 1
) dups;

-- Colisao de nome_impresso piloto fora do tenant piloto (esperado = 0)
select count(*) as pilot_nome_impresso_outside_pilot_tenant
from public.products p
left join public.tenants t on t.id = p.tenant_id
where p.nome_impresso like 'PILOTO IMPRESSO %'
  and coalesce(t.slug, '') <> 'piloto-migracao-20260621';

-- Presenca de status esperados em propostas/pedidos
-- Fase 17A: somente status seguros, sem gatilho de integracao externa.
select status, count(*) as cnt
from public.proposals
where number like 'PROP-PIL-%'
group by status
order by status;

select status, count(*) as cnt
from public.orders
where number like 'ORD-PIL-%'
group by status
order by status;

-- Checagem de FK orfa critica (subset)
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

-- Vínculos tenant/legal entity basicos
select
  c.id as company_id,
  c.name as company_name,
  c.tenant_id,
  c.legal_entity_id,
  (t.id is not null) as tenant_exists,
  (le.id is not null) as legal_entity_exists
from public.companies c
left join public.tenants t on t.id = c.tenant_id
left join public.legal_entities le on le.id = c.legal_entity_id
where c.name ilike 'CLIENTE PILOTO %'
order by c.name
limit 50;

-- Registros fora do namespace (amostra de tabelas com padrao de nome)
-- Esperado: nao deve haver registros com prefixo piloto fora do tenant piloto.
select count(*) as pilot_named_companies_outside_pilot_tenant
from public.companies c
left join public.tenants t on t.id = c.tenant_id
where c.name ilike 'CLIENTE PILOTO %'
  and coalesce(t.slug, '') <> 'piloto-migracao-20260621';

-- Sinais de integracao externa (heuristica por tabelas de fila/log)
-- Fase 17A: logs/filas/auditoria reais estao fora do piloto.
-- Este bloco e tolerante a ausencia de tabelas (ambiente pode nao ter as filas).
do $$
declare
  v_count bigint;
begin
  if to_regclass('public.order_sync_queue') is not null then
    execute 'select count(*) from public.order_sync_queue' into v_count;
    raise notice 'order_sync_queue rows: %', v_count;
  else
    raise notice 'order_sync_queue ausente (OK para este ambiente).';
  end if;

  if to_regclass('public.product_sync_queue') is not null then
    execute 'select count(*) from public.product_sync_queue' into v_count;
    raise notice 'product_sync_queue rows: %', v_count;
  else
    raise notice 'product_sync_queue ausente (OK para este ambiente).';
  end if;

  if to_regclass('public.company_sync_queue') is not null then
    execute 'select count(*) from public.company_sync_queue' into v_count;
    raise notice 'company_sync_queue rows: %', v_count;
  else
    raise notice 'company_sync_queue ausente (OK para este ambiente).';
  end if;
end $$;
