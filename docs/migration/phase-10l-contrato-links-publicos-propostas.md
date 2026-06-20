# Fase 10L — Contrato de links publicos de propostas

## 1) Objetivo da fase

Definir o contrato tecnico de uma tabela dedicada para links publicos de proposta, desacoplada de `sales_proposals`, sem aplicar migration real e sem alterar codigo.

## 2) Ambiente analisado

- Projeto: `crm-qualyvac-staging`
- Project ref: `cansbrrwrprcycjvgvqm`
- Escopo: 100% read-only (repositorio + consultas SQL de inspecao)

## 3) Modelo canonico confirmado

- `sales_proposals`
- `sales_proposal_items`

Observacao:
- `public.proposals` / `public.proposal_items` nao sao o modelo ativo no staging.

## 4) Justificativa para tabela separada de links publicos

1. `sales_proposals` nao expoe hoje mecanismo explicito de token/expiracao para acesso publico.
2. Evita acoplar credencial publica (token) ao registro transacional principal.
3. Facilita governanca de seguranca:
   - expiracao obrigatoria,
   - revogacao imediata,
   - auditoria de acesso,
   - escopo por acao (`view`, `approve`).
4. Reduz divida tecnica frente a alternativa de "remendo" direto no schema principal.

## 5) Nome recomendado da tabela

- `public.sales_proposal_public_links`

## 6) Inspecao read-only do schema atual (base para contrato)

### 6.1 `sales_proposals` (resumo relevante)

Campos encontrados:
- PK: `id uuid`
- FK relevantes: `company_id`, `contact_id`, `legal_entity_id`, `deal_id`
- Status/aprovacao: `status`, `approved_by`, `approved_at`, `rejected_by`, `rejected_at`
- Vigencia comercial: `issue_date`, `valid_until`
- Totais em cents: `subtotal_cents`, `discount_cents`, `ipi_cents`, `total_cents`

### 6.2 `sales_proposal_items` (resumo relevante)

Campos encontrados:
- PK: `id uuid`
- FK: `proposal_id -> sales_proposals.id`
- Valores em cents: `unit_price_cents`, `total_cents`

### 6.3 `tenants`, `legal_entities`, `profiles`

- `legal_entities`: existe no staging.
- `profiles`: existe no staging.
- `tenants`: nao apareceu no conjunto de colunas retornado nesta inspecao (validar existencia exata no momento da migration real).

### 6.4 FKs `sales_*`

Confirmadas para:
- `sales_proposal_items.proposal_id -> sales_proposals.id`
- `sales_proposal_attachments.proposal_id -> sales_proposals.id`
- `sales_proposal_history.proposal_id -> sales_proposals.id`
- `sales_proposals.legal_entity_id -> legal_entities.id`
- `sales_proposals.company_id -> companies.id`
- `sales_proposals.contact_id -> company_contacts.id`

### 6.5 RLS atual

Policies existentes para:
- `sales_proposals`
- `sales_proposal_items`
- `sales_proposal_history`
- `sales_proposal_attachments`

## 7) Contrato proposto da nova tabela

Tabela: `public.sales_proposal_public_links`

Campos recomendados:

- `id uuid primary key default gen_random_uuid()`
- `sales_proposal_id uuid not null references public.sales_proposals(id) on delete cascade`
- `token_hash text not null`  
  - hash do token bruto (nunca armazenar token em claro)
- `token_hash_alg text not null default 'sha256'`
- `scope text not null default 'view'`  
  - valores sugeridos: `view`, `approve`, `view_approve`
- `status text not null default 'active'`  
  - valores sugeridos: `active`, `revoked`, `used`, `expired`
- `expires_at timestamptz not null`
- `revoked_at timestamptz null`
- `revoked_by uuid null` (FK opcional para `profiles.user_id` ou `auth.users(id)`)
- `created_at timestamptz not null default now()`
- `created_by uuid null`
- `last_accessed_at timestamptz null`
- `access_count integer not null default 0`
- `max_access_count integer null`
- `tenant_id uuid null` (se multi-tenant estiver padronizado no schema ativo)
- `legal_entity_id uuid null references public.legal_entities(id)`
- `metadata jsonb not null default '{}'::jsonb`

Regras de consistencia sugeridas:
- `check (expires_at > created_at)`
- `check (access_count >= 0)`
- `check (max_access_count is null or max_access_count >= 1)`

## 8) FKs recomendadas

Minimas:
- `sales_proposal_id -> sales_proposals(id)`
- `legal_entity_id -> legal_entities(id)` (quando usado)

Opcionais:
- `created_by` / `revoked_by` para `auth.users` ou tabela de perfis padronizada.

## 9) Indices recomendados

1. `unique index uq_sales_proposal_public_links_token_hash on token_hash`
2. `index idx_sales_proposal_public_links_proposal_id on sales_proposal_id`
3. `index idx_sales_proposal_public_links_expires_at on expires_at`
4. `index idx_sales_proposal_public_links_active on (status, expires_at) where revoked_at is null and status = 'active'`
5. (opcional) `index idx_sales_proposal_public_links_scope on scope`

## 10) Estrategia de token/hash

Regras:
- gerar token bruto com alta entropia (>= 32 bytes aleatorios codificados em base64url/hex).
- persistir somente `token_hash` (ex.: SHA-256).
- nunca logar token bruto.
- opcional: armazenar prefixo curto para observabilidade (`token_prefix`) sem permitir reconstrução.

Fluxo esperado:
1. cliente recebe token bruto uma unica vez (link).
2. Edge Function recebe token bruto.
3. valida formato.
4. calcula hash.
5. consulta `sales_proposal_public_links` por `token_hash`.
6. valida ativo/nao expirado/nao revogado/escopo.
7. resolve `sales_proposal_id`.

## 11) Regras de expiracao e revogacao

- Expiracao obrigatoria em todos os links.
- Expiracao padrao recomendada:
  - `view`: 24h
  - `approve`: 2h a 24h (conforme politica comercial)
- Revogacao:
  - `revoked_at` + `revoked_by` + `status='revoked'`
- Uso unico opcional para escopo sensivel (`approve`):
  - apos aprovacao, marcar `status='used'`.

## 12) Estrategia de auditoria

Recomendado registrar em tabela existente de auditoria (ou tabela dedicada futura):
- tentativa de acesso (sucesso/falha),
- motivo de falha (expirado, revogado, token invalido),
- ip/fingerprint,
- `sales_proposal_id` quando resolvido.

Importante:
- nunca registrar token bruto.
- no maximo registrar hash truncado ou prefixo irreversivel.

## 13) Estrategia de RLS/acesso

Recomendacao:
- manter RLS habilitado na nova tabela.
- acesso publico **nunca** direto pelo client Supabase.
- acesso publico apenas via Edge Function com `service_role`, aplicando validacoes estritas.
- operacoes administrativas (criar/revogar links) somente autenticadas e auditadas.

## 14) Impacto por funcao

## `proposal-public-view`

- Passa a resolver proposta por `sales_proposal_public_links` + `sales_proposals`/`sales_proposal_items`.
- Remove dependencia de `approval_token` em tabela de proposta.

## `proposal-approve`

- Pode reutilizar link (`scope=view_approve`) ou exigir link escopo `approve`.
- Em fluxo de aprovacao, link pode ser invalidado (`used`/`revoked`).

## `generate-proposal-pdf`

- Nao depende diretamente do link publico.
- Impacto indireto apenas se fluxo de aprovacao/publico passar a orquestrar PDF via escopo.

## 15) Rascunho SQL (documental, nao aplicar)

```sql
-- Rascunho Fase 10L (DOCUMENTAL) - NAO APLICAR NESTA FASE
create table if not exists public.sales_proposal_public_links (
  id uuid primary key default gen_random_uuid(),
  sales_proposal_id uuid not null references public.sales_proposals(id) on delete cascade,
  token_hash text not null,
  token_hash_alg text not null default 'sha256',
  scope text not null default 'view',
  status text not null default 'active',
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  revoked_by uuid null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null,
  last_accessed_at timestamptz null,
  access_count integer not null default 0,
  max_access_count integer null,
  tenant_id uuid null,
  legal_entity_id uuid null references public.legal_entities(id),
  metadata jsonb not null default '{}'::jsonb,
  constraint chk_sales_proposal_public_links_expires_after_create
    check (expires_at > created_at),
  constraint chk_sales_proposal_public_links_access_count_nonneg
    check (access_count >= 0),
  constraint chk_sales_proposal_public_links_max_access_count
    check (max_access_count is null or max_access_count >= 1),
  constraint uq_sales_proposal_public_links_token_hash unique (token_hash)
);

create index if not exists idx_sales_proposal_public_links_proposal_id
  on public.sales_proposal_public_links (sales_proposal_id);

create index if not exists idx_sales_proposal_public_links_expires_at
  on public.sales_proposal_public_links (expires_at);

create index if not exists idx_sales_proposal_public_links_active
  on public.sales_proposal_public_links (status, expires_at)
  where revoked_at is null and status = 'active';
```

## 16) Riscos

1. Sem mecanismo de token, endpoint publico segue bloqueado para teste positivo.
2. Se token for acoplado direto em `sales_proposals`, aumenta risco de exposicao e acoplamento.
3. Divergencia entre `contacts` e `company_contacts` precisa de mapeamento cuidadoso na adaptacao da funcao.

## 17) Criterios para aprovar migration real na fase seguinte

1. Contrato final aprovado por engenharia + seguranca.
2. Definicao clara de `scope` e politica de expiracao/revogacao.
3. Definicao de estrategia de auditoria.
4. Definicao de padrao de hash/geracao de token.
5. Plano de rollback da migration e da funcao.

## 18) Respostas diretas (perguntas obrigatorias)

1. **Qual tabela deve guardar o link publico?**
   - `public.sales_proposal_public_links` (dedicada).
2. **Token bruto ou hash?**
   - Hash (`token_hash`) somente.
3. **Expiracao padrao?**
   - Recomendado 24h para `view` (ajustavel por escopo).
4. **Como revogar link?**
   - `status='revoked'` + `revoked_at` + `revoked_by`.
5. **Como evitar enumeracao?**
   - token com alta entropia + hash lookup + erro generico + rate limit + auditoria.
6. **Tabela deve ter RLS?**
   - Sim, com acesso publico apenas via Edge Function.
7. **Edge Function continua unico ponto de acesso publico?**
   - Sim, obrigatoriamente.
8. **Qual migration minima depois?**
   - Criacao da tabela dedicada + indices + constraints + (opcional) policies iniciais.
9. **Teste positivo sintetico pode ser retomado apos qual sequencia?**
   - Fase 10L (migration controlada) -> 10M (adaptacao de codigo) -> 10N (deploy) -> 10O (negativa) -> 10P (positivo sintetico).

## 19) Proximas fases recomendadas

1. **Fase 10L.1**: revisar e aprovar contrato (este documento).
2. **Fase 10L.2**: criar migration real controlada da tabela de links.
3. **Fase 10M**: adaptar `proposal-public-view` (e alinhar `proposal-approve` conforme escopo).
4. **Fase 10N**: deploy controlado.
5. **Fase 10O**: validacao negativa.
6. **Fase 10P**: teste positivo sintetico.

