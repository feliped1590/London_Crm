> ERRATA / INVALIDAÇÃO DE TARGET
>
> Este documento foi gerado com base no projeto Supabase `nazymjfzjadfgovcfivs`, posteriormente confirmado como projeto não pertencente à migração atual.
>
> Portanto, os achados deste documento não devem ser usados para decisão de carga da migração Qualyvac atual.
>
> A auditoria 22D deve ser refeita no target correto:
> - restore-test: `nsnmlleplpzsefzkuxlb` / `crm-qualyvac-restore-test`
> - staging: `cansbrrwrprcycjvgvqm` / `crm-qualyvac-staging`, apenas quando autorizado.

# Fase 22D — Saneamento e mapeamento read-only das chaves ERP e vínculos mínimos

## 1. Resumo e contexto de execução

Esta fase executa apenas diagnóstico read-only para preparar a primeira carga real pequena.  
Nenhuma carga foi executada nesta fase.

- Branch analisada: `main` (alinhada com `origin/main` no início da fase).
- Base auditada: `https://nazymjfzjadfgovcfivs.supabase.co` (consultas `SELECT` apenas).
- Referências: `docs/migration/phase-22b-migration-waves-plan.md` e `docs/migration/phase-22c-first-real-load-spec.md`.
- Cutover completo permanece **NO-GO**.

## 2. Companies / Clientes — readiness de chave e vínculo

Leitura consolidada:

- Total: 2
- `document` preenchido: 2
- `cnpj` vazio: 2
- `document` como substituto prático de CNPJ (no snapshot): 2
- Duplicidades por `document`/`cnpj`: 0
- Sem responsável (`owner_id`) e sem `seller_name`: 0
- Registros com lacuna de contexto fiscal/localização (`city/state/IE/registration_type`): 2

Classificação:

- **APTO**: 2
- **APTO COM RESSALVA**: 0
- **BLOQUEADO**: 0

Regra proposta:

- `companies.document` pode substituir `companies.cnpj` no lote piloto se for único no escopo e houver aceite formal para chave temporária.

## 3. Products / Produtos — readiness ERP e transacional

Leitura consolidada:

- Total: 1
- Com `sku`: 1
- Com `erp_code`: 0
- Sem `erp_code`: 1
- Classificação técnica incompleta (tipo/grupo/subgrupo/família/classe/NCM): 0
- Apto para cadastro local: 1
- Apto para transacional: 0
- Bloqueado para transacional por ausência de ERP key: 1
- Bloqueado total: 0
- `product_sync_queue`: inexistente na base auditada

Classificação:

- **APTO PARA CADASTRO**: 1
- **APTO PARA TRANSACIONAL**: 0
- **BLOQUEADO PARA TRANSACIONAL**: 1
- **BLOQUEADO TOTAL**: 0

Regra crítica:

- Produto sem `erp_code` não entra em proposta/pedido quando a reconciliação ERP depender desta chave.

## 4. Orders / Pedidos — readiness de vínculo e reconciliação

Leitura consolidada:

- Total: 1
- Pedidos com itens: 1
- Pedidos com `order_number`: 1
- Pedidos sem `erp_code`: 1
- Pedidos com `company_id`: 1
- Pedidos com `seller_user_id` (equivalente de vendedor no modelo atual): 1
- Pedidos com `legal_entity_id`: 1
- Pedidos com item válido (`product_id` não nulo e `quantity > 0`): 0
- Detalhe de bloqueio: item do pedido atual está sem `product_id`

Classificação:

- **APTO PARA HISTÓRICO CRM**: 0
- **APTO PARA RECONCILIAÇÃO ERP**: 0
- **BLOQUEADO PARA TRANSACIONAL**: 0
- **BLOQUEADO TOTAL**: 1

Regra proposta:

- `orders.order_number` pode ser chave CRM interna; para reconciliação ERP, exigir `orders.erp_code` conforme contrato de integração.

## 5. Deals / Pipeline — readiness de vínculo com cliente e responsável

Leitura consolidada:

- Total: 8
- Com `company_id`: 2
- Sem `company_id`: 6
- Sem `company_id` mas com `company` textual: 6
- Match único de `company` textual -> `companies.name`: 0
- `owner_name` inconsistente com perfil vinculado: 5
- Deals com pipeline/stage: 8
- Deals com histórico (`deal_stage_history`): 8

Classificação:

- **APTO**: 2
- **APTO COM MAPEAMENTO**: 0
- **BLOQUEADO POR COMPANY**: 6
- **BLOQUEADO POR RESPONSÁVEL**: 5

Regra proposta:

- `deals.company` textual só pode sugerir `company_id` quando houver match único com evidência.
- `owner_name` só pode sugerir vínculo de usuário/vendedor quando houver match único comprovável.

## 6. Proposals / Propostas — readiness de vínculo e numeração

Leitura consolidada:

- Total: 1
- Com empresa: 1
- Com deal: 1
- Com itens: 1
- Com `proposal_number`: 1
- Duplicidade de `proposal_number`: 0

Classificação:

- **APTO**: 1
- **APTO COM RESSALVA**: 0
- **BLOQUEADO**: 0

## 7. Users / Profiles / Sales reps — readiness de vínculo operacional

Leitura consolidada:

- `profiles` totais: 4
- Com e-mail: 4
- Com `employee_code`: 1
- Com vínculo de legal entity (primário ou ativo): 4
- Sem vínculo de legal entity: 0
- Orders com `seller_user_id` resolvido em profile: 1/1
- Deals com `owner_id` resolvido em profile: 8/8

Lacunas estruturais no modelo atual (tabelas não encontradas):

- `sales_reps`
- `user_sales_reps`
- `user_tenants`
- `user_legal_entities`

Classificação:

- **APTO**: 4 perfis (modelo atual baseado em `profiles`)
- **APTO COM RESSALVA**: 0
- **BLOQUEADO**: 0

Ressalva:

- Como as tabelas canônicas de vendedor/vínculos não existem no snapshot, usar `profiles` + campos de owner/seller como mapeamento transitório documentado.

## 8. Matriz de saneamento (origem -> destino)

| Entidade | Registro | Problema | Chave atual | Chave necessária | Regra proposta | Severidade | Status |
| -------- | -------- | -------- | ----------- | ---------------- | -------------- | ---------- | ------ |
| `companies` | 2/2 | `cnpj` vazio | `document` | `cnpj` (ou `document` formalizado) | aceitar `document` temporário se único no escopo | ALTA | PENDENTE MAPEAMENTO |
| `products` | 1/1 | sem `erp_code` | `sku` | `erp_code` para transacional | permitir só cadastro local até preencher ERP key | CRÍTICA | BLOQUEADO |
| `orders` | 1/1 | sem `erp_code` | `order_number` | `erp_code` para reconciliação ERP | histórico CRM possível só após corrigir itens | CRÍTICA | BLOQUEADO |
| `orders` | 1/1 | item sem `product_id` | item textual | item referenciado | exigir item com `product_id` válido | CRÍTICA | BLOQUEADO |
| `deals` | 6/8 | sem `company_id` | `company` textual | `company_id` | mapear apenas com match único comprovável | CRÍTICA | BLOQUEADO |
| `deals` | 5/8 | `owner_name` inconsistente | `owner_name` | vínculo por `owner_id`/seller | priorizar vínculo por ID; texto só como evidência auxiliar | ALTA | PENDENTE MAPEAMENTO |
| `profiles` | 3/4 | sem `employee_code` | `email` | `employee_code` quando exigido no domínio vendedor | obrigatório apenas onde processo comercial exigir | MÉDIA | APTO COM RESSALVA |
| modelo vendedor | n/a | ausência de `sales_reps` e relacionamentos | `seller_user_id` | modelo de vendedor formal | definir contrato de mapeamento transitório na Onda 0 | ALTA | PENDENTE MAPEAMENTO |

Resumo por severidade:

- **CRÍTICA**: 3 tipos de bloqueio
- **ALTA**: 3 tipos de bloqueio
- **MÉDIA**: 1 tipo de ressalva
- **BAIXA**: 0

## 9. Proposta de regras de mapeamento

- `companies.document` substitui `companies.cnpj` somente se:
  - preenchido;
  - único no escopo do lote;
  - validado/aceito formalmente para uso temporário.
- `products.sku` pode ser chave temporária apenas para cadastro local.
- `products.erp_code` é obrigatório para transacional com ERP.
- `orders.order_number` serve como chave CRM interna; `orders.erp_code` é obrigatório se houver reconciliação ERP.
- `deals.company` textual pode sugerir `company_id`, mas exige match único com evidência.
- `owner_name` pode sugerir usuário/vendedor, mas exige match único com evidência.

## 10. Primeira carga pequena — readiness e saída da Onda 0

### Readiness recomendada

- **Opção A — Cadastro apenas**: viável agora com ressalvas.
  - `legal_entities`
  - `profiles` (modelo atual)
  - `companies`
  - `company_contacts` (quando houver dados)
  - `products` sem sync real
- **Opção B — Cadastro + transacionais mínimos**: **não recomendada neste momento**.
  - bloqueada por `products.erp_code` ausente, `orders.erp_code` ausente, `deals.company_id` faltante e inconsistência de responsável.

### Critérios objetivos para sair da Onda 0

- 100% dos produtos transacionais do lote com `erp_code`.
- 100% dos pedidos transacionais do lote com chave definida e itens válidos.
- 100% dos deals do lote com `company_id`.
- 100% dos responsáveis/vendedores do lote resolvidos por chave estável.
- 0 duplicidades nas chaves do lote.
- 0 órfãos no lote.
- rollback documentado por lote.
- sync real desabilitado.

## 11. Decisão final

- **GO para montagem imediata do lote transacional**: **NÃO**.
- **PARCIAL para lote apenas cadastral (Opção A)**: **SIM**.
- **NO-GO para transacional/cutover completo**: **SIM**.

Próxima fase recomendada:

- **Fase 22E**: montagem do dataset/lote em dry-run/preview após saneamento mínimo de ERP keys e vínculos críticos.
