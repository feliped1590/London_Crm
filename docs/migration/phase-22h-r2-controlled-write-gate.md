# Fase 22H-R2 — Gate de Escrita Controlada da Baseline no Restore-test

## 1. Resumo executivo

Esta fase e estritamente documental e nao executa nenhuma escrita em banco.

O dry-run tecnico da baseline, ajustado ao schema real na 22G-R2A, ja retornou GO.

Objetivo desta fase:

- formalizar o gate de seguranca para uma futura escrita controlada;
- definir escopo, ordem, validacoes e rollback;
- bloquear qualquer escrita sem autorizacao explicita em fase separada.

## 2. Target confirmado

- Target autorizado: `nsnmlleplpzsefzkuxlb` / `crm-qualyvac-restore-test`
- Target proibido sem autorizacao explicita: `cansbrrwrprcycjvgvqm` / `crm-qualyvac-staging`
- Target invalidado nesta trilha: `nazymjfzjadfgovcfivs` / `Qualyvac_Group_CRM`

## 3. Fonte dos dados

- `docs/migration/phase-22f-r2-baseline-exact-data-spec.md`
- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`
- Evidencia externa 22G-R2A: `C:/Users/Felipe Duarte/backups/qualyvac-migration/preflight/phase-22g-r2a-baseline-dry-run_20260626_220535.json`

## 4. Batch ID

`baseline_22f_r2_restore_test_qualyvac`

Todo registro futuro da baseline deve ser rastreavel por este batch quando o schema permitir (campo de referencia, metadado ou conjunto de chaves temporarias).

## 5. Escopo da futura escrita

Escopo permitido para futura escrita controlada (fase separada e autorizada):

- `legal_entities`
- `profiles` (se aplicavel e seguro)
- `sales_reps`
- `user_tenants`
- `user_legal_entities`
- `user_sales_reps`
- `companies`
- `contacts`
- auxiliares de produto: `product_types`, `product_groups`, `product_subgroups`, `product_families`, `product_classes`
- `products`

Regras adicionais:

- `company_contacts` nao sera escrito porque a tabela nao existe no schema atual.
- O vinculo contato-empresa sera por `contacts.company_id`, se permitido no estado do schema.

## 6. Entidades proibidas

- `deals`
- `deal_stage_history`
- `proposals`
- `sales_proposals`
- `proposal_items`
- `sales_proposal_items`
- `orders`
- `order_items`
- filas de sync
- audit logs
- sessoes
- anexos
- notificacoes automaticas
- ERP sync
- n8n
- webhooks

## 7. Registros previstos por entidade

| Entidade | Quantidade prevista | Origem | Chave temporaria | Permitido escrever futuramente? | Observacao |
| -------- | ------------------: | ------ | ---------------- | ------------------------------: | ---------- |
| `legal_entities` | 1 | 22F-R2 / 22G-R2A | `TMP-22F-R2-*` | Sim | baseline juridica minima |
| `profiles` | 3 | 22F-R2 / 22G-R2A | `TMP-22F-R2-*` | Sim (condicional) | depende de `user_id` Auth existente e autorizacao |
| `sales_reps` | 2 | 22F-R2 / 22G-R2A | `TMP-22F-R2-*` | Sim | vinculacao comercial minima |
| `user_tenants` | 3 | 22F-R2 / 22G-R2A | `TMP-22F-R2-*` | Sim | escopo de tenant por usuario |
| `user_legal_entities` | 3 | 22F-R2 / 22G-R2A | `TMP-22F-R2-*` | Sim | escopo juridico por usuario |
| `user_sales_reps` | 2 | 22F-R2 / 22G-R2A | `TMP-22F-R2-*` | Sim | vinculo usuario-vendedor |
| `companies` | 5 | 22F-R2 / 22G-R2A | `TMP-22F-R2-*` | Sim | clientes cadastrais |
| `contacts` | 5 | 22F-R2 / 22G-R2A | `TMP-22F-R2-*` | Sim | vinculo via `contacts.company_id` |
| `company_contacts` | 0 | 22G-R2A (schema real) | n/a | Nao | tabela ausente |
| `product_types` | 1 | 22F-R2 / 22G-R2A | `TMP-22F-R2-*` | Sim | auxiliar de produto |
| `product_groups` | 1 | 22F-R2 / 22G-R2A | `TMP-22F-R2-*` | Sim | auxiliar de produto |
| `product_subgroups` | 1 | 22F-R2 / 22G-R2A | `TMP-22F-R2-*` | Sim | auxiliar de produto |
| `product_families` | 1 | 22F-R2 / 22G-R2A | `TMP-22F-R2-*` | Sim | auxiliar de produto |
| `product_classes` | 1 | 22F-R2 / 22G-R2A | `TMP-22F-R2-*` | Sim | auxiliar de produto |
| `products` | 5 | 22F-R2 / 22G-R2A | `TMP-22F-R2-*` | Sim | catalogo minimo |

## 8. Ordem de escrita futura

Ordem obrigatoria para futura escrita controlada:

1. contexto/tenant existente ou resolucao de tenant;
2. `legal_entities`;
3. `profiles`, se permitido;
4. `user_tenants`;
5. `user_legal_entities`;
6. `sales_reps`;
7. `user_sales_reps`;
8. auxiliares de produto;
9. `products`;
10. `companies`;
11. `contacts`.

Observacao:

Se `profiles` depender de usuarios Auth ja existentes, nao criar Auth user nesta fase; somente vincular/atualizar `profiles` quando for seguro e explicitamente autorizado.

## 9. Campos reais mapeados

- `legal_entities`: label `name`, codigo `erp_company_code`, obrigatorios `tenant_id`, `name`
- `profiles`: label `full_name`, codigo `erp_user_code`, obrigatorios `user_id`, `full_name`
- `sales_reps`: label `name`, codigo `erp_vendor_code`, obrigatorios `name`, `tenant_id`
- `user_tenants`: obrigatorios `user_id`, `tenant_id`, `role`
- `user_legal_entities`: obrigatorios `user_id`, `tenant_id`, `legal_entity_id`, `role`
- `user_sales_reps`: obrigatorios `user_id`, `sales_rep_id`
- `companies`: label `name`, codigo `erp_code`, obrigatorios `name`, `tenant_id`
- `contacts`: label `first_name`, codigo `erp_contact_code`, obrigatorios `first_name`, `tenant_id`
- auxiliares de produto: label `label`, codigo `value`, obrigatorios `label`, `value`, `tenant_id`
- `products`: label `name`, codigo `erp_product_code`, obrigatorios `sku`, `name`, `tenant_id`

## 10. Pre-check obrigatorio antes de qualquer escrita futura

- branch `main`;
- branch alinhada com `origin/main`;
- working tree limpo;
- target local = `nsnmlleplpzsefzkuxlb`;
- nome do projeto = `crm-qualyvac-restore-test`;
- dry-run reexecutado imediatamente antes da escrita;
- decisao dry-run = GO;
- evidencia externa gerada;
- staging nao linkado;
- target invalidado rejeitado;
- backup/evidencia antes da escrita;
- rollback documentado;
- comando de escrita revisado;
- autorizacao humana explicita recebida.

## 11. Pos-check obrigatorio apos escrita futura

- contagens antes/depois por tabela;
- registros criados por batch/chave temporaria;
- 0 transacionais criados;
- 0 filas processadas;
- 0 chamadas ERP;
- vinculos resolvidos;
- dependencias validas;
- evidencia externa apos escrita;
- decisao final GO/PARCIAL/NO-GO.

## 12. Rollback planejado

- rollback por batch/chaves temporarias da baseline;
- nao remover registros fora do batch;
- rollback em fase separada;
- rollback exige dry-run previo;
- rollback proibido em staging/prod;
- rollback com evidencia antes/depois.

## 13. Autorizacao explicita exigida

Nenhuma escrita pode ocorrer sem mensagem textual do operador humano contendo exatamente:

`AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

Sem essa frase exata, qualquer fase de escrita deve abortar.

## 14. Comandos futuros permitidos e proibidos

Permitido futuramente apenas em fase separada:

- executar dry-run;
- executar write controlado somente com autorizacao explicita;
- gerar evidencia externa.

Proibido:

- `db push`;
- migration;
- seed generico;
- SQL manual fora do script controlado;
- escrita em staging;
- escrita em producao;
- ERP/API/n8n;
- processamento de filas;
- deploy.

## 15. Criterios GO/PARCIAL/NO-GO para liberar futura escrita

**GO**

- dry-run GO;
- target correto;
- rollback planejado;
- autorizacao explicita presente;
- comando limitado ao batch;
- entidades transacionais bloqueadas.

**PARCIAL**

- dry-run GO, com pendencias nao criticas (ex.: contatos opcionais);
- escrita pode ser adiada, reduzida ou segmentada.

**NO-GO**

- target incerto;
- staging/prod linkado;
- dry-run diferente de GO;
- ausencia de autorizacao explicita;
- rollback indefinido;
- tentativa de incluir transacionais;
- qualquer chamada ERP/API/n8n.

## 16. Proxima fase recomendada

Recomendacao preferencial:

- Fase 22I-R2 — revisao tecnica dos guard rails do script antes de adicionar modo write.

Alternativa posterior (somente apos revisao e autorizacao):

- Fase 22I-R2 — adaptar o script para suportar modo write controlado, mantendo execucao em dry-run ate aprovacao final.
