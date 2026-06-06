# Regra global: dados em MAIÚSCULAS

## Objetivo
Padronizar todo texto curto do sistema (nomes, descrições, endereços, observações) em letras MAIÚSCULAS — tanto na entrada (digitação) quanto no armazenamento — e normalizar os dados já existentes nas tabelas principais.

## Escopo

### Campos convertidos para UPPERCASE
- **Nomes**: `companies.name`, `companies.fantasia`, `contacts.first_name`, `contacts.last_name`, `products.name`, `products.nome_impresso`, `deals.name`, `pipelines.name`, etc.
- **Descrições / observações**: `products.description`, `companies.notes`, `contacts.notes`, `deals.notes`, `orders.notes`, `order_items.observacao`, `order_items.observacao_pcp`, `order_items.ordem_compra`, `deals.lost_reason`, etc.
- **Endereço**: `address`, `address_number`, `neighborhood`, `city`, `state`, `complement`
- **Outros textos curtos**: `industry`, `department`, `job_title`, `inscricao_estadual`, `origin`

### Campos PRESERVADOS (sem uppercase)
- E-mails (`email`), URLs/sites (`website`, `linkedin_url`, `domain`)
- Senhas, tokens, chaves de API, IDs externos
- Documentos só-numéricos: `cnpj`, `cpf`, `phone`, `mobile`, `zip_code`
- SKU/códigos já gerados automaticamente (já são uppercase)
- JSON técnico, payloads ERP, logs, custom_fields (chaves)
- Corpos longos: e-mails enviados (`email_logs.body`), mensagens WhatsApp, conteúdo de bots
- Arquivos, paths, mime types

## Implementação

### 1. Camada de entrada (frontend)
Criar utilitário `src/lib/textCase.ts`:
- `toUpperSafe(value)` — converte preservando `null`/`undefined`
- Componente `<UpperInput />` wrapper de `Input` que aplica `toUpperCase()` em `onChange` e mantém posição do cursor
- Componente `<UpperTextarea />` equivalente

Aplicar nos formulários de:
- `CustomerNew.tsx` / `CustomerDetail.tsx` (campos de nome, endereço, observações)
- `OrderDialog.tsx` / `OrderItemDetailModal.tsx` (observações, ordem_compra, observacao_pcp)
- `Products.tsx` (modal de produto: nome, descrição, nome_impresso)
- `QuickCreateCompanyModal.tsx` / `QuickCreateContactModal.tsx`
- Demais formulários de Companies, Contacts, Deals, Pipelines, Carriers

Manter `Input` normal para e-mail, telefone, CNPJ/CPF, URLs, senhas.

### 2. Camada de banco (defesa)
Trigger genérico `enforce_uppercase_text()` aplicado via `BEFORE INSERT OR UPDATE` nas tabelas-alvo, normalizando apenas as colunas listadas (whitelist por tabela). Isso garante consistência mesmo se algum caminho de código esquecer de aplicar o uppercase (ex.: imports CSV, edge functions, integrações).

Tabelas com trigger:
- `companies`, `contacts`, `products`, `deals`, `orders`, `order_items`, `pipelines`, `carriers`, `tasks` (título/descrição)

### 3. Backfill histórico
Migration única com `UPDATE` em massa nas tabelas principais, usando `SET LOCAL session_replication_role = replica` para não disparar triggers de sincronização ERP e não marcar registros como "Desatualizado":

- `companies`: name, fantasia, address, neighborhood, city, state, complement, industry, inscricao_estadual, origin, notes
- `contacts`: first_name, last_name, job_title, department, notes
- `products`: name, nome_impresso, description (preservando SKU/erp_versao que já são uppercase)
- `deals`: name, notes, lost_reason
- `orders`: notes
- `order_items`: observacao, observacao_pcp, ordem_compra

## Arquivos afetados

**Novos**
- `src/lib/textCase.ts`
- `src/components/ui/upper-input.tsx`
- `src/components/ui/upper-textarea.tsx`
- `supabase/migrations/<timestamp>_uppercase_enforcement_and_backfill.sql`

**Editados (formulários — substituir `<Input>`/`<Textarea>` em campos de texto puro)**
- `src/pages/CustomerNew.tsx`, `CustomerDetail.tsx`, `Products.tsx`, `Pipeline.tsx`, `Carriers.tsx`
- `src/components/orders/OrderDialog.tsx`, `OrderItemDetailModal.tsx`
- `src/components/pipeline/QuickCreateCompanyModal.tsx`, `QuickCreateContactModal.tsx`
- Demais modais de criação/edição de Company/Contact/Deal

## Memória do projeto
Após implementação, adicionar regra Core em `mem://index.md`:
> Todos os campos de texto livre (nomes, descrições, endereços, observações) são armazenados e exibidos em MAIÚSCULAS. E-mails, URLs, documentos e senhas preservam o case original.

## Fora do escopo
- E-mails, URLs, telefones, CNPJ/CPF, senhas, tokens
- Conteúdo de mensagens WhatsApp e corpos de e-mail
- Custom fields dinâmicos (chaves JSON)
- Dados de tabelas auxiliares de logs/auditoria
