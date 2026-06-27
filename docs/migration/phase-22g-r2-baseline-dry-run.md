# Fase 22G-R2 — Script de Baseline Cadastral Minima em Dry-run

## 1. Resumo executivo

Foi criado um script tecnico local de dry-run para simular a baseline cadastral minima sem qualquer escrita em banco.

Resultado da execucao autorizada nesta fase:

- execucao realizada somente com `--dry-run`;
- target correto confirmado antes das consultas;
- validacoes de schema e dependencias executadas em modo read-only;
- decisao final do dry-run: **PARCIAL**.

## 2. Target confirmado

- Target autorizado: `nsnmlleplpzsefzkuxlb` / `crm-qualyvac-restore-test`.
- Targets proibidos: `cansbrrwrprcycjvgvqm` / `crm-qualyvac-staging`, `nazymjfzjadfgovcfivs` / `Qualyvac_Group_CRM`, producao e qualquer outro project ref.
- Guard rail aplicado: leitura de `supabase/.temp/project-ref` antes de qualquer consulta.

## 3. Escopo do script

Arquivo criado:

- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`

Escopo funcional:

- exige `--dry-run` e `--expected-target`;
- aborta se o target esperado nao for `nsnmlleplpzsefzkuxlb`;
- aborta se o target linkado local divergir;
- executa apenas consultas `SELECT`/`WITH` read-only via `npx supabase db query --linked`;
- bloqueia SQL potencialmente destrutivo;
- gera relatorio terminal e evidencia JSON externa.

## 4. Entidades simuladas

Batch simulado:

- `baseline_22f_r2_restore_test_qualyvac`

Entidades cadastrais incluidas:

- `legal_entities` (1)
- `profiles` (3)
- `sales_reps` (2)
- `user_tenants` (3)
- `user_legal_entities` (3)
- `user_sales_reps` (2)
- `companies` (5)
- `contacts` (5)
- `company_contacts` (1)
- `product_types` (1)
- `product_groups` (1)
- `product_subgroups` (1)
- `product_families` (1)
- `product_classes` (1)
- `products` (5)

Todas as chaves temporarias seguem o prefixo `TMP-22F-R2-*`.

## 5. Entidades bloqueadas

Bloqueadas no script/lote:

- `deals`
- `deal_stage_history`
- `proposals`
- `sales_proposals`
- `proposal_items`
- `sales_proposal_items`
- `orders`
- `order_items`
- filas de sync (`product_sync_queue`, `order_sync_queue`)
- `audit_events`
- sessoes e historicos de sessao

## 6. Guard rails de seguranca

- Script so executa com `--dry-run`.
- Script exige `--expected-target`.
- Script valida target local antes de consultar DB.
- SQL nao-read-only e bloqueado por validacao de comando.
- Nenhum comando de escrita e permitido.
- Nenhuma chamada ERP/API/webhook/n8n e executada.
- Nenhum processamento de fila e executado.
- Nenhum deploy e executado.
- Nenhuma alteracao em staging/prod e permitida.

## 7. Validacoes executadas

- Validacao de target autorizado e proibidos.
- Validacao de existencia de tabelas da baseline.
- Validacao de colunas minimas por tabela.
- Contagem atual por tabela (`count(*)` read-only).
- Verificacao de presenca previa de prefixo `TMP-22F-R2-*` (somente leitura).
- Validacao da ordem logica de dependencias:
  1. tenant/contexto;
  2. legal entity;
  3. profiles;
  4. vinculos profile-tenant/legal entity;
  5. sales reps;
  6. vinculos profile-sales rep;
  7. auxiliares de produto;
  8. products;
  9. companies;
  10. contacts/company_contacts.

## 8. Evidencia externa

Arquivo gerado:

- `C:/Users/Felipe Duarte/backups/qualyvac-migration/preflight/phase-22g-r2-baseline-dry-run_20260626_215833.json`

Conteudo inclui:

- timestamp, branch e status git;
- target esperado e target linkado;
- batch_id e `dry_run=true`;
- entidades da baseline e contagem simulada;
- validacoes de schema e contagens atuais;
- validacao de dependencias;
- entidades bloqueadas;
- decisao e motivos;
- confirmacoes de no-write/no-migration/no-seed/no-integrations.

## 9. Como executar

Comando obrigatorio:

```bash
node scripts/migration/phase-22g-r2-baseline-dry-run.mjs --dry-run --expected-target nsnmlleplpzsefzkuxlb
```

Opcional para caminho customizado de evidencia:

```bash
node scripts/migration/phase-22g-r2-baseline-dry-run.mjs --dry-run --expected-target nsnmlleplpzsefzkuxlb --out "C:/Users/Felipe Duarte/backups/qualyvac-migration/preflight/phase-22g-r2-custom.json"
```

## 10. Criterios GO/PARCIAL/NO-GO

- **GO**: target correto, schema minimo atendido, sem lacunas criticas.
- **PARCIAL**: target correto, mas com lacunas de schema/colunas que exigem ajuste antes de escrita.
- **NO-GO**: target incorreto, deteccao de entidade transacional no lote, tentativa de escrita ou bloqueio critico.

## 11. Resultado da execucao dry-run

Primeira execucao (22G-R2 original):

- **Decisao: PARCIAL**
- motivo principal: mapeamento inicial usava colunas genericas que nao refletiam o schema real.

Reexecucao apos ajuste 22G-R2A:

- **Decisao: GO**
- motivo: colunas obrigatorias mapeadas para o schema real, validacoes read-only aprovadas e dependencia de contato resolvida por `contacts.company_id` quando `company_contacts` nao existe.

## Ajuste 22G-R2A — Mapeamento ao schema real

Divergencias detectadas no primeiro dry-run:

- `profiles` usa `full_name` (nao `name`);
- `contacts` usa `first_name`/`last_name` (nao `name`);
- auxiliares de produto usam `label`/`value` (nao `name`);
- `legal_entities` possui `erp_company_code` (nao `code`);
- `company_contacts` inexistente no schema atual.

Colunas reais mapeadas por tabela (resumo):

- `legal_entities`: label=`name`, code=`erp_company_code`, required=`tenant_id,name`
- `profiles`: label=`full_name`, code=`erp_user_code`, required=`user_id,full_name`
- `sales_reps`: label=`name`, code=`erp_vendor_code`, required=`name,tenant_id`
- `user_tenants`: required=`user_id,tenant_id,role`
- `user_legal_entities`: required=`user_id,tenant_id,legal_entity_id,role`
- `user_sales_reps`: required=`user_id,sales_rep_id`
- `companies`: label=`name`, code=`erp_code`, required=`name,tenant_id`
- `contacts`: label=`first_name`, code=`erp_contact_code`, required=`first_name,tenant_id`
- `product_types/groups/subgroups/families/classes`: label=`label`, code=`value`, required=`label,value,tenant_id`
- `products`: label=`name`, code=`erp_product_code`, required=`sku,name,tenant_id`

Tratamento de `company_contacts`:

- tabela marcada como opcional no mapeamento;
- quando ausente, relacao contato-empresa e validada via `contacts.company_id`;
- ausencia de `company_contacts` gera apenas warning, sem bloquear baseline cadastral principal.

Nova evidencia externa (22G-R2A):

- `C:/Users/Felipe Duarte/backups/qualyvac-migration/preflight/phase-22g-r2a-baseline-dry-run_20260626_220535.json`

## 12. Proxima fase recomendada

- Commitar os ajustes da 22G-R2A (script + documento).
- Fazer push pequeno em fase separada.
- Avancar para fase seguinte somente mantendo guard rails de read-only ate autorizacao explicita para qualquer escrita controlada.
