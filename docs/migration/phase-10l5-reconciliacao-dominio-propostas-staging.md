# Fase 10L.5 - Reconciliacao do dominio de propostas no staging

## 1) Objetivo

Realizar reconciliacao read-only entre staging linked e repositorio para decidir formalmente qual modelo de propostas deve ser tratado como canonico para continuidade segura da migracao:

- `public.proposals` / `public.proposal_items`; ou
- `public.sales_proposals` / `public.sales_proposal_items`; ou
- outro modelo.

## 2) Ambiente

- Repositorio: `qualyvac-migration`
- Branch inicial validada: `main` limpa e atualizada
- Branch da fase: `phase-10l5-reconciliacao-dominio-propostas-staging`
- Escopo: somente leitura (sem alterar banco/schema/codigo/config)

## 3) Project ref

Validado com `npx supabase projects list`:

- `REFERENCE ID`: `cansbrrwrprcycjvgvqm`
- `NAME`: `crm-qualyvac-staging`
- Projeto marcado como `LINKED` durante toda a fase.

## 4) Evidencias do banco staging (read-only)

### 4.1 Contexto da conexao

`select current_database(), current_schema(), current_user, now();`

Resultado:

- `current_database = postgres`
- `current_schema = public`
- `current_user = postgres`

### 4.2 Existencia dos objetos chave de dominio

`select to_regclass(...)` para propostas e sales_proposals:

- `public.proposals = proposals`
- `public.proposal_items = proposal_items`
- `public.sales_proposals = null`
- `public.sales_proposal_items = null`
- `public.sales_proposal_public_links = null`

### 4.3 Inventario de tabelas `public`

`information_schema.tables` confirmou presencia de:

- `proposals` (BASE TABLE)
- `proposal_items` (BASE TABLE)
- `proposal_access_logs` (BASE TABLE)
- `proposal_payment_conditions` (BASE TABLE)

Nao foram encontrados objetos `sales_proposals`/`sales_proposal_items`.

### 4.4 Busca por objetos de nomenclatura de proposta

Filtro por `%proposal%|%proposta%|%quote%|%quotation%|%orcamento%` retornou:

- objetos `proposal*` e `quick_quote*` em `public`;
- nenhum `sales_proposal*`.

### 4.5 Estado de migrations no staging

Consultas em `supabase_migrations.schema_migrations`:

- `20260118163027` aparece aplicada;
- `20260620220000` nao aparece aplicada.

Conclusao: base de `proposals` esta materializada no staging; migration 10L.2 segue pendente e bloqueada.

## 5) Evidencias das migrations locais

### 5.1 Migration que cria o dominio `proposals`

Arquivo:

- `supabase/migrations/20260118163027_fdaa771b-21c5-4b33-8f53-ca503f8c1fc8.sql`

Esse arquivo cria:

- `public.proposals`
- `public.proposal_items`
- `public.orders`
- `public.order_items`

### 5.2 Migrations que alteram `proposals`/`proposal_items`

`rg` mostrou extensa cadeia de alteracoes posteriores (exemplos):

- `20260118170452...` (alteracoes em `public.proposals`)
- `20260118224452...` (adiciona `approval_token` e `approval_token_expires_at`)
- `20260214170029...` (tenant_id e indices)
- `20260305000616...`, `20260308183741...`, `20260308193237...`
- `20260607175417...` e outras de 2026 ajustando funcoes/indices/regras

### 5.3 Evidencia de migration para `sales_proposals`

Nao foi encontrada migration local criando `public.sales_proposals` ou `public.sales_proposal_items`.
Unica ocorrencia e a FK da migration 10L.2:

- `supabase/migrations/20260620220000_create_sales_proposal_public_links.sql`

## 6) Evidencias de codigo/frontend/funcoes

Inspecao em `src` e `supabase/functions` mostrou uso predominante e consistente de `proposals`/`proposal_items`.

### 6.1 Frontend

Exemplos:

- `src/components/proposals/ProposalsList.tsx` -> `.from('proposals')`
- `src/components/proposals/ProposalDialog.tsx` -> `.from('proposals')` e `.from('proposal_items')`
- Atualizacao de token no frontend: `approval_token`, `approval_token_expires_at`

### 6.2 Edge Functions

Exemplos:

- `supabase/functions/proposal-public-view/index.ts` -> `.from('proposals')`, `.from('proposal_items')`
- `supabase/functions/proposal-approve/index.ts` -> `.from('proposals')`, token fields
- `supabase/functions/generate-proposal-pdf/index.ts` -> `.from('proposals')`, `.from('proposal_items')`

### 6.3 `sales_proposals` em codigo

Nao ha evidencias concretas de uso ativo de `sales_proposals`/`sales_proposal_items` no codigo atual.

## 7) Comparativo `proposals` vs `sales_proposals`

### 7.1 `proposals` / `proposal_items`

Vantagens:

- Materializado no staging atual;
- Cadeia de migrations existente e aplicada;
- Modelo efetivamente usado por frontend + Edge Functions;
- Menor risco para destravar `proposal-public-view`.

Desvantagem:

- Pode nao refletir visao arquitetural documentada em fases intermediarias.

### 7.2 `sales_proposals` / `sales_proposal_items`

Vantagens:

- Nome pode refletir uma intencao futura de dominio.

Desvantagens:

- Nao materializado no staging;
- Sem migration local de criacao;
- Sem aderencia ao codigo atual;
- Exigiria mudanca estrutural ampla antes de destravar links publicos.

## 8) Hipotese principal

O modelo `sales_*` foi inferido/planejado em documentacao, mas nao esta materializado nem sustentado por migrations reais no estado atual do repositorio e do staging linked.

O modelo operacional real, no momento, e `public.proposals` / `public.proposal_items`.

## 9) Decisao recomendada

Decisao tecnica recomendada para continuidade segura imediata:

**adotar `proposals` como canonico operacional para desbloquear fase de links publicos e manter `sales_*` como hipotese futura separada de refactor.**

## 10) Riscos

1. Divergencia documental se continuar mencionando `sales_*` sem materializacao real.
2. Regressao funcional caso se force `sales_*` sem plano amplo de migracao de codigo.
3. Risco de acoplamento indevido se 10L.2 continuar referenciando tabela inexistente.

## 11) Plano de correcao em fases (documental)

1. **Fase 10L.6 (planejamento):** definir estrategia para links publicos baseada em `proposals`.
2. **Fase 10L.7 (DDL controlada):** criar migration nova para links publicos referenciando `public.proposals` (hash-only, RLS, sem policy publica).
3. **Fase 10L.8 (aplicacao controlada):** aplicar migration em staging com dry-run estrito.
4. **Fase 10L.9 (adaptacao funcao):** ajustar `proposal-public-view`/`proposal-approve` para nova tabela de links.
5. **Fase 10L.10 (validacao):** testes negativos/positivos sinteticos.

## 12) Criterios para retomar criacao dos links publicos

Retomar somente quando:

1. FK apontar para tabela base realmente existente no staging (`public.proposals`);
2. dry-run mostrar somente a migration alvo;
3. consultas read-only confirmarem criacao da tabela, indices e RLS;
4. nenhuma policy publica/anonima for criada;
5. funcao publica retornar payload minimo e sem vazamento.

## 13) Respostas objetivas solicitadas

1. **O dominio de propostas existe hoje no staging?**  
   Sim, como `public.proposals` e `public.proposal_items`.
2. **Se nao existe, qual migration local mais confiavel cria o dominio?**  
   N/A; existe. A base e `20260118163027...`.
3. **O codigo atual espera qual modelo?**  
   `proposals` / `proposal_items`.
4. **O frontend atual espera qual modelo?**  
   `proposals` / `proposal_items`.
5. **As Edge Functions atuais esperam qual modelo?**  
   `proposals` / `proposal_items` com `approval_token`.
6. **Existe evidencia concreta de `sales_proposals` alem da 10L.2/documentacao?**  
   Nao.
7. **Qual modelo tem mais aderencia ao codigo atual?**  
   `proposals`.
8. **Qual modelo exige menor risco para desbloquear `proposal-public-view`?**  
   `proposals`.
9. **Qual modelo evita maior divida tecnica agora?**  
   `proposals` como canonico operacional, com eventual refactor futuro separado.
10. **Menor correcao segura para criar base de propostas no staging?**  
   Nao precisa criar base (ja existe); precisa criar links publicos com FK para `proposals`.
11. **Destino da migration 10L.2 (`20260620220000`):**  
   Recomenda-se **substituir por nova abordagem** (nova migration baseada em `public.proposals`) em vez de manter dependencia em `sales_proposals` inexistente.
