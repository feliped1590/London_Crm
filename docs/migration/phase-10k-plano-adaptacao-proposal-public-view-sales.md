# Fase 10K — Plano de adaptacao da `proposal-public-view` para modelo `sales_*`

## 1) Objetivo da fase

Definir plano tecnico para adaptar `proposal-public-view` ao modelo canonico do staging (`sales_proposals` / `sales_proposal_items`) com estrategia segura para link publico e expiracao, sem alterar codigo/banco nesta fase.

## 2) Ambiente analisado

- Repositorio: `Qualyvac_Migration`
- Branch: `phase-10k-plano-adaptacao-proposal-public-view-sales`
- Projeto inspecionado: `crm-qualyvac-staging`
- Project ref: `cansbrrwrprcycjvgvqm`
- Escopo: somente leitura (repo + SQL read-only no staging)

## 3) Modelo canonico confirmado

- Modelo canonico recomendado no staging:
  - `public.sales_proposals`
  - `public.sales_proposal_items`
- Modelo antigo ausente no staging:
  - `public.proposals` (ausente)
  - `public.proposal_items` (ausente)

## 4) Dependencias da `proposal-public-view` (estado atual)

A funcao atual espera:
- tabela: `proposals`
- itens: `proposal_items`
- filtro por token: `approval_token`
- expiracao: `approval_token_expires_at`
- joins: `companies`, `contacts`, `legal_entities`

## 5) Dependencias da `proposal-approve`

Tambem depende de:
- `proposals` / `proposal_items`
- `approval_token` + `approval_token_expires_at`
- invalidacao posterior do token na propria proposta

## 6) Dependencias da `generate-proposal-pdf`

Tambem consulta:
- `proposals`
- `proposal_items`

## 7) Onde cada modelo aparece no codigo/migrations

## Codigo (frontend + functions)

- Frontend ainda usa `from('proposals')` e `from('proposal_items')` em componentes de proposta.
- Functions (`proposal-public-view`, `proposal-approve`, `generate-proposal-pdf`) ainda usam `proposals`/`proposal_items`.
- Nao foram encontradas referencias de uso de `sales_proposals`/`sales_proposal_items` em `src`.

## Migrations locais

- Migrations locais criam e evoluem `public.proposals`/`public.proposal_items` (ex.: `20260118163027...`, `20260118224452...`).
- Nao ha trilha local clara de `CREATE TABLE public.sales_proposals` / `public.sales_proposal_items`.

## 8) Estrutura de `sales_proposals` / `sales_proposal_items` (staging real)

## `sales_proposals` (resumo)

Campos relevantes presentes:
- identidade/relacoes: `id`, `owner_id`, `deal_id`, `company_id`, `contact_id`, `legal_entity_id`
- estado/comercial: `status`, `proposal_number`, `issue_date`, `valid_until`, `commercial_notes`
- aprovacao operacional: `approved_by`, `approved_at`, `rejected_by`, `rejected_at`, `rejection_notes`
- totais: `subtotal_cents`, `discount_cents`, `ipi_cents`, `total_cents`
- auditoria: `created_at`, `updated_at`

## `sales_proposal_items` (resumo)

Campos relevantes presentes:
- `proposal_id`, `product_id`, `description`, `quantity`, `unit_price_cents`, `discount_pct`, `ipi_pct`, `total_cents`, `sort_order`

## Gap central

- Nao foram encontrados em `sales_proposals`:
  - `approval_token`
  - `approval_token_expires_at`

## 9) Tabela comparativa (campo esperado vs `sales_*`)

| Campo esperado pela funcao atual | Equivalente no `sales_*` | Status | Observacao |
|---|---|---|---|
| `proposals.id` | `sales_proposals.id` | existe | mapeamento direto |
| `proposals.status` | `sales_proposals.status` | existe | semantica precisa validar |
| `proposals.payment_terms` | `sales_proposals.payment_terms_id` / `payment_notes` | incerto | mudou para FK + notas |
| `proposals.delivery_terms` | `sales_proposals.freight_type` + campos de entrega | incerto | sem equivalencia 1:1 |
| `proposals.total_value` | `sales_proposals.total_cents` | existe (adaptacao) | exige conversao cents |
| `proposals.subtotal_products` | `sales_proposals.subtotal_cents` | existe (adaptacao) | exige conversao cents |
| `proposals.total_ipi` | `sales_proposals.ipi_cents` | existe (adaptacao) | exige conversao cents |
| `proposals.approval_token` | sem campo em `sales_proposals` | **ausente** | blocker para endpoint publico por token |
| `proposals.approval_token_expires_at` | sem campo em `sales_proposals` | **ausente** | blocker de expiracao |
| `proposal_items.unit_price` | `sales_proposal_items.unit_price_cents` | existe (adaptacao) | exige conversao cents |
| `proposal_items.total_item` | `sales_proposal_items.total_cents` | existe (adaptacao) | exige conversao cents |
| `proposal_items.product:products(name)` | relacao via `sales_proposal_items.product_id` | existe | join possivel |
| `contacts(first_name,last_name)` | `sales_proposals.contact_id -> company_contacts` | incerto | tabela alvo diferente de `contacts` |

## 10) Relacoes/FKs e RLS relevantes

## FKs

- `sales_proposal_items.proposal_id -> sales_proposals.id`
- `sales_proposal_attachments.proposal_id -> sales_proposals.id`
- `sales_proposal_history.proposal_id -> sales_proposals.id`
- `sales_proposals.company_id -> companies.id`
- `sales_proposals.contact_id -> company_contacts.id`
- `sales_proposals.legal_entity_id -> legal_entities.id`

## RLS

- Policies presentes e ativas para:
  - `sales_proposals`
  - `sales_proposal_items`
  - `sales_proposal_history`
  - `sales_proposal_attachments`

## 11) Gap de token/expiracao (blocker)

- O endpoint `proposal-public-view` depende de mecanismo de token publico com expiração.
- O modelo `sales_proposals` atual nao oferece isso nativamente.
- Sem mecanismo de token publico, nao ha adaptacao segura "drop-in" da funcao.

## 12) Opcoes de solucao (sem executar)

1. **Adicionar `approval_token` e `approval_token_expires_at` em `sales_proposals`**
2. **Criar tabela separada de links publicos de proposta** (ex.: `sales_proposal_public_links`)
3. **Usar signed URL/token assinado em funcao dedicada** (sem persistir token opaco na proposta)
4. **Criar view de compatibilidade temporaria** (`proposals` -> `sales_proposals`)
5. **Adaptar para outro mecanismo existente**, se descoberto (nao encontrado nesta fase)

## 13) Analise de risco por opcao

1. **Campos em `sales_proposals`**
   - Prós: menor friccao para adaptar funcoes atuais.
   - Contras: mistura responsabilidade de dados internos com acesso publico.
   - Risco: medio.

2. **Tabela separada de links publicos (recomendada)**
   - Prós: isolamento de seguranca, expiração/revogação explícitas, trilha de auditoria clara.
   - Contras: requer migration e pequena complexidade adicional.
   - Risco: baixo/medio (melhor governanca).

3. **Token assinado sem persistencia**
   - Prós: reduz armazenamento de token.
   - Contras: revogacao e auditoria mais complexas; exige desenho criptografico robusto.
   - Risco: medio.

4. **View de compatibilidade**
   - Prós: desbloqueio rapido.
   - Contras: mascara divergencia estrutural e acumula divida tecnica.
   - Risco: medio/alto.

## 14) Recomendacao tecnica

## Recomendacao principal

- **Adotar tabela separada de links publicos** (modelo de acesso publico desacoplado de `sales_proposals`), com:
  - token/hash unico,
  - expiracao,
  - status (ativo/revogado/usado),
  - metadados de auditoria.

## Justificativa

1. Reduz exposicao publica do modelo transacional de propostas.
2. Evita acoplamento excessivo no schema canonico `sales_*`.
3. Facilita controles de seguranca (revogacao, limitacao temporal, rastreabilidade).

## 15) Menor caminho seguro para desbloquear teste positivo sintetico

1. Introduzir mecanismo de link publico (preferencia: tabela separada).
2. Adaptar somente `proposal-public-view` para `sales_*` + mecanismo de link.
3. Revalidar fase negativa.
4. Executar teste positivo sintetico controlado.

## 16) Plano de fases sugerido

- **Fase 10L:** migration controlada para mecanismo de token/link publico (preferencialmente tabela separada).
- **Fase 10M:** adaptacao de codigo da `proposal-public-view` para `sales_proposals` / `sales_proposal_items`.
- **Fase 10N:** deploy controlado da funcao adaptada.
- **Fase 10O:** validacao negativa.
- **Fase 10P:** teste positivo sintetico.

## 17) Respostas diretas (perguntas obrigatorias)

1. **E possivel adaptar sem migration?**
   - **Nao, de forma segura completa**, porque falta mecanismo de token/expiracao no modelo `sales_*`.

2. **Se nao for possivel, qual migration minima seria necessaria?**
   - Criar mecanismo de link publico com token + expiracao (preferencialmente tabela dedicada).

3. **Melhor token em `sales_proposals` ou tabela separada?**
   - **Tabela separada** (melhor isolamento e governanca).

4. **Qual opcao reduz mais risco de exposicao publica?**
   - Tabela separada de links publicos (com revogacao/expiração/auditoria).

5. **Qual opcao evita mais divida tecnica?**
   - Adaptacao definitiva para `sales_*` + camada dedicada de link publico (sem view temporaria).

6. **Qual opcao afeta menos frontend/funcoes existentes?**
   - Curto prazo: campos diretos em `sales_proposals`.
   - Medio/longo prazo seguro: tabela separada + adaptacao faseada.

7. **O teste positivo sintetico pode ser retomado depois de qual correcao?**
   - Depois de 10L + 10M (mecanismo de token/expiracao + adaptacao da `proposal-public-view`) e nova validacao negativa.

## 18) Criterios para nao prosseguir

- Falta de mecanismo seguro de token/expiracao.
- Dúvida sobre mapeamento de campos criticos (`contacts` vs `company_contacts`, valores em cents).
- Ausencia de plano de rollback/observabilidade para endpoint publico.

