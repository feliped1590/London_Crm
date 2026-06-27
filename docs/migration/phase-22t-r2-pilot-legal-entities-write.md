# Fase 22T-R2 — Primeira escrita real piloto somente em `legal_entities`

## 1. Objetivo

Executar a primeira escrita real controlada da baseline 22*, limitada estritamente a `legal_entities` no restore-test autorizado.

## 2. Escopo

- manter guard rails das fases 22H-22S;
- validar dupla autorizacao;
- gerar evidencia before;
- executar apenas 1 operacao idempotente em `legal_entities`;
- gerar evidencia after com delta e rastreabilidade;
- bloquear execucao ampliada para qualquer outra entidade.

## 3. Restricoes absolutas

- sem escrita fora de `legal_entities`;
- sem `profiles`;
- sem `company_contacts`;
- sem transacionais;
- sem filas;
- sem ERP/API/webhook/n8n;
- sem rollback automatico;
- sem cleanup automatico;
- sem migration/deploy/push;
- sem bypass (`--force`, `--skip-guards`, `--tables`, `--all`).

## 4. Alteracoes feitas no executor

Arquivo alterado:

- `scripts/migration/phase-22k-r2-baseline-write.mjs`

Alteracoes principais da 22T-R2:

- adicao de camada de execucao SQL controlada via `npx supabase db query --linked -o json`;
- validacao de chave natural segura para idempotencia (`UNIQUE (tenant_id, cnpj)`);
- validacao de existencia de `tenant_id` antes da escrita;
- gate `beforeDecision=GO` como pre-condicao obrigatoria para escrita;
- escrita real limitada a uma unica operacao `upsert` em `legal_entities`;
- bloqueio explicito de escopo ampliado;
- geracao de evidencias:
  - before: `artifacts/migration/phase-22t-r2-pilot-legal-entities-write/before-YYYYMMDD-HHMMSS.json`
  - after: `artifacts/migration/phase-22t-r2-pilot-legal-entities-write/after-YYYYMMDD-HHMMSS.json`
- mensagem final obrigatoria:
  - `ESCRITA PILOTO CONCLUÍDA SOMENTE EM legal_entities. EXECUÇÃO AMPLIADA BLOQUEADA.`

## 5. Comando executado

```bash
node scripts/migration/phase-22k-r2-baseline-write.mjs \
  --expected-target nsnmlleplpzsefzkuxlb \
  --batch baseline_22f_r2_restore_test_qualyvac \
  --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --pilot-authorization "AUTORIZO A PRIMEIRA ESCRITA PILOTO DA BASELINE 22R-R2 SOMENTE EM legal_entities NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json \
  --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260626-224501.json \
  --pilot-entity legal_entities \
  --execute-pilot-write \
  --write
```

## 6. Evidencia before

Arquivo gerado:

- `artifacts/migration/phase-22t-r2-pilot-legal-entities-write/before-20260626-224906.json`

Resultado before:

- `beforeDecision=GO`
- `legalEntitiesCountBefore=0`
- dupla autorizacao valida;
- target/projeto/batch validos;
- registro planejado unico;
- chave natural confirmada: `(tenant_id, cnpj)`.

## 7. Resultado da escrita piloto

Operacao executada:

- `upsert` em `public.legal_entities` com `ON CONFLICT (tenant_id, cnpj)`
- 1 registro criado/afetado
- sem execucao de outras entidades

## 8. Evidencia after

Arquivo gerado:

- `artifacts/migration/phase-22t-r2-pilot-legal-entities-write/after-20260626-224906.json`

Resultado after:

- `afterDecision=GO`
- `writeAttempted=true`
- `writeSucceeded=true`
- `recordsAffectedCount=1`
- sem erros

## 9. Delta de `legal_entities`

- contagem antes: `0`
- contagem depois: `1`
- delta: `+1`

## 10. Registros criados/afetados

Registro retornado no after:

- `id=973a686d-e87f-4114-9d1d-455ed80a92de`
- `tenant_id=00000000-0000-0000-0000-000000000001`
- `cnpj=TMP-CNPJ-LE-0001`
- `erp_company_code=TMP-LE-001`
- `name=Qualyvac Baseline LE`

## 11. Confirmacao de escopo unico

- somente `legal_entities` foi tocada;
- `profiles` nao tocada;
- `company_contacts` nao tocada;
- nenhuma entidade adicional foi executada;
- execucao ampliada permaneceu bloqueada.

## 12. Confirmacoes de bloqueio das demais entidades

Verificacoes de suporte no pos-check:

- `profiles_count=1` (inalterada);
- `companies_count=0` (inalterada);
- `contacts_count=0` (inalterada);
- `deals_count=0` (inalterada);
- sem caminho executavel para outras entidades nesta fase.

## 13. Erros, se houver

- nenhum erro de escrita;
- nenhum erro de validacao critica na execucao 22T-R2.

## 14. Decisao final GO/PARCIAL/NO-GO

**GO**

Justificativa:

- before em GO;
- escrita real ocorreu somente em `legal_entities`;
- after em GO;
- delta coerente (`+1`);
- registro afetado identificado;
- nenhuma outra entidade tocada;
- sem transacionais/filas/integracoes;
- execucao ampliada bloqueada.

## 15. Recomendacao da proxima fase

Seguir para fase de avaliacao controlada do piloto (validacao funcional e auditoria de rastreabilidade), mantendo escopo minimo e sem liberar execucao em outras entidades sem novo gate humano explicito.

## 16. Confirmacoes obrigatorias

- SQL de escrita executado: sim
- escrita em banco: sim
- entidade escrita: `legal_entities`
- quantidade de registros criados/afetados: 1
- migration: nao
- seed/cleanup: nao
- rollback: nao
- ERP/API/webhook/n8n: nao
- filas processadas: nao
- deploy: nao
- push: nao
- staging/prod alterados: nao
- `profiles` tocada: nao
- `company_contacts` tocada: nao
- transacionais tocadas: nao
- executor executou escrita ampliada: nao
