# Fase 22R-R2 — Runbook final e gate humano da primeira escrita piloto (sem escrita)

## 1. Objetivo

Consolidar o runbook final e o gate humano para a primeira escrita controlada futura, mantendo hard stop ativo e sem executar qualquer mutacao nesta fase.

## 2. Escopo

- revisar evidencias 22Q-R2 ja validadas;
- definir entidade piloto da primeira escrita real futura;
- formalizar runbook before/during/after para a escrita piloto;
- formalizar comando futuro proposto (somente documental);
- formalizar frase especifica de autorizacao piloto;
- formalizar criterios futuros de GO/PARCIAL/NO-GO da execucao piloto.

## 3. Restricoes absolutas

Mantidas nesta fase:

- sem SQL de escrita;
- sem insert/update/upsert/delete;
- sem RPC de escrita;
- sem escrita em banco;
- sem seed/cleanup/rollback;
- sem migration/deploy/push;
- sem alteracao de staging/producao;
- sem ERP/API/webhook/n8n;
- sem processamento de filas;
- sem remover hard stop;
- sem bypass (`--force`, `--skip-guards`, `--tables`, `--all`);
- sem incluir `profiles` na primeira rodada;
- sem incluir `company_contacts` na whitelist de escrita.

## 4. Estado atual da migracao

Estado consolidado com base nas evidencias:

- `preflight_decision=PARCIAL` (unicamente por `company_contacts` reference-only);
- `write_plan_decision=GO`;
- `armed_write_decision=GO`;
- operacoes somente em memoria;
- hard stop final ativo e validado;
- nenhuma mutacao executada.

## 5. Evidencias revisadas

- `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`
- `artifacts/migration/phase-22k-r2-baseline-write/preflight-20260626-223725.json`
- `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260626-223725.json`
- `artifacts/migration/phase-22q-r2-armed-write/before-20260626-223725.json`
- documentos 22H-R2 ate 22Q-R2 da trilha de governanca.

## 6. Justificativa da entidade piloto

`legal_entities` e a melhor candidata para primeira escrita real piloto porque:

- esta presente no input e no write plan;
- possui contagem planejada objetiva (`plannedCount=1`);
- e rastreavel por batch/chaves temporarias no fluxo definido;
- nao depende de `profiles`;
- nao depende de `company_contacts`;
- nao e transacional;
- nao aciona filas nem integracoes externas no contrato atual;
- minimiza superficie de risco operacional.

## 7. Entidade piloto escolhida

- `legal_entities`

Se houver impedimento tecnico pontual nessa entidade, alternativa minima segura recomendada:

- **nenhuma alternativa automatica nesta fase**; o fluxo deve pausar em `NO-GO` e revalidar precondicoes de `legal_entities` antes de considerar outra entidade.

## 8. Entidades excluidas

Primeira escrita piloto futura deve excluir:

- `profiles` (condicional/subfase separada);
- `company_contacts` (reference-only, nao gravavel);
- transacionais;
- filas;
- integracoes externas;
- anexos;
- notificacoes;
- audit logs;
- sessoes.

## 9. Runbook before/during/after

### Before (futuro)

- confirmar branch `main`;
- confirmar `origin/main...main = 0 0`;
- confirmar working tree esperado;
- confirmar target `nsnmlleplpzsefzkuxlb`;
- confirmar project `crm-qualyvac-restore-test`;
- confirmar ausencia de staging/prod;
- confirmar batch `baseline_22f_r2_restore_test_qualyvac`;
- confirmar autorizacao geral exata;
- confirmar autorizacao piloto especifica exata;
- confirmar input `latest.json`;
- confirmar write plan validado;
- confirmar entidade piloto `legal_entities`;
- confirmar `profiles` e `company_contacts` excluidas;
- confirmar bloqueio de transacionais/filas/integracoes;
- gerar evidencia before;
- registrar contagem antes de `legal_entities`.

### During (futuro)

- executar somente `legal_entities`;
- limitar operacao ao batch autorizado;
- nao executar demais entidades;
- nao executar `profiles`;
- nao executar `company_contacts`;
- nao executar transacionais;
- nao executar filas;
- nao chamar ERP/API/n8n/webhooks;
- parar imediatamente em erro;
- nao acionar rollback automatico.

### After (futuro)

- gerar evidencia after;
- registrar contagem depois de `legal_entities`;
- calcular delta;
- listar registros criados/afetados por batch;
- validar idempotencia basica;
- confirmar 0 transacionais;
- confirmar 0 filas;
- confirmar 0 ERP/API/n8n/webhooks;
- decidir GO/PARCIAL/NO-GO;
- recomendar rollback separado somente se necessario.

## 10. Comando futuro proposto

Comando futuro (somente proposta documental, nao executar nesta fase):

```bash
node scripts/migration/phase-22k-r2-baseline-write.mjs \
  --expected-target nsnmlleplpzsefzkuxlb \
  --batch baseline_22f_r2_restore_test_qualyvac \
  --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json \
  --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260626-223725.json \
  --pilot-entity legal_entities \
  --execute-pilot-write
```

Observacao:

- nesta 22R-R2, esse comando nao e implementado para execucao real;
- hard stop deve permanecer ativo ate fase futura explicitamente autorizada.

## 11. Frase de autorizacao piloto especifica

Frase definida para uso exclusivo na fase futura de escrita piloto:

`AUTORIZO A PRIMEIRA ESCRITA PILOTO DA BASELINE 22R-R2 SOMENTE EM legal_entities NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

## 12. Criterios futuros GO/PARCIAL/NO-GO

### GO futuro (execucao piloto)

- target correto;
- project name correto;
- batch correto;
- autorizacao geral correta;
- autorizacao piloto especifica correta;
- input validado;
- write plan validado;
- entidade piloto `legal_entities`;
- guards ativos;
- evidencia before gerada;
- somente `legal_entities` executada;
- evidencia after gerada;
- delta coerente;
- 0 transacionais;
- 0 filas;
- 0 ERP/API/n8n/webhooks.

### PARCIAL futuro

- `legal_entities` executa parcialmente;
- erro controlado;
- before/after existentes;
- nada fora de `legal_entities` tocado.

### NO-GO futuro

- target incerto;
- staging/prod detectado;
- autorizacao ausente/divergente;
- batch divergente;
- input/plano divergente;
- entidade diferente de `legal_entities`;
- `profiles` entrar;
- `company_contacts` entrar;
- transacionais entrarem;
- filas entrarem;
- ERP/API/n8n/webhooks entrarem;
- rollback automatico;
- bypass.

## 13. Riscos restantes

- risco residual na primeira escrita real, mitigado pelo escopo minimo (`legal_entities`);
- risco operacional de erro humano no gate de autorizacao, mitigado por frase especifica piloto;
- risco de desvio de escopo, mitigado por bloqueio de entidades e runbook estrito;
- risco de confusao de trilha com scripts legados, mitigado por segregacao de fluxo baseline 22*.

## 14. Decisao final GO/PARCIAL/NO-GO

**GO**

Justificativa:

- runbook final criado;
- entidade piloto definida (`legal_entities`);
- frase de autorizacao piloto definida;
- criterios futuros formalizados;
- hard stop permanece ativo;
- nenhuma escrita ocorreu.

## 15. Recomendacao da proxima fase

Fase 22S-R2 (ainda sem escrita real efetiva):

- validar checklist operacional final com leitura cruzada runbook + evidencias;
- preparar fase de execucao piloto em ambiente controlado com dupla confirmacao humana;
- manter hard stop por padrao ate a liberacao explicita da escrita piloto.

## 16. Confirmacoes negativas obrigatorias

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
- modo write funcional executado: nao
- insert/update/upsert/delete executado: nao
- RPC de escrita executada: nao
- executor executou escrita: nao
