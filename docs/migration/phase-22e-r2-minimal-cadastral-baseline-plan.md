# Fase 22E-R2 — Plano de Baseline Cadastral Mínima no Restore-test

## 1. Resumo executivo

O restore-test correto está praticamente vazio e, neste estado, ainda não permite montar dataset preview útil para migração.

Esta fase:

- nao executa carga;
- nao executa script de escrita;
- apenas define a baseline cadastral minima necessaria para viabilizar um preview futuro seguro.

## 2. Target confirmado

- Target autorizado: `nsnmlleplpzsefzkuxlb` / `crm-qualyvac-restore-test`
- Staging: `cansbrrwrprcycjvgvqm` / `crm-qualyvac-staging` (proibido ate autorizacao explicita)
- Target invalidado: `nazymjfzjadfgovcfivs` / `Qualyvac_Group_CRM` (fora da trilha atual)

## 3. Estado atual herdado da 22D-R2

- `legal_entities`: 0
- `companies`: 0
- `products`: 0
- `profiles`: 1 com ressalvas (sem `active_tenant_id`, sem `active_legal_entity_id`, sem `erp_user_code`)
- `sales_reps`: 0
- `user_sales_reps`: 0
- `user_tenants`: 0
- `user_legal_entities`: 0
- transacionais: 0

## 4. Objetivo do baseline

A baseline minima deve permitir:

- validar estrutura multiempresa no restore-test;
- validar usuarios/perfis e vinculos minimos;
- validar clientes;
- validar produtos e auxiliares;
- habilitar novo preview cadastral futuro;
- manter transacionais fora do escopo;
- manter sync ERP desabilitado.

## 5. Entidades incluídas no baseline mínimo

### 5.1 Tenant/contexto

- `tenants` (se necessario ao modelo)
- `legal_entities` (ao menos 1 entidade principal)

### 5.2 Usuários e permissões

- `profiles` minimos
- `user_tenants` (se a tabela existir no fluxo ativo)
- `user_legal_entities` (se a tabela existir no fluxo ativo)
- perfil/permissao minima operacional

### 5.3 Vendedores

- `sales_reps` (se tabela existente no modelo atual)
- `user_sales_reps` (se tabela existente no modelo atual)

### 5.4 Clientes

- `companies`
- `contacts`/`company_contacts` (o que estiver vigente no schema)
- owner/sales_rep quando obrigatorio pela regra do dominio

### 5.5 Produtos e auxiliares

- `product_types`
- `product_groups`
- `product_subgroups`
- `product_families`
- `product_classes`
- `products`

## 6. Entidades excluídas do baseline

- `deals`
- `deal_stage_history`
- `proposals`/`sales_proposals`
- `proposal_items`/`sales_proposal_items`
- `orders`
- `order_items`
- filas de sync (`product_sync_queue`, `order_sync_queue`, equivalentes)
- `audit_events`
- `user_sessions`
- `session_login_history`
- notificacoes automaticas
- anexos grandes
- integracoes ERP reais
- qualquer historico/transacional

## 7. Volume mínimo recomendado

Baseline tecnico minimo recomendado:

- 1 tenant/contexto (se necessario no modelo)
- 1 legal_entity
- 2 a 3 profiles
- 1 a 2 sales_reps
- 5 companies
- 0 a 5 contacts (quando houver)
- 5 products
- auxiliares de produto necessarios para classificar os 5 produtos

Observacoes:

- volumes sao minimos para validacao tecnica;
- nao representam carga real definitiva;
- se o schema exigir dependencias adicionais, registrar antes da fase de execucao.

## 8. Campos mínimos obrigatórios

| Entidade | Campo | Obrigatório? | Motivo | Bloqueia baseline? |
| -------- | ----- | -----------: | ------ | -----------------: |
| `legal_entities` | `tenant_id` (se aplicavel) | Sim | Escopo multi-tenant | Sim |
| `legal_entities` | `name` | Sim | Identificacao juridica | Sim |
| `legal_entities` | `code` | Sim | Chave operacional | Sim |
| `legal_entities` | `cnpj`/`document` (se aplicavel) | Sim | Chave fiscal | Sim |
| `profiles` | `email` | Sim | Identidade unica | Sim |
| `profiles` | `name` | Sim | Operacao e auditoria | Sim |
| `profiles` | tenant/legal_entity ativo (se exigido) | Sim | Escopo correto | Sim |
| `profiles` | `erp_user_code`/`employee_code` (quando exigido) | Condicional | Integracao futura | Nao para baseline tecnico |
| `sales_reps` | `name` | Sim | Identidade comercial | Sim |
| `sales_reps` | `erp_code`/`employee_code` (se houver) | Condicional | Integracao futura | Nao para baseline tecnico |
| `sales_reps` | `user_id` vinculado (se modelo exigir) | Sim | Responsabilidade comercial | Sim |
| `companies` | `name` | Sim | Identificacao do cliente | Sim |
| `companies` | `document` ou `cnpj` | Sim | Chave de negocio | Sim |
| `companies` | `tenant_id` | Sim | Isolamento de dados | Sim |
| `companies` | `legal_entity_id` (se aplicavel) | Sim | Escopo juridico | Sim |
| `companies` | `owner_id`/`sales_rep_id` (quando obrigatorio) | Condicional | Governanca comercial | Sim quando obrigatorio |
| `products` | `sku` | Sim | Chave minima de produto | Sim |
| `products` | `name` | Sim | Identificacao do item | Sim |
| `products` | `tenant_id` | Sim | Escopo de catalogo | Sim |
| `products` | classificacao minima (tipo/grupo/subgrupo/familia/classe) | Sim | Consistencia funcional | Sim |
| `products` | `erp_code` | Condicional | Necessario para transacional/sync | Nao para baseline cadastral |
| auxiliares | `name` | Sim | Catalogo valido | Sim |
| auxiliares | `tenant_id` (se aplicavel) | Sim | Escopo de catalogo | Sim |
| auxiliares | codigo (se houver) | Condicional | Chave de referencia | Nao |

## 9. Regras de negócio temporárias

- `companies.document` pode ser chave temporaria se `cnpj` estiver vazio, desde que unico no escopo.
- Produto sem `erp_code` pode entrar apenas como cadastro local.
- Produto sem `erp_code` nao pode ir para pedido/proposta.
- Nenhuma fila deve ser processada.
- Nenhum sync ERP deve ser disparado.
- Transacionais seguem proibidos.

## 10. Ordem futura de população

1. tenant/contexto (se necessario);
2. legal_entity;
3. profiles;
4. vinculos usuario -> tenant/legal_entity;
5. sales_reps;
6. vinculos usuario -> vendedor;
7. auxiliares de produto;
8. products;
9. companies;
10. contacts/company_contacts.

## 11. Pré-checks antes da futura população

- target correto confirmado (`nsnmlleplpzsefzkuxlb`);
- staging nao linkado;
- evidencia/backup de estado anterior registrada;
- sync ERP desabilitado;
- `product_sync_queue` e `order_sync_queue` vazias/controladas;
- rollback planejado e documentado;
- lote identificado (`baseline_batch_id`);
- dados minimos revisados por entidade.

## 12. Pós-checks após futura população

- contagens esperadas vs realizadas por entidade;
- 0 orfaos;
- 0 duplicidades criticas;
- tenant/legal_entity coerentes;
- nenhum transacional criado;
- nenhuma fila processada;
- nenhuma chamada ERP.

## 13. Rollback futuro

- baseline deve ser removivel por lote/namespace (`baseline_batch_id`);
- nao remover dados fora do lote;
- rollback deve ocorrer em fase propria controlada;
- evidencia antes/depois obrigatoria.

## 14. Critérios GO/PARCIAL/NO-GO

**GO**

- baseline minima bem definida;
- campos obrigatorios por entidade claros;
- rollback planejado;
- sync ERP bloqueado;
- target correto confirmado.

**PARCIAL**

- baseline viavel, mas depende de confirmar detalhes de vinculo (`user_tenants`, `user_legal_entities`, `user_sales_reps`) e regra temporaria `document`/`cnpj`.

**NO-GO**

- target incerto;
- risco de uso de staging/producao;
- sync ERP ativo;
- rollback indefinido;
- tentativa de incluir transacionais.

## 15. Próxima fase recomendada

- **Fase 22F-R2 — especificacao dos dados exatos da baseline minima (sem escrita)** e checklist de execucao.
- Em seguida, **Fase 22F-R2 (dry-run tecnico)** para validar o plano sem gravar no banco.
