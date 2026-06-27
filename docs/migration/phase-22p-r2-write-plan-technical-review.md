# Fase 22P-R2 — Revisao tecnica do write plan e contrato minimo de execucao (sem escrita real)

## 1. Objetivo

Revisar tecnicamente o write plan gerado na 22O-R2 e consolidar o contrato minimo para futura execucao controlada, mantendo esta fase sem escrita real.

## 2. Escopo

- validar tecnicamente as evidencias de preflight e write plan;
- confirmar aderencia a whitelist, blacklist e reference-only;
- formalizar politica objetiva para `profiles` como entidade condicional;
- definir contrato minimo para futura execucao controlada;
- definir formato minimo de evidencias before/after.

## 3. Restricoes absolutas

Mantidas nesta fase:

- sem SQL de escrita;
- sem insert/update/upsert/delete;
- sem escrita em banco;
- sem RPC de escrita;
- sem seed/cleanup/rollback;
- sem migration/deploy/push;
- sem alteracao de staging/producao;
- sem ERP/API/webhook/n8n;
- sem processamento de filas;
- sem bypass (`--force`, `--skip-guards`, `--tables`, `--all`);
- sem adicionar `company_contacts` na whitelist de escrita.

## 4. Evidencias revisadas

- `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`
- `artifacts/migration/phase-22k-r2-baseline-write/preflight-20260626-223144.json`
- `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260626-223144.json`
- `docs/migration/phase-22h-r2-controlled-write-gate.md`
- `docs/migration/phase-22i-r2-guard-rails-review.md`
- `docs/migration/phase-22j-r2-baseline-write-executor-design.md`
- `docs/migration/phase-22k-r2-baseline-write-preflight.md`
- `docs/migration/phase-22l-r2-real-input-preflight.md`
- `docs/migration/phase-22m-r2-company-contacts-reference-only.md`
- `docs/migration/phase-22n-r2-write-release-checklist.md`
- `docs/migration/phase-22o-r2-write-plan-locked.md`
- `scripts/migration/phase-22k-r2-baseline-write.mjs`

## 5. Resultado da revisao do write plan

Revisao consolidada:

- target correto: `nsnmlleplpzsefzkuxlb`;
- project name correto: `crm-qualyvac-restore-test`;
- batch correto: `baseline_22f_r2_restore_test_qualyvac`;
- input correto: `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`;
- preflight: `PARCIAL`;
- politica de aceitacao 22N-R2: `partialAcceptedByPolicy22NR2=true`;
- write plan: `GO`;
- bloqueio de execucao real: ativo.

Verificacoes de seguranca:

- `company_contacts` fora do plano de escrita;
- `company_contacts` apenas em `referenceOnlyEntities`/`ignoredEntities`;
- sem entidades proibidas encontradas (`blockedEntitiesFound: []`);
- sem transacionais;
- sem filas;
- sem sinais de ERP/API/n8n/webhooks;
- sem SQL arbitrario de escrita;
- sem flags proibidas/unknown no preflight revisado.

## 6. Entidades aprovadas para futura escrita

- `legal_entities`
- `user_tenants`
- `user_legal_entities`
- `sales_reps`
- `user_sales_reps`
- `product_types`
- `product_groups`
- `product_subgroups`
- `product_families`
- `product_classes`
- `products`
- `companies`
- `contacts`

Observacao:

- `profiles` permanece condicional (ver secao 10), portanto nao entra no primeiro corte minimo automatico de execucao.

## 7. Entidades condicionais

- `profiles` (condicional por risco de vinculacao indevida).

## 8. Entidades ignoradas/reference-only

- `company_contacts`
  - fora da whitelist;
  - nao gravavel;
  - nao incluida no plano;
  - estrategia de vinculo mantida em `contacts.company_id`.

## 9. Entidades proibidas

Proibidas e ausentes no plano:

- transacionais (`deals`, `deal_stage_history`, `proposals`, `sales_proposals`, `proposal_items`, `sales_proposal_items`, `orders`, `order_items`);
- filas (`sync_queues`, `erp_sync` e correlatas);
- `audit_logs`, `sessions`, anexos, notificacoes;
- `webhooks`, `n8n` e chamadas externas.

## 10. Politica para `profiles`

`profiles` so podera ser escrita quando **todas** as condicoes forem verdadeiras:

- identificacao segura de `user_id` alvo;
- vinculo claro com `tenant` e `legal_entity`;
- ausencia de risco de sobrescrita indevida de perfil existente;
- operacao idempotente comprovavel;
- operacao limitada ao batch autorizado;
- sem alteracao de auth/senha/sessao;
- sem impacto em staging/producao.

Regra operacional para proxima fase:

- `profiles` fica como **elegivel condicional**;
- nao executar `profiles` na primeira rodada minima de write real;
- avaliar `profiles` em subfase separada ou modo explicitamente armado com validacoes adicionais.

## 11. Contrato minimo de execucao futura

A futura execucao minima devera obedecer ao contrato:

- target fixo `nsnmlleplpzsefzkuxlb`;
- project name fixo `crm-qualyvac-restore-test`;
- batch fixo `baseline_22f_r2_restore_test_qualyvac`;
- frase exata de autorizacao humana obrigatoria;
- uso de `latest.json` validado;
- uso exclusivo do write plan validado;
- execucao apenas de entidades whitelist aprovadas;
- respeito estrito da ordem fixa;
- ignorar `company_contacts`;
- bloquear transacionais;
- bloquear filas;
- bloquear chamadas externas;
- gerar evidencia before;
- executar escrita minima controlada (fase futura);
- gerar evidencia after;
- gerar delta por tabela;
- confirmar 0 transacionais;
- confirmar 0 filas;
- confirmar 0 ERP/API/n8n/webhooks;
- sem rollback automatico;
- em falha: parar e registrar evidencia;
- rollback apenas em fase separada e por batch.

## 12. Evidencia before/after exigida

### Before (minimo)

- timestamp;
- target;
- project name;
- batch;
- input;
- write plan;
- entidades planejadas;
- contagens antes por entidade;
- hash/identificador do input e do plano;
- confirmacao dos guards;
- decisao final pre-write.

### After (minimo)

- timestamp;
- target;
- project name;
- batch;
- entidades executadas;
- contagens depois por entidade;
- delta por entidade;
- registros criados/afetados por batch/chaves temporarias;
- entidades puladas;
- erros (se houver);
- confirmacao de 0 transacionais;
- confirmacao de 0 filas;
- confirmacao de 0 ERP/API/n8n/webhooks;
- decisao final pos-write.

## 13. Criterios para proxima fase (22Q-R2)

A 22Q-R2 so pode avancar se:

- write plan 22O validado;
- contrato minimo 22P documentado;
- politica de `profiles` definida;
- `company_contacts` mantida como reference-only;
- rollback por batch desenhado;
- before/after definidos;
- sem lacuna critica no plano.

## 14. Riscos restantes

- risco residual de escrita indevida em `profiles` sem gates extras (mitigado pela condicionalidade formal);
- risco operacional de confusao com trilhas legadas (`pilot-seed`);
- risco de divergencia semantica de input/plano em futuras iteracoes (mitigado por hash e validacoes before).

## 15. Decisao final GO/PARCIAL/NO-GO

**GO**

Justificativa:

- write plan tecnicamente valido;
- `company_contacts` fora do plano;
- sem transacionais, filas ou integracoes externas;
- contrato minimo definido;
- before/after definidos;
- politica de `profiles` documentada;
- nenhuma escrita ocorreu.

## 16. Recomendacao da proxima fase

Fase 22Q-R2 (ainda sem escrita real efetiva):

- implementar modo de execucao minima com hard stop final/armado;
- iniciar com subconjunto aprovado sem `profiles`;
- manter `profiles` para subfase controlada, caso os pre-requisitos fiquem completos;
- preservar bloqueios de bypass e evidencias before/after obrigatorias.

## 17. Confirmacoes negativas obrigatorias

- SQL de escrita executado: nao
- escrita em banco: nao
- migration: nao
- seed/cleanup: nao
- rollback: nao
- ERP/API/webhook/n8n: nao
- filas processadas: nao
- deploy: nao
- push: nao
- staging/prod alterados: nao
- modo write funcional executavel adicionado: nao
- insert/update/upsert/delete executado: nao
- executor executou escrita: nao
