# Fase 22C — Especificação da Primeira Carga Real Pequena

## 1. Resumo executivo

Esta fase **não executa migração**.  
Ela define, de forma operacional, o primeiro lote real pequeno e controlado para execução futura em fase própria.

Direcionamento de decisão nesta fase:

- **GO/PARCIAL** para preparar a execução futura do lote piloto real.
- **NO-GO** para carga completa/cutover neste momento.

Base de referência:

- `docs/migration/phase-22b-migration-waves-plan.md`
- Auditoria 22A (consolidada em `canvases/auditoria-migracao-crm.canvas.tsx`)

## 2. Objetivo do lote piloto real

O primeiro lote real pequeno existe para validar, em ambiente autorizado:

- mapeamento de dados e consistência semântica;
- integridade relacional no recorte do lote;
- presença e governança de chaves ERP aplicáveis;
- isolamento correto por tenant/legal_entity;
- coerência dos relacionamentos comerciais;
- reconciliação origem x destino por entidade;
- executabilidade e segurança de rollback;
- ausência de processamento automático de filas.

## 3. Escopo recomendado do lote

Escopo inicial recomendado (teto de piloto):

- 1 tenant;
- 1 legal_entity;
- 2 a 5 usuários/perfis;
- 2 a 5 vendedores;
- 10 clientes;
- 10 contatos;
- 10 produtos;
- 3 deals;
- 2 propostas com itens;
- 2 pedidos com itens.

Observações:

- Os números acima são teto inicial, não meta obrigatória.
- Se chaves ERP não estiverem saneadas, reduzir para cadastros sem transacionais.

## 4. Entidades incluídas

Entidades permitidas no lote piloto real:

Raiz:

- `tenants` (se necessário ao contexto do target);
- `legal_entities`;
- `profiles`;
- `user_tenants`;
- `user_legal_entities`;
- `sales_reps`;
- `user_sales_reps`.

Clientes:

- `companies`;
- `company_contacts`/`contacts` (conforme modelo efetivo do banco);
- `portfolio_assignments` (somente se regra funcional já estiver formalizada).

Produtos:

- `product_types`;
- `product_groups`;
- `product_subgroups`;
- famílias/classes (quando aplicável no modelo);
- `products`.

Comercial:

- `deals`;
- `deal_stage_history` (se aplicável);
- `sales_proposals`/`proposals`;
- `proposal_items` (`sales_proposal_items` no modelo atual);
- `orders`;
- `order_items`.

## 5. Entidades excluídas da primeira carga

Exclusões explícitas do lote inicial:

- filas de sync (apenas observação read-only permitida);
- `audit_events`;
- `user_sessions`;
- `session_login_history`;
- notificações automáticas;
- integrações ERP reais;
- anexos grandes;
- histórico completo legado;
- qualquer tabela sem regra formal de rollback por lote.

## 6. Campos obrigatórios por entidade

| Entidade | Campo obrigatório | Motivo | Bloqueia carga? |
| -------- | ----------------- | ------ | --------------- |
| `legal_entities` | `tenant_id` | Isolamento multi-tenant | Sim |
| `legal_entities` | `name`/`legal_name` | Identificação jurídica mínima | Sim |
| `legal_entities` | `code`/ERP code (se aplicável) | Reconciliação e vínculo operacional | Sim |
| `legal_entities` | `cnpj` ou `document` (se aplicável) | Chave fiscal/negócio | Sim |
| `profiles`/users | `email` | Identidade única de usuário | Sim |
| `profiles`/users | vínculo de tenant | Segurança e escopo de acesso | Sim |
| `profiles`/users | perfil/permissão | Autorização funcional mínima | Sim |
| `profiles`/users | vínculo com `legal_entity` | Contexto operacional | Sim |
| `sales_reps` | `name` | Identidade comercial | Sim |
| `sales_reps` | ERP code (se exigido) | Reconciliação com ERP | Sim (quando exigido) |
| `sales_reps` | vínculo com usuário (se aplicável) | Rastreabilidade comercial | Sim |
| `companies` | `tenant_id` | Isolamento de dados | Sim |
| `companies` | `legal_entity_id` (se aplicável) | Segmentação operacional | Sim (quando aplicável) |
| `companies` | `name`/razão social | Identificação do cliente | Sim |
| `companies` | `document` ou `cnpj` | Chave de negócio | Sim |
| `companies` | `erp_code` (se integração exigir) | Reconciliação externa | Sim (quando exigido) |
| `companies` | `owner`/`sales_rep` (se obrigatório) | Governança comercial | Sim (quando obrigatório) |
| `contacts` | `company_id` | Integridade referencial | Sim |
| `contacts` | `name` | Identificação de contato | Sim |
| `contacts` | `email` ou telefone | Canal mínimo de contato | Sim |
| `products` | `tenant_id` | Isolamento de catálogo | Sim |
| `products` | `sku` | Chave comercial de produto | Sim |
| `products` | `name` | Identificação do item | Sim |
| `products` | `erp_code` antes de sync real | Chave de integração transacional | Sim para transacionais |
| `products` | grupo/subgrupo/família/classe (se obrigatório) | Classificação e regras fiscais/comerciais | Sim (quando obrigatório) |
| `products` | `ncm` (se obrigatório) | Regra fiscal mínima | Sim (quando obrigatório) |
| `deals` | `tenant_id` | Isolamento do pipeline | Sim |
| `deals` | `legal_entity_id` | Contexto comercial/legal | Sim |
| `deals` | `company_id` | Integridade cliente-negócio | Sim |
| `deals` | `owner`/`sales_rep` | Responsabilidade comercial | Sim |
| `deals` | `pipeline`/`stage` | Estado de funil válido | Sim |
| `deals` | `status` | Governança de ciclo | Sim |
| `proposals` | `tenant_id` | Isolamento de proposta | Sim |
| `proposals` | `legal_entity_id` | Contexto da operação | Sim |
| `proposals` | `company_id` | Referência de cliente | Sim |
| `proposals` | `deal_id` (se aplicável) | Rastreabilidade comercial | Sim (quando aplicável) |
| `proposals` | `proposal_number` | Chave operacional | Sim |
| `proposals` | `status` | Estado funcional permitido | Sim |
| `proposal_items` | itens válidos | Fechamento comercial/técnico | Sim |
| `orders` | `tenant_id` | Isolamento de pedido | Sim |
| `orders` | `legal_entity_id` | Contexto fiscal/comercial | Sim |
| `orders` | `company_id` | Referência do cliente | Sim |
| `orders` | `sales_rep_id` | Responsabilidade comercial | Sim |
| `orders` | `order_number` | Chave operacional | Sim |
| `orders` | `erp_code`/número ERP conforme regra | Reconciliação com sistema externo | Sim para transacionais |
| `order_items` | itens válidos | Integridade do pedido | Sim |

## 7. Chaves de reconciliação

Chaves recomendadas por entidade:

- `legal_entities`: `code` e/ou `cnpj` normalizado.
- `profiles`: `email`.
- `sales_reps`: `employee_code`/`erp_code`/`email` (conforme disponibilidade).
- `companies`: `document`/`cnpj` + `tenant`.
- `contacts`: `email + company_id` ou `phone + company_id`.
- `products`: `erp_code` ou `sku + tenant`.
- `deals`: `external_id` (quando existir) ou combinação controlada (`company_id + title + created_at`) com normalização.
- `proposals`: `proposal_number + legal_entity`.
- `orders`: `order_number` e/ou `erp_code + legal_entity`.

Pendências de definição formal:

- `deals.external_id` ainda depende de padronização definitiva no modelo.
- Regra de precedência entre `orders.order_number` e `orders.erp_code` precisa ser fechada antes de transacionais.

## 8. Pré-checks obrigatórios antes da carga

Checks read-only que devem ser executados na fase de execução futura:

- confirmar ambiente target autorizado;
- confirmar backup/snapshot disponível e recuperável;
- confirmar identificação do lote/namespace (`migration_batch_id`);
- confirmar freeze parcial (se aplicável à janela);
- confirmar 0 duplicidades nas chaves do lote;
- confirmar 0 órfãos no lote;
- confirmar ERP codes obrigatórios para entidades transacionais;
- confirmar filas automáticas pausadas ou sob controle manual;
- confirmar `PRODUCT_SYNC_EXECUTION_ENABLED` desativado;
- confirmar que ERP real não será chamado durante o lote.

## 9. Estratégia de carga futura

Ordem lógica para execução futura:

1. `legal_entities` / tenant / contexto;
2. usuários/perfis/vendedores;
3. clientes;
4. contatos;
5. auxiliares de produto;
6. produtos;
7. deals;
8. propostas;
9. pedidos;
10. históricos mínimos.

Reforços operacionais:

- Não executar carga nesta fase 22C.
- A execução deve ocorrer em fase própria.
- Toda carga deve ser idempotente.
- Usar lote identificável para rastreio, reconciliação e rollback.

## 10. Pós-checks obrigatórios

Validações mínimas após execução futura do lote:

- contagem esperada vs realizada por entidade;
- 0 órfãos;
- 0 duplicidades críticas;
- `tenant_id`/`legal_entity_id` corretos em 100% do lote;
- chaves ERP preservadas conforme regra;
- itens corretamente vinculados (`proposal_items`, `order_items`);
- filas não processadas automaticamente;
- nenhuma chamada ERP real registrada;
- smoke test visual no CRM (quando aplicável ao ambiente de teste).

## 11. Reconciliação

Formato mínimo obrigatório:

| Entidade | Esperado | Carregado | Divergência | Status |
| -------- | -------: | --------: | ----------: | ------ |
| `legal_entities` |  |  |  | `OK` / `DIVERGENTE` / `BLOQUEADO` / `NÃO APLICÁVEL` |
| `profiles` |  |  |  | `OK` / `DIVERGENTE` / `BLOQUEADO` / `NÃO APLICÁVEL` |
| `companies` |  |  |  | `OK` / `DIVERGENTE` / `BLOQUEADO` / `NÃO APLICÁVEL` |
| `products` |  |  |  | `OK` / `DIVERGENTE` / `BLOQUEADO` / `NÃO APLICÁVEL` |
| `deals` |  |  |  | `OK` / `DIVERGENTE` / `BLOQUEADO` / `NÃO APLICÁVEL` |
| `proposals` |  |  |  | `OK` / `DIVERGENTE` / `BLOQUEADO` / `NÃO APLICÁVEL` |
| `orders` |  |  |  | `OK` / `DIVERGENTE` / `BLOQUEADO` / `NÃO APLICÁVEL` |

## 12. Rollback

Estratégia de rollback por lote (execução futura):

- identificar registros pelo namespace/lote;
- excluir apenas os dados do lote;
- preservar dados preexistentes;
- validar contagens pós-rollback;
- gerar evidência completa de reversão.

Regras:

- rollback também deve ocorrer em fase própria;
- não fazer cleanup manual fora de script/procedimento controlado e versionado.

## 13. Critérios GO/PARCIAL/NO-GO para executar a primeira carga

### GO

- lote definido e aprovado;
- chaves obrigatórias preenchidas;
- target confirmado;
- rollback definido e validado;
- filas sob controle;
- ERP real desabilitado para a execução do lote.

### PARCIAL

- permitir apenas cadastros raiz/clientes/produtos sem transacionais;
- sem propostas/pedidos caso ainda faltem chaves ERP ou vínculos críticos.

### NO-GO

- ERP codes ausentes para entidades transacionais;
- deals sem `company_id`;
- duplicidades críticas no lote;
- órfãos no lote;
- target incerto;
- rollback inexistente;
- risco de sync real ativo.

## 14. Primeira carga recomendada

Com base na auditoria 22A:

### Opção A — Mais segura

- somente cadastros raiz + clientes + contatos + produtos sem sync real.

### Opção B — Controlada com transacionais mínimos

- incluir poucos deals/propostas/pedidos apenas se:
  - `company_id` resolvido em deals;
  - `products.erp_code` e `orders.erp_code` definidos ou dispensados formalmente;
  - vendedores corretamente vinculados a usuário/contexto.

Recomendação para o estado atual:

- **Recomendada agora: Opção A (mais segura)**.
- Opção B deve ser liberada apenas após saída objetiva das pendências de chave ERP e vínculo comercial.

## 15. Próxima fase recomendada

Próxima fase sugerida:

- **Fase 22D — saneamento/mapeamento das chaves ERP e vínculos mínimos antes da carga**, com critérios de saída objetivos.

Após conclusão dos bloqueadores:

- **Fase 22D (execução subsequente) — montagem do dataset/lote da primeira carga real pequena em modo dry-run/preview**.
