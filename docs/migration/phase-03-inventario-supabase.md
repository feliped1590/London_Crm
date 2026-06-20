# Fase 03 — Inventário técnico do Supabase atual

Escopo desta análise: leitura da pasta `supabase`, arquivos de configuração relacionados e integração Supabase do frontend (`src/integrations/supabase/client.ts`), sem alterações em código SQL/TS.

## 1. Resumo da estrutura da pasta supabase

- `supabase/config.toml`: configuração do projeto e flags `verify_jwt` por Edge Function.
- `supabase/migrations`: histórico de evolução do schema, RLS, funções SQL/RPC, triggers e grants.
- `supabase/functions`: Edge Functions Deno (`index.ts`) + pasta `_shared` com utilitários reutilizados.
- `project_id` atual em `config.toml`: `lusyhkizwoihixcvcgap`.

## 2. Quantidade de migrations

- Total de migrations SQL encontradas: **395** arquivos em `supabase/migrations`.

## 3. Lista de Edge Functions encontradas

Total de funções implantáveis (excluindo `_shared`): **50**

- `ai-assistant`
- `analyze-whatsapp-conversation`
- `calcular-tributacao`
- `create-user`
- `credit-analysis`
- `delete-user`
- `enrich-companies-batch`
- `enrich-company-single`
- `erp-import-companies`
- `erp-import-contacts`
- `erp-import-orders`
- `erp-import-products`
- `erp-import-products-staging`
- `erp-promote-products`
- `execute-automation`
- `generate-order-pdf`
- `generate-proposal-pdf`
- `generate-quick-quote-pdf`
- `generate-report-pdf`
- `generate-signed-url-secure`
- `google-calendar-oauth`
- `google-calendar-sync`
- `google-calendar-webhook`
- `import-companies-bulk`
- `import-companies-from-file`
- `import-ncm-tipi`
- `import-products-csv`
- `lookup-cnpj`
- `lookup-ncm-online`
- `process-attribute-sync`
- `process-company-sync`
- `process-order-sync`
- `process-product-sync`
- `process-scheduled-emails`
- `process-task-reminders`
- `proposal-approve`
- `proposal-public-view`
- `prospecting-save-lead`
- `prospecting-search`
- `send-bulk-email`
- `send-email`
- `update-user`
- `validate-company-sync`
- `validate-ncm-semantic`
- `validate-order-sync`
- `validate-product-sync`
- `zapi-get-qrcode`
- `zapi-instance-status`
- `zapi-send-message`
- `zapi-webhook`

## 4. Classificação das Edge Functions por categoria

### ERP / Projedata (14)
- `erp-import-companies`
- `erp-import-contacts`
- `erp-import-orders`
- `erp-import-products`
- `erp-import-products-staging`
- `erp-promote-products`
- `process-attribute-sync`
- `process-company-sync`
- `process-order-sync`
- `process-product-sync`
- `validate-company-sync`
- `validate-order-sync`
- `validate-product-sync`
- `import-products-csv`

### PDFs (4)
- `generate-order-pdf`
- `generate-proposal-pdf`
- `generate-quick-quote-pdf`
- `generate-report-pdf`

### IA / Lovable AI (4)
- `ai-assistant`
- `analyze-whatsapp-conversation`
- `lookup-ncm-online`
- `validate-ncm-semantic`

### E-mail (4)
- `send-email`
- `send-bulk-email`
- `process-scheduled-emails`
- `process-task-reminders`

### WhatsApp / Z-API (4)
- `zapi-webhook`
- `zapi-send-message`
- `zapi-instance-status`
- `zapi-get-qrcode`

### Google Calendar (3)
- `google-calendar-oauth`
- `google-calendar-sync`
- `google-calendar-webhook`

### Autenticação / usuários (3)
- `create-user`
- `update-user`
- `delete-user`

### BI / relatórios (1)
- `generate-report-pdf`

### Outros (13)
- `calcular-tributacao`
- `credit-analysis`
- `enrich-companies-batch`
- `enrich-company-single`
- `execute-automation`
- `generate-signed-url-secure`
- `import-companies-bulk`
- `import-companies-from-file`
- `import-ncm-tipi`
- `lookup-cnpj`
- `proposal-approve`
- `proposal-public-view`
- `prospecting-save-lead`
- `prospecting-search`

## 5. Variáveis de ambiente e secrets utilizados pelas Edge Functions

Variáveis detectadas em `Deno.env.get(...)`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`
- `ZAPI_CLIENT_TOKEN`
- `RESEND_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PROJEDATA_API_URL`
- `PROJEDATA_API_TOKEN`
- `INIFLEX_API_URL`
- `INIFLEX_API_TOKEN`

Observações:

- A maioria das funções usa combinação `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` para operações administrativas.
- No frontend, a integração em `src/integrations/supabase/client.ts` usa:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- `.env.example` lista:
  - `VITE_SUPABASE_PROJECT_ID`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_URL`

## 6. Funções que dependem diretamente da Lovable

Dependência direta identificada (por `LOVABLE_API_KEY`, endpoint `ai.gateway.lovable.dev` ou link `.lovable.app`):

- `ai-assistant`
- `analyze-whatsapp-conversation`
- `lookup-ncm-online`
- `validate-ncm-semantic`
- `process-task-reminders` (gera URL com sufixo `.lovable.app`)

## 7. Funções que provavelmente precisam de service_role

Critério: presença explícita de `SUPABASE_SERVICE_ROLE_KEY` no código da function.

Funções com forte indicativo de necessidade de `service_role` (46):

- `ai-assistant`, `analyze-whatsapp-conversation`, `calcular-tributacao`
- `create-user`, `update-user`, `delete-user`
- `credit-analysis`
- `enrich-companies-batch`, `enrich-company-single`
- `erp-import-companies`, `erp-import-contacts`, `erp-import-orders`, `erp-import-products`, `erp-import-products-staging`, `erp-promote-products`
- `execute-automation`
- `generate-order-pdf`, `generate-proposal-pdf`, `generate-quick-quote-pdf`, `generate-report-pdf`, `generate-signed-url-secure`
- `google-calendar-oauth`, `google-calendar-sync`, `google-calendar-webhook`
- `import-companies-bulk`, `import-companies-from-file`, `import-ncm-tipi`, `import-products-csv`
- `lookup-ncm-online`
- `process-attribute-sync`, `process-company-sync`, `process-order-sync`, `process-product-sync`
- `process-scheduled-emails`, `process-task-reminders`
- `proposal-approve`, `proposal-public-view`
- `prospecting-save-lead`
- `send-bulk-email`, `send-email`
- `validate-company-sync`, `validate-order-sync`, `validate-product-sync`
- `zapi-get-qrcode`, `zapi-instance-status`, `zapi-webhook`

## 8. Funções com risco por `verify_jwt=false` no `config.toml`

### Ativas em código e com `verify_jwt=false` (28)
- `ai-assistant`
- `analyze-whatsapp-conversation`
- `create-user`
- `delete-user`
- `erp-import-companies`
- `erp-import-orders`
- `erp-import-products`
- `erp-import-products-staging`
- `erp-promote-products`
- `execute-automation`
- `generate-proposal-pdf`
- `generate-report-pdf`
- `import-ncm-tipi`
- `lookup-cnpj`
- `lookup-ncm-online`
- `process-company-sync`
- `process-scheduled-emails`
- `process-task-reminders`
- `proposal-approve`
- `proposal-public-view`
- `send-bulk-email`
- `send-email`
- `update-user`
- `validate-ncm-semantic`
- `zapi-get-qrcode`
- `zapi-instance-status`
- `zapi-send-message`
- `zapi-webhook`

### Entradas de `config.toml` sem function correspondente (stale config)
- `ai-copilot`
- `iniflex-customer-lookup`
- `iniflex-import-correntista`
- `iniflex-list-correntistas`
- `iniflex-sandbox-test`
- `iniflex-sync-company`
- `iniflex-sync-contact`
- `sync-iniflex-clients`
- `sync-iniflex-orders`
- `sync-iniflex-products`

Risco principal: superfície de ataque elevada se endpoints públicos com `verify_jwt=false` não tiverem autenticação compensatória robusta no corpo da função.

## 9. Migrations mais críticas por domínio

### Autenticação / base de autorização
- `20260112215643_d0eb393f-f6d5-4cef-9838-19374e87641d.sql`
  - Estrutura base (`profiles`, `user_roles`, entidades core), `has_role`, `is_authenticated`, RLS inicial.
- `20260124165251_abb4940b-02ee-40e6-9e05-9a953d03d0b4.sql`
  - Regras de ownership, auditoria e políticas importantes em entidades comerciais.

### RLS / segurança de acesso
- `20260425004215_505a8496-6efb-4855-a4ad-50de04a42f76.sql`
  - Policies de escopo para `contacts` com regras por `tenant`, owner e portfolio.
- `20260418174325_fb5f145e-cf21-4396-9f5e-31987b547bb4.sql`
  - `has_pipeline_access` + RLS de `pipeline_legal_entities`.

### Tenants / entidades legais
- `20260214203449_b431d852-a52a-4656-95f3-0842108e1120.sql`
  - Estrutura/policies de `legal_entities`.
- `20260405171108_16fb3687-3842-4185-ae62-f893562f3f02.sql`
  - Ajustes de policies por tenant e helper `get_user_tenant_ids`.

### Pedidos
- `20260201210459_4613efb6-e579-4cfc-a179-e196ffb0036e.sql`
  - `crm_orders` e `crm_order_items` com RLS e índices.
- `20260408003246_a27af1d4-5e5e-4ac2-98a5-0dc7ef32fefe.sql`
  - Fila/log de sync ERP (`order_sync_queue`, `order_sync_log`, trigger de enfileiramento).
- `20260416224133_df6aff49-33e1-41ca-9746-a5ad8b92d2c7.sql`
  - Regras de lock de pedidos e itens.

### Clientes / contatos
- `20260112215643_d0eb393f-f6d5-4cef-9838-19374e87641d.sql`
  - Tabelas fundacionais de `companies` e `contacts`.
- `20260322174402_0de697c8-f107-45e1-a1c4-f4166c7a34cd.sql`
  - Normalização de CNPJ raiz.
- `20260425004215_505a8496-6efb-4855-a4ad-50de04a42f76.sql`
  - Escopo e segurança refinados para contatos.

### Pipeline / negócios
- `20260417105437_a396fd19-1c5e-4374-b142-e5d020a06a18.sql`
  - `stage_status`, validações e trigger de consistência.
- `20260418165310_46ebbab0-36a6-46c3-997e-a0331f6485ae.sql`
  - Auditoria de classificação de estágio + função analítica de consistência.
- `20260418174325_fb5f145e-cf21-4396-9f5e-31987b547bb4.sql`
  - Relação pipeline x entidades legais (N:N) + integridade.

### ERP / sync / staging
- `20260404185346_09cca58c-1db5-4975-9ec2-c5c23a933cc6.sql`
  - Funções de marcação de sync de produto e políticas de logs.
- `20260519223543_4ce61673-2126-4939-b9b1-6e5177e8c3fb.sql`
  - Catálogo/mapeamentos de atributos ERP e fila de sync.
- `20260405203600_fix_promote_products_status_normalization.sql`
  - Correção de normalização no promote de staging.

### BI / relatórios
- `20260607175622_135c05cf-7884-4cf8-8c1b-53a5ff0f8c0d.sql`
  - Definições de relatórios, snapshots, helpers BI e grants iniciais.
- `20260615003836_194089af-07da-470c-8940-58fccbe0a3c1.sql`
  - Padronização de filtros com `legal_entity_id` nas RPCs `report_*`.
- `20260615004744_c139cc40-9ab1-47fe-ab00-33d49d999a85.sql`
  - Ajustes de grants/assinaturas de funções de BI para execução autenticada.

## 10. Riscos técnicos para recriar o Supabase em ambiente próprio

- Alto volume de migrations (395) com forte acoplamento entre RLS, triggers e funções SQL.
- Dependência de segredos externos (ERP, Google, Z-API, Resend, Lovable AI).
- `config.toml` com drift (funções obsoletas e funções novas fora do arquivo).
- Muitas functions em modo público (`verify_jwt=false`), exigindo hardening antes de exposição externa.
- Dependência de `SUPABASE_SERVICE_ROLE_KEY` em grande parte do backend serverless.
- Dependência direta de Lovable AI em funções de IA e de links `.lovable.app` em notificações.
- Risco de comportamento regressivo se ordem de aplicação das migrations não for reproduzida fielmente.
- Risco de quebra de autorização ao migrar sem validar policies/claims/roles por tenant.

## 11. Ordem recomendada para migração do backend

1. **Congelar baseline Supabase atual** (schema, functions, secrets, jobs, políticas).
2. **Provisionar novo projeto Supabase** (Auth, DB, Storage, Edge Runtime).
3. **Aplicar migrations em ordem cronológica** em ambiente de staging limpo.
4. **Validar estrutura de auth e RLS** (roles, tenant scoping, legal entities, pipeline access).
5. **Publicar Edge Functions por ondas**:
   - onda 1: auth/usuário e funções internas;
   - onda 2: ERP/sync;
   - onda 3: WhatsApp/Google/Email;
   - onda 4: IA/relatórios.
6. **Injetar secrets por ambiente** e testar integrações externas uma a uma.
7. **Endurecer segurança**: revisar `verify_jwt`, validar autenticação interna por function.
8. **Desacoplar Lovable** (IA gateway e links de domínio).
9. **Executar smoke tests E2E** (auth, clientes, pedidos, pipeline, ERP, BI).
10. **Cutover gradual com rollback definido** (banco + functions + frontend).

## 12. Checklist da Fase 03 com critérios de aceite

- [ ] Inventário completo de `supabase/functions` validado (50 funções).
- [ ] Inventário de variáveis/secrets por função concluído e revisado.
- [ ] Matriz `verify_jwt=false` classificada por risco (pública vs interna).
- [ ] Drift de `config.toml` documentado (stale vs ausentes).
- [ ] Migrations críticas por domínio mapeadas (auth/RLS/tenant/pedidos/clientes/pipeline/ERP/BI).
- [ ] Funções com dependência Lovable listadas e plano de substituição definido.
- [ ] Funções que usam `service_role` mapeadas e justificadas.
- [ ] Ordem de migração backend aprovada.
- [ ] Critérios de hardening mínimo definidos antes de produção.

### Critérios de aceite da Fase 03

- Documento técnico criado e versionável.
- Cobertura explícita dos 12 itens solicitados.
- Nenhuma alteração em código-fonte, migrations ou remoção de arquivos.
- Dados suficientes para iniciar Fase 04 (hardening/execução da migração backend).

