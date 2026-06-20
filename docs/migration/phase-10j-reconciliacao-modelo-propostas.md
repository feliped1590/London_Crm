# Fase 10J — Reconciliacao do modelo de Propostas

## 1) Objetivo da fase

Realizar reconciliacao tecnica e documental do modelo de Propostas para definir o modelo canonico do CRM no staging:

1. manter/criar `public.proposals` e `public.proposal_items`; ou
2. adaptar codigo/funcoes para `sales_proposals` e `sales_proposal_items`.

## 2) Ambiente inspecionado

- Repositorio: `Qualyvac_Migration`
- Branch: `phase-10j-reconciliacao-modelo-propostas`
- Projeto staging: `crm-qualyvac-staging`
- Project ref: `cansbrrwrprcycjvgvqm`
- Escopo: somente leitura (repo + banco staging)

## 3) Modelos encontrados

### 3.1 Modelo antigo (esperado pelo codigo legado)

- `public.proposals`
- `public.proposal_items`

### 3.2 Modelo atual/provavel no staging

- `public.sales_proposals`
- `public.sales_proposal_items`
- `public.sales_proposal_history`
- `public.sales_proposal_attachments`

### 3.3 Achado critico

- `public.proposals` e `public.proposal_items` **nao existem** no staging atual.
- Nao existem views de compatibilidade `public.proposals`/`public.proposal_items`.

## 4) Onde cada modelo aparece no codigo

## Frontend (`src`)

Uso de modelo antigo (`proposals`/`proposal_items`) encontrado em:
- `src/components/proposals/ProposalsList.tsx`
- `src/components/proposals/ProposalDialog.tsx`
- `src/hooks/useDashboardData.ts`
- `src/integrations/supabase/types.ts` (tipos com `approval_token`, `approval_token_expires_at` em `proposals`)

Uso de `sales_proposals`/`sales_proposal_items` no frontend:
- **nao encontrado** nas buscas.

## Edge Functions (`supabase/functions`)

Uso de modelo antigo em:
- `supabase/functions/proposal-public-view/index.ts`
- `supabase/functions/proposal-approve/index.ts`
- `supabase/functions/generate-proposal-pdf/index.ts`

Uso de `sales_proposals`/`sales_proposal_items` em Edge Functions:
- **nao encontrado** nas buscas.

## 5) Onde cada modelo aparece nas migrations locais

### Modelo antigo (`public.proposals`/`public.proposal_items`)

Fortemente presente.

Exemplos:
- `20260118163027_fdaa771b-21c5-4b33-8f53-ca503f8c1fc8.sql` cria `public.proposals` e `public.proposal_items`.
- `20260118224452_9e9f4b5d-04da-44f3-952d-ac4b369ac5dc.sql` adiciona `approval_token` e `approval_token_expires_at`.
- Muitas migrations 2026-02/03/04/05/06 fazem `ALTER`, policies, triggers, queries e indices sobre `public.proposals`.

### Modelo `sales_*`

- **Nao encontrado** como `CREATE TABLE`/`ALTER TABLE` em migrations locais versionadas.
- Isso indica possivel origem por baseline externo, dump/manual, ou outra linha de evolucao nao refletida no historico local de migrations.

## 6) Estrutura de colunas no staging (`sales_*`)

## `sales_proposals` (resumo)

Campos relevantes observados:
- IDs/relacoes: `id`, `owner_id`, `deal_id`, `company_id`, `contact_id`, `legal_entity_id`
- Status/comercial: `status`, `proposal_number`, `issue_date`, `valid_until`, `commercial_notes`
- Pagamento/logistica: `payment_method_id`, `payment_terms_id`, `installments`, `carrier_id`, endereco de entrega
- Totais: `subtotal_cents`, `discount_cents`, `ipi_cents`, `total_cents`
- Conversao/aprovacao: `approved_by`, `approved_at`, `converted_order_id`, `rejected_at`, `rejection_notes`, `cancelled_at`
- Auditoria temporal: `created_at`, `updated_at`

Observacao critica:
- Nao foi observado `approval_token` nem `approval_token_expires_at` no modelo `sales_proposals`.

## `sales_proposal_items` (resumo)

Campos relevantes:
- `id`, `proposal_id`, `product_id`
- `description`, `quantity`, `unit_measure`
- `unit_price_cents`, `discount_pct`, `ipi_pct`, `total_cents`
- `notes`, `sort_order`, `created_at`

## `sales_proposal_history` / `sales_proposal_attachments`

- Historico com `event_type`, transicoes de status e ator.
- Anexos com `proposal_id`, `file_name`, `file_path`, `uploaded_by`.

## 7) Relacoes/FKs (`sales_*`)

## `sales_proposals`

FKs para:
- `companies`
- `company_contacts` (nao `contacts`)
- `deals`
- `legal_entities`
- `order_carriers`
- `order_payment_methods`
- `order_payment_terms`
- `orders` (`converted_order_id`)

## `sales_proposal_items`

FKs para:
- `sales_proposals`
- `products`

## `sales_proposal_history` / `sales_proposal_attachments`

FK para:
- `sales_proposals`

## 8) Policies RLS (`sales_*`)

Encontradas policies para `SELECT/INSERT/UPDATE/DELETE` em:
- `sales_proposals`
- `sales_proposal_items`
- `sales_proposal_history` (select/insert)
- `sales_proposal_attachments` (select/insert/delete)

## 9) RPCs relacionadas

Encontrada em `public`:
- `next_proposal_number`

Nao foram encontradas rotinas `public` que indiquem suporte explicito ao modelo antigo `public.proposals` no staging atual.

## 10) Funcoes e telas afetadas

## Funcoes afetadas

- `proposal-public-view` (bloqueada funcionalmente por consultar `proposals`)
- `proposal-approve`
- `generate-proposal-pdf`

## Frontend afetado

- Fluxos de listagem/edicao de propostas em `src/components/proposals/*`
- `useDashboardData` (consulta propostas)
- Tipos Supabase gerados para `proposals` em `src/integrations/supabase/types.ts`

## 11) Coexistencia planejada ou residuo?

Evidencia aponta para **residuo de refatoracao/migracao incompleta**:
- codigo/funcoes apontam para `proposals`;
- staging real opera com `sales_proposals`;
- migrations locais versionadas nao trazem claramente a criacao do modelo `sales_*`;
- sem views de compatibilidade para ponte entre modelos.

## 12) Riscos de criar `public.proposals` agora

1. Duplicacao de dominio de negocio (dois modelos de proposta em paralelo).
2. Divergencia de consistencia entre telas/funcoes/relatorios.
3. Alto risco de regressao funcional e RLS.
4. Complexidade de sincronizacao entre `proposals` e `sales_proposals`.

## 13) Riscos de adaptar codigo para `sales_proposals`

1. Mudanca transversal em frontend, functions e tipos.
2. Ajuste de semantica de campos (ex.: `*_cents`, `company_contacts` vs `contacts`).
3. Necessidade de redefinir token de aprovacao (nao visto em `sales_proposals`).
4. Possivel impacto em regras de aprovacao e PDF.

## 14) Recomendacao tecnica (modelo canonico)

## Modelo canonico sugerido

- **Adotar `sales_proposals` / `sales_proposal_items` como canonico no staging atual.**

## Justificativa

1. E o modelo existente e operacional no banco staging.
2. Evita introduzir nova duplicacao estrutural criando `public.proposals`.
3. Mantem alinhamento com policies/FKs ja ativas no ambiente.

## Plano de correcao em fases (sem executar agora)

1. Fase A — Mapeamento campo-a-campo (`proposals` -> `sales_proposals`) e gaps (`approval_token`).
2. Fase B — Adaptar `proposal-public-view` para modelo `sales_*` (ou camada de compatibilidade segura).
3. Fase C — Adaptar `proposal-approve` e `generate-proposal-pdf`.
4. Fase D — Adaptar frontend/tipos para `sales_*`.
5. Fase E — Validacao negativa/positiva novamente com massa sintetica.

## 15) Respostas diretas (perguntas obrigatorias)

1. `sales_proposals` substitui `proposals`?
   - **No staging atual: sim, de fato.**
2. `sales_proposal_items` substitui `proposal_items`?
   - **No staging atual: sim, de fato.**
3. O frontend ja usa `sales_proposals`?
   - **Nao. Ainda usa `proposals`/`proposal_items`.**
4. `proposal-public-view` esta desatualizada em relacao ao schema?
   - **Sim.**
5. E mais seguro criar compat views ou adaptar a funcao?
   - **Curto prazo:** view de compatibilidade pode destravar rapido, mas com risco de mascarar divergencia.
   - **Medio prazo recomendado:** adaptar funcao/codigo ao modelo canonico `sales_*`.
6. Existe risco de quebrar telas se mexer no modelo?
   - **Sim, risco alto sem plano faseado.**
7. Qual menor correcao segura para liberar teste positivo sintetico?
   - **Minima correcao segura:** ajustar `proposal-public-view` (somente ela) para ler `sales_proposals`/`sales_proposal_items` com mapeamento explicito de campos e sem alterar banco.

## 16) Criterios para desbloquear novo teste positivo da `proposal-public-view`

1. Função apontando para tabelas reais do staging (`sales_*`) **ou** compatibilidade formalmente definida.
2. Campo/token de aprovacao com expiracao claramente suportado no modelo ativo.
3. Validacao negativa repetida sem regressao.
4. Massa sintetica minima criada e rastreavel.
5. Teste positivo controlado sem dados reais.

