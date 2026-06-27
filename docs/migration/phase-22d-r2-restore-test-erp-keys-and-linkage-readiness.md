# Fase 22D-R2 — Readiness de Chaves ERP e Vínculos no Restore-test Correto

## 1. Resumo executivo

Esta fase reexecuta o saneamento/mapeamento em modo estritamente read-only no target correto da trilha.

- Target correto confirmado: `nsnmlleplpzsefzkuxlb` / `crm-qualyvac-restore-test`
- Staging (`cansbrrwrprcycjvgvqm`) não está linkado localmente.
- Projeto inválido (`nazymjfzjadfgovcfivs`) foi explicitamente rejeitado nesta execução.
- Resultado geral: ambiente restore-test está com base cadastral quase vazia; não há massa mínima para montar lote de carga.

## 2. Target confirmado

- Projeto linkado local: `nsnmlleplpzsefzkuxlb`
- Nome: `crm-qualyvac-restore-test`
- Região: `us-east-2`
- `crm-qualyvac-staging` (`cansbrrwrprcycjvgvqm`): `linked=false`
- `Qualyvac_Group_CRM` (`nazymjfzjadfgovcfivs`): **não utilizado**

## 3. Inventário de tabelas core

| Tabela | Existe | Linhas | Papel | Observação |
| --- | --- | ---: | --- | --- |
| `tenants` | sim | 1 | cadastral-root | base mínima existente |
| `legal_entities` | sim | 0 | cadastral-root | bloqueio para carga cadastral |
| `profiles` | sim | 1 | user-access | 1 perfil sem vínculo de escopo |
| `user_roles` | sim | 1 | user-access | catálogo mínimo |
| `user_tenants` | sim | 0 | user-access | sem vínculos |
| `user_legal_entities` | sim | 0 | user-access | sem vínculos |
| `sales_reps` | sim | 0 | user-access | sem vendedores |
| `user_sales_reps` | sim | 0 | user-access | sem vínculo usuário-vendedor |
| `companies` | sim | 0 | cadastral-customer | sem clientes |
| `contacts` | sim | 0 | cadastral-contact | sem contatos |
| `company_contacts` | não | n/a | cadastral-contact | tabela não existe neste schema |
| `product_types` | sim | 12 | cadastral-product-aux | catálogo auxiliar presente |
| `product_groups` | sim | 21 | cadastral-product-aux | catálogo auxiliar presente |
| `product_subgroups` | sim | 53 | cadastral-product-aux | catálogo auxiliar presente |
| `product_families` | sim | 6 | cadastral-product-aux | catálogo auxiliar presente |
| `product_classes` | sim | 10 | cadastral-product-aux | catálogo auxiliar presente |
| `products` | sim | 0 | cadastral-product | sem produtos |
| `deals` | sim | 0 | transacional | fora de escopo da carga cadastral |
| `deal_stage_history` | sim | 0 | transacional | fora de escopo |
| `proposals` | sim | 0 | transacional | fora de escopo |
| `proposal_items` | sim | 0 | transacional | fora de escopo |
| `orders` | sim | 0 | transacional | fora de escopo |
| `order_items` | sim | 0 | transacional | fora de escopo |
| `product_sync_queue` | sim | 0 | fila sync | sem pendências |
| `order_sync_queue` | sim | 0 | fila sync | sem pendências |
| `erp_sync_jobs` | não | n/a | fila sync | não existe neste schema |

## 4. Companies / Clientes

Leitura read-only:

- total de companies: 0
- com CNPJ: 0
- com ERP code: 0
- duplicidade CNPJ: 0
- sem owner/sales_rep: 0 (não há registros)

Classificação:

- APTO: 0
- APTO COM RESSALVA: 0
- BLOQUEADO: 0

Bloqueador principal:

- ausência total de registros em `companies`.

## 5. Products / Produtos

Leitura read-only:

- total de products: 0
- com SKU: 0
- com ERP code (`erp_product_code`): 0
- sem ERP code: 0 (não há registros)
- classificação incompleta: 0 (não há registros)
- duplicidade SKU/ERP code: 0

Classificação:

- APTO PARA CADASTRO: 0
- APTO PARA TRANSACIONAL: 0
- BLOQUEADO PARA TRANSACIONAL: 0
- BLOQUEADO TOTAL: 0

Bloqueador principal:

- ausência total de registros em `products`.

## 6. Users / Profiles / Sales reps

Leitura read-only:

- profiles totais: 1
- profiles com e-mail: 1
- profiles com `erp_user_code`: 0
- profiles com `active_tenant_id`: 0
- profiles com `active_legal_entity_id`: 0
- sales_reps: 0
- user_sales_reps: 0
- user_tenants: 0
- user_legal_entities: 0

Classificação:

- APTO: 0
- APTO COM RESSALVA: 1
- BLOQUEADO: 0

Ressalva principal:

- perfil existente sem vínculo ativo de tenant/legal entity e sem código ERP de usuário.

## 7. Deals / Pipeline

Leitura read-only:

- total de deals: 0
- com `company_id`: 0
- sem `company_id`: 0
- sem owner: 0
- com dados de pipeline/stage: 0
- histórico (`deal_stage_history`): 0

Classificação:

- APTO: 0
- APTO COM MAPEAMENTO: 0
- BLOQUEADO POR COMPANY: 0
- BLOQUEADO POR RESPONSÁVEL: 0

Observação:

- sem massa transacional no restore-test no momento.

## 8. Propostas e Pedidos

Leitura read-only:

- proposals: 0
- proposal_items: 0
- orders: 0
- order_items: 0
- pedidos com ERP code: 0
- pedidos com itens válidos: 0

Classificação:

- APTO PARA HISTÓRICO CRM: 0
- APTO PARA RECONCILIAÇÃO ERP: 0
- BLOQUEADO PARA TRANSACIONAL: 0
- BLOQUEADO TOTAL: 0

## 9. Filas e integrações

Leitura read-only:

- `product_sync_queue`: total 0 (pending/processing/failed = 0)
- `order_sync_queue`: total 0 (pending/processing/failed = 0)
- `erp_sync_jobs`: tabela não existe neste schema

Interpretação:

- Não há fila em processamento nem backlog registrado no restore-test.

## 10. Matriz de saneamento

| Entidade | Registro/Grupo | Problema | Chave atual | Chave necessária | Regra proposta | Severidade | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `legal_entities` | tabela inteira | sem registros | n/a | code/cnpj/tenant | popular entidade jurídica mínima antes de lote | CRÍTICA | BLOQUEADO |
| `companies` | tabela inteira | sem registros | n/a | cnpj/document + owner/sales_rep | carregar clientes base antes de qualquer preview | CRÍTICA | BLOQUEADO |
| `products` | tabela inteira | sem registros | n/a | sku + erp_product_code (transacional) | iniciar por cadastro local e manter sem sync | CRÍTICA | BLOQUEADO |
| `profiles` | 1 perfil | sem vínculo ativo de escopo e sem erp_user_code | email | vínculo tenant/legal_entity + code ERP usuário | completar vínculos de acesso e mapeamento mínimo | ALTA | PENDENTE MAPEAMENTO |
| `sales_reps`/vínculos | tabela inteira | sem vendedores e sem relacionamentos | n/a | vendedor + vínculo usuário | preparar cadastro comercial mínimo | ALTA | BLOQUEADO |
| transacionais | conjunto | sem massa transacional | n/a | chaves operacionais/ERP | manter fora do escopo até etapa apropriada | MÉDIA | APTO (EXCLUÍDO) |

## 11. Readiness da primeira carga

Opções avaliadas:

- **Opção A — Cadastro apenas**: tecnicamente é a opção correta de escopo, mas neste momento não há dados cadastrais suficientes no restore-test para montar lote útil.
- **Opção B — Cadastro + transacionais mínimos**: não aplicável (sem massa transacional e fora de escopo atual).

## 12. Decisão final

- **GO para montar dataset preview útil agora**: **NÃO**
- **PARCIAL**: **NÃO** (falta massa mínima)
- **NO-GO**: **SIM**, até preparação/população mínima do restore-test correto

Conclusão:

- a reexecução no target correto foi concluída com sucesso;
- decisão de carga permanece bloqueada por ausência de dados no restore-test.

## 13. Próxima fase recomendada

- **22E-R2 (ou equivalente de preparação de base)**: preparar/popular massa cadastral mínima no `crm-qualyvac-restore-test` de forma controlada.
- Após isso, reexecutar preview cadastral read-only no mesmo target e só então decidir sobre lote de carga cadastral.
