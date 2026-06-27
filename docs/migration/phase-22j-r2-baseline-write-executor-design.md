# Fase 22J-R2 — Concepcao Enxuta do Executor Write Seguro da Baseline 22*

## 1. Objetivo

Definir uma concepcao tecnica minima para um futuro executor de write da baseline 22*, sem implementar escrita nesta fase.

Objetivo central:

- manter simplicidade;
- evitar motor generico;
- bloquear write por padrao;
- preservar isolamento estrito do restore-test.

## 2. Escopo

- consolidar interface minima do futuro comando;
- definir guard rails obrigatorios de target, autorizacao, batch e input;
- definir whitelist/blacklist fixa de entidades;
- definir ordem futura de escrita;
- definir evidencias obrigatorias pre e pos-write;
- separar explicitamente trilha baseline 22* da trilha `pilot-seed`.

## 3. Nao objetivos

- nao implementar write funcional;
- nao criar framework de migracao generico;
- nao adicionar flags de bypass (`--force`, `--skip-guards`, etc.);
- nao executar SQL de escrita;
- nao executar seed, cleanup, rollback, migration, deploy ou integracoes externas.

## 4. Principio "nao criar um monstro"

O executor futuro deve ser:

- especifico para baseline 22*;
- pequeno e legivel;
- com validacoes explicitas;
- sem autodeteccao perigosa;
- sem permissao para tabela arbitraria;
- sem rotinas laterais (cleanup/rollback) no mesmo fluxo de write.

## 5. Interface minima proposta

Comando proposto (futuro, fase separada):

```bash
node scripts/migration/phase-22k-r2-baseline-write.mjs \
  --expected-target nsnmlleplpzsefzkuxlb \
  --batch baseline_22f_r2_restore_test_qualyvac \
  --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json \
  --write
```

Regras:

- flags minimas, sem bypass;
- sem `--tables` livre;
- sem `--cleanup`, `--rollback`, `--all`;
- sem qualquer atalho que ignore guard rails.

## 6. Guard rails obrigatorios

### 6.1 Target

Falhar se:

- `supabase/.temp/project-ref` ausente;
- project ref diferente de `nsnmlleplpzsefzkuxlb`;
- project name diferente de `crm-qualyvac-restore-test`;
- houver indicio de staging/prod/target invalidado;
- `--expected-target` ausente ou divergente.

### 6.2 Autorizacao humana

Falhar se `--authorization` ausente ou diferente exatamente de:

`AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

### 6.3 Batch

Falhar se:

- `--batch` ausente;
- batch diferente de `baseline_22f_r2_restore_test_qualyvac`;
- algum registro nao for rastreavel por batch/chave temporaria.

### 6.4 Input

Falhar se:

- `--input` ausente/invalido;
- input nao vier de dry-run 22G-R2 compativel;
- input apontar para outro target;
- input vier com decisao fora da politica aceita;
- input incluir entidades proibidas;
- input incluir SQL arbitrario ou chamada externa.

### 6.5 Write gate

Falhar se:

- `--write` ausente;
- qualquer validacao anterior falhar;
- houver tentativa de operar fora da whitelist.

## 7. Whitelist

Permitir somente:

- `legal_entities`
- `profiles` (somente com regra explicita segura)
- `sales_reps`
- `user_tenants`
- `user_legal_entities`
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

- `company_contacts` nao deve ser escrita; relacao por `contacts.company_id`.

## 8. Blacklist

Bloquear sempre:

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

## 9. Ordem futura de escrita

1. contexto/tenant existente;
2. `legal_entities`;
3. `profiles` (se permitido);
4. `user_tenants`;
5. `user_legal_entities`;
6. `sales_reps`;
7. `user_sales_reps`;
8. auxiliares de produto;
9. `products`;
10. `companies`;
11. `contacts`.

## 10. Evidencias obrigatorias

### 10.1 Pre-write

- evidência preflight;
- contagens antes;
- plano de escrita por entidade;
- target e batch confirmados;
- identificador/hash do input;
- decisao GO/PARCIAL/NO-GO de liberacao.

### 10.2 Pos-write (fase futura)

- contagens depois;
- delta por tabela;
- registros criados por batch/chave temporaria;
- validacao de vinculos;
- confirmacao de 0 transacionais;
- confirmacao de 0 filas;
- confirmacao de 0 ERP/API/n8n/webhooks;
- decisao final GO/PARCIAL/NO-GO.

## 11. Separacao entre baseline 22* e pilot-seed

- `scripts/pilot-seed/*` pertence a trilha de piloto tecnico (escopo diferente).
- `pilot-seed` pode conter entidades transacionais por objetivo proprio.
- baseline 22* nao deve reutilizar `pilot-seed` para escrita.
- executor baseline deve ficar em `scripts/migration/` e ser restrito ao escopo 22*.

## 12. Riscos evitados

- escrita acidental em staging/producao;
- escrita em target invalidado;
- inclusao de transacionais por engano;
- execucao sem autorizacao humana explicita;
- escrita sem rastreabilidade por batch;
- confusao de trilha entre baseline 22* e pilot-seed.

## 13. O que ainda nao sera implementado

- modo write funcional;
- SQL de escrita;
- rollback automatico;
- cleanup automatico;
- integracao ERP/API/n8n/webhooks;
- processamento de filas.

## 14. Recomendacao da proxima fase

Fase 22K-R2 (somente hardening sem write real):

- manter `phase-22k-r2-baseline-write.mjs` em modo abort;
- implementar apenas validacoes de argumentos/target/batch/input/autorizacao;
- gerar relatorio preflight;
- continuar sem qualquer comando de escrita.

## 15. Confirmacoes negativas

- SQL executado: nao
- escrita em banco: nao
- migration: nao
- seed/cleanup: nao
- rollback: nao
- ERP/API/webhook/n8n: nao
- filas processadas: nao
- deploy: nao
- push: nao
- staging/prod alterados: nao
- modo write funcional adicionado: nao
- executor write executado: nao
