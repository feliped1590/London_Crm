# Fase 19F - Readiness para nova tentativa controlada do seed

## 1. Objetivo

Preparar a nova tentativa controlada do seed piloto apos as correcoes da Fase 19E, sem executar seed nesta fase.

## 2. Contexto

- Fase 19B: seed falhou por ausencia de `hstore`.
- Fase 19D-C: `hstore` habilitado com sucesso apenas no target isolado.
- Fase 19D-D: seed falhou por regra de transportadora (`validate_carrier_erp_code()`).
- Fase 19E: seed/validate/reconcile/cleanup ajustados para `carriers.erp_code` sintetico.

## 3. Correcoes aplicadas ate a Fase 19E

- `seed-pilot-dataset.sql`:
  - carriers piloto incluem `erp_code` obrigatorio;
  - valores sinteticos: `999001` e `999002`;
  - garantia idempotente para carriers preexistentes sem ERP.
- `validate-pilot-dataset.sql`:
  - validacao de carriers com ERP sintetico;
  - checagem `pilot_carriers_missing_erp_code`.
- `reconcile-pilot-dataset.sql`:
  - contagem de carriers alinhada a ERP sintetico;
  - checagem de carriers piloto sem ERP.
- `cleanup-pilot-dataset.sql`:
  - filtros de carriers por nome piloto + ERP sintetico;
  - gate de cleanup preservado.
- `README.md`:
  - licoes da Fase 19D-D registradas.

## 4. Ambiente autorizado

- Projeto: `crm-qualyvac-restore-test`
- Ref: `nsnmlleplpzsefzkuxlb`

## 5. Ambientes proibidos

- Staging: `cansbrrwrprcycjvgvqm`
- Producao: qualquer ambiente/ref nao explicitamente autorizado

## 6. Pre-checks locais

- Branch atual: `main`
- Repositorio limpo e alinhado com `origin/main`
- Scripts do piloto presentes em `scripts/pilot-seed/`
- Sem `.env`, dumps, manifestos sensiveis ou secrets pendentes no repositorio

## 7. Pre-checks read-only do target

Executado somente no target `nsnmlleplpzsefzkuxlb`:

- projeto/ref alvo confirmados;
- target nao e staging e sem sinal de producao;
- dados piloto atuais em zero nas tabelas principais;
- filas principais zeradas.

## 8. Validacao de `hstore`

- `hstore_installed = true`
- `hstore(text, text)` resolvivel = `true`

## 9. Validacao de ERP codes sinteticos

- Coluna identificada: `public.carriers.erp_code` (`integer`)
- Valores planejados para seed:
  - `CARRIER PILOTO 01` -> `999001`
  - `CARRIER PILOTO 02` -> `999002`
- Verificacao read-only:
  - nao ha carriers atuais com `erp_code in (999001,999002)`
  - nao ha colisao fora de namespace piloto (`pilot_erp_codes_outside_pilot_namespace = 0`)

## 10. Revisao estatica dos scripts

Confirmado:

- hard-stop exige:
  - `app.pilot_target_ref = nsnmlleplpzsefzkuxlb`
  - `app.pilot_target_name = crm-qualyvac-restore-test`
  - `app.pilot_execution_approved = YES`
- seed aborta se `hstore` ausente;
- carriers piloto usam ERP sintetico;
- validate/reconcile/cleanup conferem ERP sintetico;
- cleanup exige `app.pilot_cleanup_execute = YES`;
- seed nao contem `create extension`;
- sem HTTP/webhook/n8n executavel;
- sem secrets/tokens/chaves.

## 11. Estrategia de wrappers futuros

Para fase de execucao real (futura):

1. criar wrappers temporarios fora do repositorio;
2. incluir settings obrigatorias no topo de cada wrapper;
3. executar ordem:
   - seed;
   - validate;
   - reconcile;
   - pos-check filas;
   - evidencia externa;
4. cleanup nao automatico.

## 12. Settings obrigatorias

```sql
set app.pilot_target_ref = 'nsnmlleplpzsefzkuxlb';
set app.pilot_target_name = 'crm-qualyvac-restore-test';
set app.pilot_execution_approved = 'YES';
```

Nao incluir `app.pilot_cleanup_execute = YES` para execucao normal de seed.

## 13. Criterios de abort

Abortar se:

- branch diferente de `main`;
- repositorio sujo;
- target ref divergente;
- target igual a staging;
- qualquer sinal de producao;
- `hstore` ausente;
- ERP 999001/999002 existente fora do namespace piloto;
- filas nao zeradas antes;
- dados piloto preexistentes inesperados;
- ausencia de aprovacao explicita de Felipe Duarte;
- wrapper com comando fora do plano;
- tentativa de cleanup automatico.

## 14. Evidencias exigidas

- branch e `git status`;
- target ref e nome do projeto;
- comandos executados (sem secrets);
- resultados antes/depois;
- contagens principais;
- filas antes/depois;
- relatorio externo fora do repositorio.

## 15. Cleanup nao autorizado automaticamente

- Cleanup deve permanecer desabilitado por padrao.
- So pode ser executado com aprovacao explicita e setting dedicado:
  - `app.pilot_cleanup_execute = YES`.

## 16. Decisao

**GO para execucao futura** (readiness tecnico aprovado), condicionado a aprovacao explicita de Felipe Duarte na janela da proxima execucao.

## 17. Proximo passo

Executar a Fase 19G para reexecucao controlada do seed, somente com aprovacao explicita de Felipe Duarte.
