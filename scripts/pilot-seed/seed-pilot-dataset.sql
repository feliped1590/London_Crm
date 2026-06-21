-- =============================================================================
-- PILOT SEED DATASET (FASE 17)
-- =============================================================================
-- NAO EXECUTAR EM PRODUCAO.
-- NAO EXECUTAR EM STAGING (cansbrrwrprcycjvgvqm).
-- EXECUTAR SOMENTE EM crm-qualyvac-restore-test (nsnmlleplpzsefzkuxlb).
-- ESTE SCRIPT NAO DEVE SER EXECUTADO SEM APROVACAO EXPLICITA DA JANELA.
-- =============================================================================

-- Parametros obrigatorios antes da execucao (exemplo):
--   set app.pilot_target_ref = 'nsnmlleplpzsefzkuxlb';
--   set app.pilot_target_name = 'crm-qualyvac-restore-test';
--   set app.pilot_execution_approved = 'YES';
-- Politica de seguranca desta fase:
--   - Nao criar auth.users.
--   - Nao usar service_role.
--   - Nao disparar integracoes externas (ERP/PDF/CNPJ/n8n/webhooks).

do $$
declare
  v_target_ref text := current_setting('app.pilot_target_ref', true);
  v_target_name text := current_setting('app.pilot_target_name', true);
  v_approved text := current_setting('app.pilot_execution_approved', true);
  v_hstore_installed boolean;
begin
  if v_target_ref is null or v_target_name is null or v_approved is null then
    raise exception 'Hard-stop: defina app.pilot_target_ref, app.pilot_target_name e app.pilot_execution_approved antes da execucao.';
  end if;

  if v_target_ref <> 'nsnmlleplpzsefzkuxlb' then
    raise exception 'Hard-stop: ref alvo invalido (%). Esperado: nsnmlleplpzsefzkuxlb', v_target_ref;
  end if;

  if v_target_ref = 'cansbrrwrprcycjvgvqm' then
    raise exception 'Hard-stop: staging detectado (%). Execucao proibida.', v_target_ref;
  end if;

  if v_target_name <> 'crm-qualyvac-restore-test' then
    raise exception 'Hard-stop: nome alvo invalido (%). Esperado: crm-qualyvac-restore-test', v_target_name;
  end if;

  if coalesce(v_approved, 'NO') <> 'YES' then
    raise exception 'Hard-stop: janela nao aprovada. Defina app.pilot_execution_approved=YES';
  end if;

  select exists (select 1 from pg_extension where extname = 'hstore')
  into v_hstore_installed;
  if not v_hstore_installed then
    raise exception 'Hard-stop tecnico: extensao hstore ausente no alvo. Triggers uppercase dependem de hstore; tratar em trilha separada antes de novo seed.';
  end if;
end $$;

begin;

-- Namespace/identidade do piloto
with cfg as (
  select
    'PILOTO_MIGRACAO_20260621'::text as ns,
    'piloto-migracao-20260621'::text as tenant_slug,
    'Tenant Piloto Migracao'::text as tenant_name
)
insert into public.tenants (name, slug)
select c.tenant_name, c.tenant_slug
from cfg c
where not exists (
  select 1 from public.tenants t where t.slug = c.tenant_slug
);

-- Legal entities sinteticas
with t as (
  select id as tenant_id
  from public.tenants
  where slug = 'piloto-migracao-20260621'
  limit 1
),
src(name, cnpj) as (
  values
    ('Empresa Piloto A', '00000000000001'),
    ('Empresa Piloto B', '00000000000002')
)
insert into public.legal_entities (tenant_id, name, cnpj)
select t.tenant_id, s.name, s.cnpj
from t
cross join src s
where not exists (
  select 1
  from public.legal_entities le
  where le.tenant_id = t.tenant_id
    and le.name = s.name
);

-- Profiles + vinculos (condicional a existencia de auth.users sinteticos)
do $$
declare
  v_tenant_id uuid;
  v_legal_entity_id uuid;
begin
  select id into v_tenant_id
  from public.tenants
  where slug = 'piloto-migracao-20260621'
  limit 1;

  select id into v_legal_entity_id
  from public.legal_entities
  where name = 'Empresa Piloto A'
  limit 1;

  if v_tenant_id is null or v_legal_entity_id is null then
    raise notice 'Skip profiles: tenant/legal entity piloto nao encontrados.';
    return;
  end if;

  -- Requer usuarios sinteticos preexistentes em auth.users.
  insert into public.profiles (user_id, full_name, active_tenant_id, active_legal_entity_id)
  select au.id, au.full_name, v_tenant_id, v_legal_entity_id
  from (
    select id, 'Admin Piloto'::text as full_name
    from auth.users
    where email = 'admin.piloto@example.test'
    union all
    select id, 'Vendedor Piloto'
    from auth.users
    where email = 'vendedor.piloto@example.test'
    union all
    select id, 'Assistente Piloto'
    from auth.users
    where email = 'assistente.piloto@example.test'
  ) au
  where not exists (
    select 1 from public.profiles p where p.user_id = au.id
  );

  insert into public.user_tenants (user_id, tenant_id)
  select p.user_id, v_tenant_id
  from public.profiles p
  where p.full_name in ('Admin Piloto', 'Vendedor Piloto', 'Assistente Piloto')
    and not exists (
      select 1 from public.user_tenants ut
      where ut.user_id = p.user_id
        and ut.tenant_id = v_tenant_id
    );

  -- FASE 17A: user_roles fica explicitamente fora de escopo.
  -- Motivo: estrategia RBAC final pode exigir colunas obrigatorias adicionais.
  -- Decisao: nao forcar insert parcial/invalido nesta fase.
  raise notice 'Skip user_roles: fora de escopo da Fase 17A (depende da estrategia RBAC/auth definitiva).';
end $$;

-- Cadastros auxiliares de produto (reuso ou insercao minima controlada)
with t as (
  select id as tenant_id from public.tenants where slug = 'piloto-migracao-20260621' limit 1
),
grp as (
  select id from public.product_groups where label = 'Grupo Piloto 01' limit 1
),
grp_ins as (
  insert into public.product_groups (tenant_id, value, label)
  select t.tenant_id, 'PIL_GRP_01', 'Grupo Piloto 01'
  from t
  where not exists (select 1 from grp)
  returning id
),
sub as (
  select id from public.product_subgroups where label = 'Subgrupo Piloto 01' limit 1
),
sub_ins as (
  insert into public.product_subgroups (tenant_id, value, label)
  select t.tenant_id, 'PIL_SUB_01', 'Subgrupo Piloto 01'
  from t
  where not exists (select 1 from sub)
  returning id
),
typ as (
  select id from public.product_types where label = 'Tipo Piloto 01' limit 1
),
typ_ins as (
  insert into public.product_types (tenant_id, value, label)
  select t.tenant_id, 'PIL_TYP_01', 'Tipo Piloto 01'
  from t
  where not exists (select 1 from typ)
  returning id
)
select 1;

-- Carriers sinteticas (2) com ERP code obrigatorio
with t as (
  select id as tenant_id from public.tenants where slug = 'piloto-migracao-20260621' limit 1
),
src(name, erp_code) as (
  values
    ('CARRIER PILOTO 01', 999001),
    ('CARRIER PILOTO 02', 999002)
)
insert into public.carriers (tenant_id, name, erp_code)
select t.tenant_id, s.name, s.erp_code
from t
cross join src s
where not exists (
  select 1 from public.carriers c
  where c.tenant_id = t.tenant_id
    and c.name = s.name
);

-- Garantia de ERP code nos carriers piloto preexistentes
with t as (
  select id as tenant_id from public.tenants where slug = 'piloto-migracao-20260621' limit 1
),
src(name, erp_code) as (
  values
    ('CARRIER PILOTO 01', 999001),
    ('CARRIER PILOTO 02', 999002)
)
update public.carriers c
set erp_code = s.erp_code
from t
join src s on true
where c.tenant_id = t.tenant_id
  and c.name = s.name
  and c.erp_code is null;

-- Sales reps sinteticos (2)
with t as (
  select id as tenant_id from public.tenants where slug = 'piloto-migracao-20260621' limit 1
),
src(name) as (
  values
    ('Vendedor Piloto 01'),
    ('Vendedor Piloto 02')
)
insert into public.sales_reps (tenant_id, name)
select t.tenant_id, s.name
from t
cross join src s
where not exists (
  select 1 from public.sales_reps r
  where r.tenant_id = t.tenant_id
    and r.name = s.name
);

-- Companies sinteticas (20)
with t as (
  select id as tenant_id from public.tenants where slug = 'piloto-migracao-20260621' limit 1
),
le as (
  select id as legal_entity_id
  from public.legal_entities
  where name = 'Empresa Piloto A'
  limit 1
),
sr as (
  select id as sales_rep_id
  from public.sales_reps
  where name = 'Vendedor Piloto 01'
  limit 1
),
src as (
  select generate_series(1, 20) as n
)
insert into public.companies (tenant_id, legal_entity_id, sales_rep_id, name)
select
  t.tenant_id,
  le.legal_entity_id,
  sr.sales_rep_id,
  format('CLIENTE PILOTO %s', lpad(src.n::text, 3, '0'))
from src
cross join t
cross join le
cross join sr
where not exists (
  select 1 from public.companies c
  where c.tenant_id = t.tenant_id
    and c.name = format('CLIENTE PILOTO %s', lpad(src.n::text, 3, '0'))
);

-- Contacts sinteticos (20)
with t as (
  select id as tenant_id from public.tenants where slug = 'piloto-migracao-20260621' limit 1
),
cmp as (
  select id, row_number() over (order by name) as rn
  from public.companies
  where name ilike 'CLIENTE PILOTO %'
),
src as (
  select generate_series(1, 20) as n
)
insert into public.contacts (tenant_id, company_id, first_name)
select
  t.tenant_id,
  cmp.id,
  format('CONTATO PILOTO %s', lpad(src.n::text, 3, '0'))
from src
join cmp on cmp.rn = src.n
cross join t
where not exists (
  select 1 from public.contacts c
  where c.company_id = cmp.id
    and c.first_name = format('CONTATO PILOTO %s', lpad(src.n::text, 3, '0'))
);

-- Products sinteticos (20)
with t as (
  select id as tenant_id from public.tenants where slug = 'piloto-migracao-20260621' limit 1
),
le as (
  select id as legal_entity_id
  from public.legal_entities
  where name = 'Empresa Piloto A'
  limit 1
),
grp as (
  select id as grupo_id from public.product_groups where label = 'Grupo Piloto 01' limit 1
),
sub as (
  select id as subgrupo_id from public.product_subgroups where label = 'Subgrupo Piloto 01' limit 1
),
typ as (
  select id as tipo_id from public.product_types where label = 'Tipo Piloto 01' limit 1
),
src as (
  select
    gs.n,
    format('PIL-SKU-%s', lpad(gs.n::text, 3, '0')) as sku,
    format('PRODUTO PILOTO %s', lpad(gs.n::text, 3, '0')) as product_name,
    format('PILOTO IMPRESSO %s', lpad(gs.n::text, 3, '0')) as nome_impresso
  from generate_series(1, 20) as gs(n)
)
insert into public.products (
  tenant_id, legal_entity_id, grupo_id, subgrupo_id, tipo_id, sku, name, nome_impresso
)
select
  t.tenant_id,
  le.legal_entity_id,
  grp.grupo_id,
  sub.subgrupo_id,
  typ.tipo_id,
  src.sku,
  src.product_name,
  src.nome_impresso
from src
cross join t
cross join le
cross join grp
cross join sub
cross join typ
where not exists (
  select 1
  from public.products p
  where p.active = true
    and p.tenant_id = t.tenant_id
    and coalesce(p.tipo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) = coalesce(typ.tipo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
    and coalesce(p.grupo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) = coalesce(grp.grupo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
    and coalesce(p.subgrupo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) = coalesce(sub.subgrupo_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
    and coalesce(p.family_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
    and coalesce(p.class_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
    and coalesce(p.width::text, '-1') = '-1'
    and coalesce(p.length::text, '-1') = '-1'
    and coalesce(p.thickness::text, '-1') = '-1'
    and coalesce(p.nome_impresso, '') = src.nome_impresso
);

-- Deals sinteticos (10)
with t as (
  select id as tenant_id from public.tenants where slug = 'piloto-migracao-20260621' limit 1
),
le as (
  select id as legal_entity_id from public.legal_entities where name = 'Empresa Piloto A' limit 1
),
pl as (
  select id as pipeline_id from public.pipelines order by id limit 1
),
st as (
  select id as pipeline_stage_id from public.pipeline_stages order by id limit 1
),
cmp as (
  select id, row_number() over (order by name) as rn
  from public.companies
  where name ilike 'CLIENTE PILOTO %'
),
ct as (
  select id, row_number() over (order by first_name) as rn
  from public.contacts
  where first_name ilike 'CONTATO PILOTO %'
),
src as (
  select generate_series(1, 10) as n
)
insert into public.deals (
  tenant_id, legal_entity_id, company_id, contact_id, pipeline_id, pipeline_stage_id, name
)
select
  t.tenant_id,
  le.legal_entity_id,
  cmp.id,
  ct.id,
  pl.pipeline_id,
  st.pipeline_stage_id,
  format('DEAL PILOTO %s', lpad(src.n::text, 3, '0'))
from src
join cmp on cmp.rn = src.n
join ct on ct.rn = src.n
cross join t
cross join le
cross join pl
cross join st
where not exists (
  select 1 from public.deals d
  where d.tenant_id = t.tenant_id
    and d.name = format('DEAL PILOTO %s', lpad(src.n::text, 3, '0'))
);

-- Proposals sinteticas (10) com status seguros (sem gatilho de integracao)
with t as (
  select id as tenant_id from public.tenants where slug = 'piloto-migracao-20260621' limit 1
),
le as (
  select id as legal_entity_id from public.legal_entities where name = 'Empresa Piloto A' limit 1
),
car as (
  select id as carrier_id from public.carriers where name = 'CARRIER PILOTO 01' limit 1
),
src as (
  select
    d.id as deal_id,
    d.company_id,
    d.contact_id,
    row_number() over (order by d.name) as n
  from public.deals d
  where d.name ilike 'DEAL PILOTO %'
),
status_map as (
  select n,
    case ((n - 1) % 4)
      when 0 then 'rascunho'
      when 1 then 'recusada'
      when 2 then 'recusada'
      else 'rascunho'
    end as status
  from generate_series(1, 10) as n
)
insert into public.proposals (
  tenant_id, legal_entity_id, deal_id, company_id, contact_id, carrier_id, number, status
)
select
  t.tenant_id,
  le.legal_entity_id,
  s.deal_id,
  s.company_id,
  s.contact_id,
  car.carrier_id,
  format('PROP-PIL-%s', lpad(s.n::text, 3, '0')),
  sm.status
from src s
join status_map sm on sm.n = s.n
cross join t
cross join le
cross join car
where not exists (
  select 1 from public.proposals p
  where p.number = format('PROP-PIL-%s', lpad(s.n::text, 3, '0'))
);

-- Proposal items (2 por proposta)
with props as (
  select id, row_number() over (order by number) as rn
  from public.proposals
  where number like 'PROP-PIL-%'
),
prd as (
  select id, row_number() over (order by sku) as rn
  from public.products
  where sku like 'PIL-SKU-%'
),
src as (
  select p.id as proposal_id, pr.id as product_id, i as item_n
  from props p
  join generate_series(1,2) i on true
  join prd pr on pr.rn = ((p.rn + i - 2) % 20) + 1
)
insert into public.proposal_items (proposal_id, product_id, description)
select
  s.proposal_id,
  s.product_id,
  format('Item Proposta Piloto %s', s.item_n)
from src s
where not exists (
  select 1
  from public.proposal_items pi
  where pi.proposal_id = s.proposal_id
    and pi.description = format('Item Proposta Piloto %s', s.item_n)
);

-- Orders sinteticas (10) em status seguros (sem sincronizacao externa)
with t as (
  select id as tenant_id from public.tenants where slug = 'piloto-migracao-20260621' limit 1
),
le as (
  select id as legal_entity_id from public.legal_entities where name = 'Empresa Piloto A' limit 1
),
sr as (
  select id as sales_rep_id from public.sales_reps where name = 'Vendedor Piloto 01' limit 1
),
car as (
  select id as carrier_id from public.carriers where name = 'CARRIER PILOTO 01' limit 1
),
src as (
  select
    p.id as proposal_id,
    p.deal_id,
    p.company_id,
    p.contact_id,
    row_number() over (order by p.number) as n
  from public.proposals p
  where p.number like 'PROP-PIL-%'
),
status_map as (
  select n,
    case ((n - 1) % 4)
      when 0 then 'pendente'
      when 1 then 'em_producao'
      when 2 then 'pendente'
      else 'em_producao'
    end as status
  from generate_series(1, 10) as n
)
insert into public.orders (
  tenant_id, legal_entity_id, proposal_id, deal_id, company_id, contact_id,
  sales_rep_id, carrier_id, number, status
)
select
  t.tenant_id,
  le.legal_entity_id,
  s.proposal_id,
  s.deal_id,
  s.company_id,
  s.contact_id,
  sr.sales_rep_id,
  car.carrier_id,
  format('ORD-PIL-%s', lpad(s.n::text, 3, '0')),
  sm.status
from src s
join status_map sm on sm.n = s.n
cross join t
cross join le
cross join sr
cross join car
where not exists (
  select 1 from public.orders o
  where o.number = format('ORD-PIL-%s', lpad(s.n::text, 3, '0'))
);

-- Order items (2 por pedido)
with ord as (
  select id, row_number() over (order by number) as rn
  from public.orders
  where number like 'ORD-PIL-%'
),
prd as (
  select id, row_number() over (order by sku) as rn
  from public.products
  where sku like 'PIL-SKU-%'
),
src as (
  select o.id as order_id, p.id as product_id, i as item_n
  from ord o
  join generate_series(1,2) i on true
  join prd p on p.rn = ((o.rn + i - 2) % 20) + 1
)
insert into public.order_items (order_id, product_id, description)
select
  s.order_id,
  s.product_id,
  format('ITEM PEDIDO PILOTO %s', s.item_n)
from src s
where not exists (
  select 1
  from public.order_items oi
  where oi.order_id = s.order_id
    and oi.description = format('ITEM PEDIDO PILOTO %s', s.item_n)
);

-- Tasks sinteticas (5)
with t as (
  select id as tenant_id from public.tenants where slug = 'piloto-migracao-20260621' limit 1
),
cmp as (
  select id, row_number() over (order by name) as rn
  from public.companies
  where name ilike 'CLIENTE PILOTO %'
),
src as (
  select generate_series(1, 5) as n
)
insert into public.tasks (tenant_id, company_id, title)
select
  t.tenant_id,
  cmp.id,
  format('TASK PILOTO_MIGRACAO_20260621 %s', lpad(src.n::text, 3, '0'))
from src
join cmp on cmp.rn = src.n
cross join t
where not exists (
  select 1 from public.tasks tk
  where tk.tenant_id = t.tenant_id
    and tk.title = format('TASK PILOTO_MIGRACAO_20260621 %s', lpad(src.n::text, 3, '0'))
);

-- Notifications sinteticas (5, inertes)
-- Dependencia: requer user_id valido. Se nao houver profiles piloto, este bloco nao cria linhas.
-- Sem envio externo; apenas registros de teste identificados por namespace.
with pu as (
  select p.user_id, row_number() over (order by p.user_id) as rn
  from public.profiles p
  where p.full_name in (
    'Admin Piloto',
    'Vendedor Piloto',
    'Assistente Piloto'
  )
),
src as (
  select generate_series(1, 5) as n
)
insert into public.notifications (user_id, title, message)
select
  pu.user_id,
  format('Notif PILOTO_MIGRACAO_20260621 %s', lpad(src.n::text, 3, '0')),
  'Notificacao sintetica de piloto'
from src
join pu on pu.rn = ((src.n - 1) % 3) + 1
where not exists (
  select 1 from public.notifications n
  where n.user_id = pu.user_id
    and n.title = format('Notif PILOTO_MIGRACAO_20260621 %s', lpad(src.n::text, 3, '0'))
);

-- Decisoes Fase 17A:
-- 1) auth.users: fora de escopo neste script (nao cria usuarios reais; depende de trilha separada).
-- 2) user_roles: fora de escopo nesta fase (RBAC final pendente; nao forcar inserts invalidos).
-- 3) logs/filas/auditoria reais: fora do piloto; somente dados sinteticos inertes no escopo local.
-- 4) storage objetos reais: fora de escopo da Fase 17A.
-- 5) integracoes externas reais (ERP/PDF/CNPJ/n8n/webhooks): proibidas nesta fase.
-- 6) carriers piloto exigem erp_code sintetico (999001/999002) por regra validate_carrier_erp_code().

commit;
