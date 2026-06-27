> INVALIDADO PARA A MIGRAÇÃO ATUAL
>
> Este documento foi gerado a partir do projeto Supabase `nazymjfzjadfgovcfivs` / `Qualyvac_Group_CRM`, confirmado posteriormente como projeto não pertencente à migração atual.
>
> Não usar este documento para carga, preview, reconciliação ou decisão de migração.
>
> Projetos corretos da trilha atual:
> - `nsnmlleplpzsefzkuxlb` / `crm-qualyvac-restore-test`
> - `cansbrrwrprcycjvgvqm` / `crm-qualyvac-staging`

# Fase 22E — Preview do Dataset Cadastral

## 1. Resumo executivo

Esta fase foi executada em modo **preview/dry-run** e **não executa carga**.

- Sem escrita no banco.
- Sem entidades transacionais.
- Sem ERP/sync real.
- Objetivo: preparar um lote cadastral candidato para futura fase controlada.

## 2. Target analisado

- Supabase auditado: `https://nazymjfzjadfgovcfivs.supabase.co`
- Referência de projeto: `nazymjfzjadfgovcfivs`
- Observação: ainda requer confirmação formal como destino definitivo da carga (risco residual).

## 3. Escopo incluído

Entidades incluídas no preview:

- `legal_entities`: 1 selecionada (de 4 disponíveis)
- `profiles`: 4 selecionados (limite 2-5 atendido)
- `companies`: 2 selecionadas
- `company_contacts`: 0 selecionados (sem registros válidos no snapshot)
- `products`: 1 selecionado (apenas cadastro local)
- Auxiliares de produto:
  - `product_types`: 3
  - `product_groups`: 5
  - `product_subgroups`: 5
  - `product_families`: 3
  - `product_classes`: 3

## 4. Escopo excluído

Excluídos explicitamente do dataset 22E:

- `deals`
- `deal_stage_history`
- `sales_proposals`
- `sales_proposal_items`
- `orders`
- `order_items`
- filas (`erp_sync_jobs` e equivalentes)
- `audit_events`
- `user_sessions`
- `session_login_history`
- integrações ERP/API
- notificações automáticas
- anexos grandes e histórico completo

## 5. Regras de seleção

- `legal_entities`: selecionada 1 entidade principal com identificador claro (`code='QV'`).
- `profiles`: e-mail obrigatório; ausência de `employee_code` tratada como ressalva, não bloqueio cadastral.
- `companies`: `document` aceito como chave substituta de `cnpj` somente para preview; ausência de ambos bloquearia (não ocorreu).
- `company_contacts`: incluídos apenas contatos vinculados a companies do lote (não houve registros).
- `products`: permitidos sem `erp_code` apenas para cadastro local; sempre marcados como bloqueados para transacional.
- Auxiliares de produto: incluídos para consistência de classificação.

## 6. Dataset candidato

| Entidade | Selecionados | Aptos | Com ressalva | Bloqueados |
| -------- | -----------: | ----: | -----------: | ---------: |
| `legal_entities` | 1 | 1 | 0 | 0 |
| `profiles` | 4 | 1 | 3 | 0 |
| `companies` | 2 | 0 | 2 | 0 |
| `company_contacts` | 0 | 0 | 0 | 0 |
| `products` | 1 | 1 (cadastro local) | 0 | 1 (para transacional) |
| `product_auxiliaries` | 19 | 19 | 0 | 0 |

## 7. Validações

Resultado das validações do lote candidato:

- Duplicidades por chave candidata: 0
  - `profiles.email`
  - `companies.document`
  - `products.sku`
- Registros sem chave mínima: 0
- Órfãos dentro do lote cadastral: 0
- Inconsistência owner de company vs profile: 0
- Referências de auxiliares de produto faltantes: 0
- Inclusão de transacionais: 0
- Inclusão de filas: 0
- Chamadas ERP/sync real: 0

Riscos/warnings:

- `companies.cnpj` vazio em 2/2 (uso de `document` temporário).
- `profiles.employee_code` ausente em 3/4.
- `products.erp_code` ausente em 1/1 (bloqueio transacional, sem impedir cadastro local).
- Ausência de tabelas canônicas (`sales_reps`, `user_sales_reps`, `user_tenants`, `user_legal_entities`) no snapshot.
- Target ainda sem confirmação formal como destino definitivo.

## 8. Registros bloqueados ou excluídos

| Entidade | Registro | Motivo | Severidade |
| -------- | -------- | ------ | ---------- |
| `products` | `14ea53f6-c763-4c71-8306-4ea54a80b864` | Sem `erp_code` (permitido só para cadastro local) | ALTA |
| `company_contacts` | n/a | Sem registros válidos no snapshot | MÉDIA |
| Transacionais (`orders`, `deals`, `sales_proposals`) | todos | Excluídos por escopo da fase 22E | CRÍTICA |

## 9. Decisão

Classificação final da 22E:

- **GO (cadastral completo sem ressalva):** não
- **PARCIAL:** sim
- **NO-GO:** não para lote cadastral; sim para transacional/cutover

Interpretação:

- Há condições para avançar com **lote cadastral controlado** em fase futura.
- Permanecem bloqueios e riscos que impedem transacionais e cutover.

## 10. Próxima fase recomendada

- **Fase 22F — script/plano de carga cadastral em modo dry-run/preview, sem escrita**, condicionada a:
  - confirmação formal do target;
  - formalização da regra `document` como substituto temporário de `cnpj`;
  - manutenção de exclusão de transacionais e sync ERP.

Evidência externa da fase:

- `C:/Users/Felipe Duarte/backups/qualyvac-migration/preflight/phase-22e-cadastral-dataset-preview_20260626-204610.json`
