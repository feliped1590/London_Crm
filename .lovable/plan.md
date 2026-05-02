# PRD Técnico — Geração para migração ao Cursor IDE

## Objetivo
Gerar um documento Markdown completo (`PRD_QualyVac_CRM.md`) descrevendo o projeto de forma fiel ao código atual, pronto para ser usado como arquivo de regras (`.cursor/rules/`) no Cursor IDE.

## Escopo do documento
O PRD será dividido em 7 seções, cobrindo o que foi solicitado mais o essencial para que o Cursor compreenda o projeto:

1. **Visão geral do produto** — Multi-tenant CRM com ERP Projedata, WhatsApp (Z-API), motor fiscal (Reforma Tributária 2026), portfólio de vendedores, propostas públicas e bots conversacionais.

2. **Stack tecnológica** — Versões reais extraídas de `package.json`:
   - Build: Vite 5.4 + `@vitejs/plugin-react-swc`, TypeScript 5.8
   - UI: React 18.3, React Router 7, Tailwind 3.4 + `tailwindcss-animate` + `@tailwindcss/typography`
   - Componentes: shadcn/ui sobre Radix UI (~30 primitivos), Lucide Icons, Sonner, Vaul, cmdk, Embla
   - Estado/Dados: TanStack Query 5 (+ persister), React Hook Form + Zod, date-fns
   - Especialistas: `@dnd-kit`, `@xyflow/react` (bot builder), FullCalendar, Recharts, `read-excel-file`
   - Backend: Supabase (`@supabase/supabase-js` 2.90) — Postgres + Auth + Storage + Edge Functions (Deno)

3. **Arquitetura de dados (Supabase)** — Schema resumido por domínio (130+ tabelas em `public`):
   - **Multi-tenancy & Auth**: `tenants`, `tenant_settings`, `user_legal_entities`, `legal_entities`, `profiles`, `user_roles`, `app_sessions`, `manager_users`, `license_settings`
   - **CRM Core**: `companies`, `contacts`, `deals`, `deal_stage_history`, `deal_participants`, `pipelines`, `pipeline_stages`, `pipeline_legal_entities`, `tasks`, `activities`, `entity_notes`
   - **Comercial/Pedidos**: `orders`, `order_items`, `order_approvals`, `order_status_transitions`, `proposals`, `proposal_items`, `pricing_tables`, `pricing_rules`, `pricing_table_assignments`
   - **Produtos & Estoque**: `products`, `product_families/groups/subgroups/classes/types`, `product_stock`, `stock_movements`, `company_products`
   - **Fiscal (Reforma 2026)**: `ncm_codes`, `ncm_fiscal_rules`, `regras_tributacao`, `beneficios_fiscais`, `cliente_beneficios_fiscais`, `credito_presumido_regras`, `cadastro_imposto_seletivo`, `transicao_tributaria_parametros`, `documento_fiscal_snapshot`, `split_payment_registros`
   - **ERP Projedata**: `*_sync_queue`, `*_sync_log`, `erp_sequences`, `*_erp_data`, `*_erp_mapping`, `erp_cities`, `erp_clients_cache`
   - **WhatsApp & Bots**: `whatsapp_*`, `bots`, `bot_flows`, `bot_flow_nodes/edges`, `bot_sessions`
   - **Auditoria/Governance**: `audit_logs`, `*_audit_log`, `access_violation_log`, `admin_intervention_log`, `portfolio_transfers`, `customer_transfer_requests`
   - **Outros**: `credit_analyses`, `prospecting_*`, `google_calendar_*`, `notifications`, `sales_reps`, `sales_goals`, `carriers`
   - Convenção de RLS: `tenant_id` (sem FK) + `user_legal_entities` + `has_role()` SECURITY DEFINER
   - `sales_rep_id` é fonte canônica de ownership (`owner_id` é fallback/auditoria)

4. **Mapa de rotas e páginas** — Tabela completa extraída de `src/App.tsx`:
   - Públicas: `/auth`, `/access-blocked`, `/proposta/:token`
   - Protegidas (dentro de `AppLayout`): `/today`, `/customers`, `/customers/new`, `/customers/:id`, `/companies`, `/contacts`, `/pipeline`, `/products`, `/orders`, `/stock`, `/carriers`, `/tasks`, `/whatsapp`, `/bots/:id`, `/emails`, `/reports`, `/insights`, `/prospecting`, `/settings`, `/integrations`, `/import-companies`
   - Para cada página: arquivo, hooks principais, componentes filhos relevantes (ex.: `Pipeline.tsx` → `usePipelineData`, `usePipelines`, kanban com `@dnd-kit`)

5. **Lógica de negócio** — Baseada nas memórias do projeto:
   - **Lead → Cliente**: Deal em pipeline comercial → estágio "Ganho" + automação de proposta → aprovação pública gera Order → sync ERP
   - **Pricing engine**: hierarquia `Tabela do Cliente > Regra de Produto > Tabela Padrão > Preço Base`; `unit_price` do CRM é soberano sobre ERP
   - **Order workflow**: Stages específicos para "Pronta Entrega" vs "Produção"; pré-validação por `validate-order-sync` + queue `blocked_validation`
   - **ERP sync (Projedata)**: prevenção de loop via `origem_alteracao` (CRM/ERP/SYNC), `erp_versao` obrigatório, IDs sequenciais atômicos via `erp_sequences`
   - **Multi-CNPJ**: pedido exige `cd_empresa` casando `legal_entity` do CRM
   - **Fiscal Engine**: cálculo automático de impostos, validação NCM por IA, Reforma Tributária 2026 (CBS/IBS/IS, split payment)
   - **Portfolio**: 60 dias de inatividade → highlight; transferências em `portfolio_transfers`; UI bloqueia interação com clientes de outros vendedores
   - **Auth**: 1 sessão concorrente por usuário (`app_sessions` + `pg_advisory_xact_lock`); login mais recente substitui anterior
   - **Pipelines operacionais vs comerciais**: regras comerciais (proposta/aprovação) só em pipelines `sales`
   - **RBAC**: roles `admin`, `vendedor` (+ Sales, Support, Dev, Ops via `role_module_permissions`); Dev tem acesso a Reset Orders, ERP Settings, Payload Simulator
   - **Lovable AI Gateway**: usado em `ai-assistant`, `validate-ncm-semantic`, `analyze-whatsapp-conversation`, `credit-analysis` (sem API key do usuário)

6. **Edge Functions (47)** — Agrupadas por domínio: ERP sync (10), Email/PDF (5), Fiscal/NCM (4), WhatsApp Z-API (4), Google Calendar (3), Auth/Users (3), Prospecting (2), Proposals (2), Lookup externo (CNPJ/NCM) (2), Bots/Imports/IA (resto).

7. **Guia de estilo** — Extraído de `src/index.css` e `tailwind.config.ts`:
   - Tema: dark/light com tokens HSL semânticos
   - Cores principais (light): `--primary 217 91% 48%` (azul corporativo), `--secondary-accent 199 89% 55%`, `--background 220 20% 97%`
   - Cores de pipeline: prospeccao (roxo 263), qualificacao (258), proposta (laranja 38), negociacao (azul 217), ganho (verde 142), perdido (vermelho 0)
   - Status: success/warning/info/destructive como tokens
   - Tipografia: Inter (font-feature-settings: cv11, ss01, ss03), `text-responsive-h1/h2/h3` com `clamp()`
   - Sidebar: tema dark elegante mesmo em light mode
   - Gradientes: 3 níveis (`primary-strong/soft/whisper`) + `subtle`
   - Glow: 3 níveis (`hover/active/cta`)
   - Motion: `--motion-fast 150ms`, `--motion-base 200ms`, `--motion-slow 280ms`
   - Utilitários: `surface-glass` (backdrop-blur), `hover-lift`, `shimmer`, `kpi-value/label/trend`, `story-link`
   - Radius: `0.625rem` base
   - Layout: sidebar 256px (collapsed 64px), header 56px, content padding `clamp(16px, 2vw, 24px)`
   - Regra de design (memória): NUNCA usar cores diretas (text-white, bg-black) — sempre tokens HSL

## Anexos
- **Estrutura de pastas** (`src/components`, `src/hooks`, `src/pages`, `src/types`, `supabase/functions`, `supabase/functions/_shared/projedata`)
- **Variáveis de ambiente** esperadas (`.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (auto-geradas pelo Lovable; no Cursor precisarão ser configuradas manualmente apontando para o mesmo projeto Supabase)
- **Aviso de migração**: `src/integrations/supabase/client.ts` e `types.ts` são auto-gerados pelo Lovable — no Cursor, regenerar via `supabase gen types typescript`

## Entrega
- Arquivo único: `/mnt/documents/PRD_QualyVac_CRM.md`
- Formato Markdown, ~25–35 KB, com índice navegável, tabelas e blocos de código
- Ao final será emitido um `<lov-artifact>` para download direto

## Coleta complementar antes de escrever
Antes de gerar o documento, lerei rapidamente:
- `src/components/layout/AppSidebar.tsx` (módulos do menu)
- `src/hooks/useAuth.tsx` e `src/hooks/usePipelines.ts` (regras chave)
- `supabase/functions/process-order-sync/index.ts` (fluxo ERP canônico)
- Schema real via `supabase--read_query` (colunas das ~25 tabelas centrais) para garantir fidelidade dos tipos

Após sua aprovação, executo a coleta e escrevo o arquivo.
